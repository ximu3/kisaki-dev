// Capture only a short-lived, owned D3D11 window and retain independent pixel bytes.
#include <windows.h>
#include <d3d11_1.h>
#include <dxgi1_2.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <array>
#include <atomic>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <memory>
#include <mutex>
#include <vector>
#include "color.h"

using namespace winrt;
using namespace winrt::Windows::Graphics::Capture;
using namespace winrt::Windows::Graphics::DirectX;
using namespace winrt::Windows::Graphics::DirectX::Direct3D11;

struct CaptureState {
  std::atomic<bool> closing{false};
  std::mutex mutex;
  std::vector<unsigned char> pixels;
  int width = 0;
  int height = 0;
  int frames_seen = 0;
  HRESULT callback_error = S_OK;
  std::array<std::array<int, 4>, 4> samples{};
};

static const float colors[4][4] = {{1,0,0,1}, {0,1,0,1}, {0,0,1,1}, {1,1,1,1}};

static LRESULT CALLBACK window_proc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_PAINT) {
    PAINTSTRUCT paint;
    BeginPaint(window, &paint);
    EndPaint(window, &paint);
    return 0;
  }
  return DefWindowProcW(window, message, wparam, lparam);
}

static void device(com_ptr<ID3D11Device>& output, com_ptr<ID3D11DeviceContext>& context) {
  check_hresult(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
    D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0, D3D11_SDK_VERSION,
    output.put(), nullptr, context.put()));
}

static IDirect3DDevice projected_device(com_ptr<ID3D11Device> const& device) {
  auto dxgi = device.as<IDXGIDevice>();
  com_ptr<::IInspectable> inspectable;
  check_hresult(CreateDirect3D11DeviceFromDXGIDevice(dxgi.get(), inspectable.put()));
  return inspectable.as<IDirect3DDevice>();
}

extern "C" int run_capture_probe() {
  HWND window = nullptr;
  const wchar_t* class_name = L"VantageOwnedCaptureProbe";
  Direct3D11CaptureFramePool pool{nullptr};
  GraphicsCaptureSession session{nullptr};
  event_token arrived{};
  bool event_registered = false;
  auto state = std::make_shared<CaptureState>();
  auto& closing = state->closing;
  auto& mutex = state->mutex;
  auto& pixels = state->pixels;
  auto& width = state->width;
  auto& height = state->height;
  auto& frames_seen = state->frames_seen;
  auto& callback_error = state->callback_error;
  auto& samples = state->samples;
  bool supported = false;
  bool cursor_disabled = false;
  bool fixture_was_foreground = false;
  std::array<std::array<int, 4>, 3> hdr_samples{};
  const char* stage = "initialization";
  int result = 1;
  try {
    init_apartment(apartment_type::multi_threaded);
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    supported = GraphicsCaptureSession::IsSupported();
    if (!supported) throw hresult_error(E_NOTIMPL);
    WNDCLASSW klass{};
    klass.lpfnWndProc = window_proc;
    klass.hInstance = GetModuleHandleW(nullptr);
    klass.lpszClassName = class_name;
    if (!RegisterClassW(&klass)) throw hresult_error(HRESULT_FROM_WIN32(GetLastError()));
    window = CreateWindowExW(WS_EX_APPWINDOW, class_name,
      L"Vantage isolated capture fixture", WS_OVERLAPPEDWINDOW, 32, 32, 240, 160,
      nullptr, nullptr, klass.hInstance, nullptr);
    if (!window) throw hresult_error(HRESULT_FROM_WIN32(GetLastError()));

    stage = "owned D3D11 surface";
    com_ptr<ID3D11Device> producer;
    com_ptr<ID3D11DeviceContext> producer_context;
    device(producer, producer_context);
    auto producer_context1 = producer_context.as<ID3D11DeviceContext1>();
    auto dxgi = producer.as<IDXGIDevice>();
    com_ptr<IDXGIAdapter> adapter;
    check_hresult(dxgi->GetAdapter(adapter.put()));
    com_ptr<IDXGIFactory2> factory;
    check_hresult(adapter->GetParent(guid_of<IDXGIFactory2>(), factory.put_void()));
    DXGI_SWAP_CHAIN_DESC1 description{};
    description.Width = 240;
    description.Height = 160;
    description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    description.SampleDesc.Count = 1;
    description.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    description.BufferCount = 2;
    description.SwapEffect = DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL;
    com_ptr<IDXGISwapChain1> swap;
    check_hresult(factory->CreateSwapChainForHwnd(producer.get(), window, &description,
      nullptr, nullptr, swap.put()));
    com_ptr<ID3D11Texture2D> backbuffer;
    check_hresult(swap->GetBuffer(0, guid_of<ID3D11Texture2D>(), backbuffer.put_void()));
    com_ptr<ID3D11RenderTargetView> view;
    check_hresult(producer->CreateRenderTargetView(backbuffer.get(), nullptr, view.put()));
    const D3D11_RECT rects[4] = {{0,0,120,80}, {120,0,240,80}, {0,80,120,160}, {120,80,240,160}};
    ShowWindow(window, SW_SHOWNOACTIVATE);
    fixture_was_foreground = GetForegroundWindow() == window;
    for (int i = 0; i < 4; ++i) producer_context1->ClearView(view.get(), colors[i], &rects[i], 1);
    check_hresult(swap->Present(1, 0));
    MSG initial_message;
    while (PeekMessageW(&initial_message, nullptr, 0, 0, PM_REMOVE)) {
      TranslateMessage(&initial_message);
      DispatchMessageW(&initial_message);
    }

    stage = "WGC session";
    com_ptr<ID3D11Device> consumer;
    com_ptr<ID3D11DeviceContext> consumer_context;
    device(consumer, consumer_context);
    stage = "native tone mapping";
    hdr_samples = check_hdr_effect(consumer.get(), consumer_context.get());
    auto capture_device = projected_device(consumer);
    stage = "capture item creation";
    auto interop = get_activation_factory<GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
    GraphicsCaptureItem item{nullptr};
    check_hresult(interop->CreateForWindow(window, guid_of<GraphicsCaptureItem>(), put_abi(item)));
    stage = "frame pool creation";
    pool = Direct3D11CaptureFramePool::CreateFreeThreaded(capture_device,
      DirectXPixelFormat::R16G16B16A16Float, 2, item.Size());
    arrived = pool.FrameArrived([state, consumer, consumer_context](auto const& sender, auto const&) {
      auto& closing = state->closing;
      auto& mutex = state->mutex;
      auto& pixels = state->pixels;
      auto& width = state->width;
      auto& height = state->height;
      auto& frames_seen = state->frames_seen;
      auto& callback_error = state->callback_error;
      auto& samples = state->samples;
      std::lock_guard<std::mutex> guard(mutex);
      if (closing || !pixels.empty()) return;
      try {
        auto frame = sender.TryGetNextFrame();
        if (!frame) return;
        ++frames_seen;
        auto extent = frame.ContentSize();
        auto access = frame.Surface().as<::Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();
        com_ptr<ID3D11Texture2D> texture;
        check_hresult(access->GetInterface(guid_of<ID3D11Texture2D>(), texture.put_void()));
        D3D11_TEXTURE2D_DESC desc{};
        texture->GetDesc(&desc);
        if (extent.Width <= 0 || extent.Height <= 0 || extent.Width > static_cast<int>(desc.Width)
            || extent.Height > static_cast<int>(desc.Height)) return;
        texture = convert_fixture_to_sdr(consumer.get(), texture.get(), extent.Width, extent.Height, 80.0f);
        texture->GetDesc(&desc);
        desc.Usage = D3D11_USAGE_STAGING;
        desc.BindFlags = 0;
        desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
        desc.MiscFlags = 0;
        com_ptr<ID3D11Texture2D> staging;
        check_hresult(consumer->CreateTexture2D(&desc, nullptr, staging.put()));
        consumer_context->CopyResource(staging.get(), texture.get());
        D3D11_MAPPED_SUBRESOURCE mapped{};
        check_hresult(consumer_context->Map(staging.get(), 0, D3D11_MAP_READ, 0, &mapped));
        std::vector<unsigned char> owned(static_cast<size_t>(extent.Width) * extent.Height * 4);
        for (int y = 0; y < extent.Height; ++y) {
          auto row = static_cast<unsigned char*>(mapped.pData) + y * mapped.RowPitch;
          for (int x = 0; x < extent.Width; ++x) {
            auto offset = (static_cast<size_t>(y) * extent.Width + x) * 4;
            const unsigned alpha = row[x*4+3];
            // The Direct2D target is premultiplied; PNG and WindowImage use straight alpha.
            for (int channel = 0; channel < 3; ++channel) {
              unsigned value = alpha ? (row[x*4+2-channel] * 255u + alpha / 2) / alpha : 0;
              owned[offset+channel] = static_cast<unsigned char>(value > 255 ? 255 : value);
            }
            owned[offset+3] = static_cast<unsigned char>(alpha);
          }
        }
        consumer_context->Unmap(staging.get(), 0);
        bool matches = true;
        for (int i = 0; i < 4; ++i) {
          int x = extent.Width * (i % 2 ? 3 : 1) / 4;
          int y = extent.Height * (i / 2 ? 3 : 1) / 4;
          auto offset = (static_cast<size_t>(y) * extent.Width + x) * 4;
          for (int channel = 0; channel < 4; ++channel) {
            samples[i][channel] = owned[offset+channel];
            if (abs(samples[i][channel] - static_cast<int>(colors[i][channel]*255)) > 3)
              matches = false;
          }
        }
        // A known fixture pattern selects its rendered frame; real capture does not reject dark images.
        if (matches) {
          width = extent.Width;
          height = extent.Height;
          pixels = std::move(owned);
        }
      } catch (hresult_error const& error) {
        callback_error = error.code();
      }
    });
    event_registered = true;
    stage = "session creation";
    session = pool.CreateCaptureSession(item);
    stage = "cursor policy";
    session.IsCursorCaptureEnabled(false);
    cursor_disabled = !session.IsCursorCaptureEnabled();
    stage = "capture start";
    session.StartCapture();

    stage = "frame delivery";
    auto deadline = GetTickCount64() + 10000;
    while (GetTickCount64() < deadline) {
      MSG message;
      while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
        TranslateMessage(&message);
        DispatchMessageW(&message);
      }
      for (int i = 0; i < 4; ++i) producer_context1->ClearView(view.get(), colors[i], &rects[i], 1);
      check_hresult(swap->Present(1, 0));
      {
        std::lock_guard<std::mutex> guard(mutex);
        if (FAILED(callback_error)) throw hresult_error(callback_error);
        if (!pixels.empty()) break;
      }
      Sleep(10);
    }
    {
      std::lock_guard<std::mutex> guard(mutex);
      if (pixels.empty()) throw hresult_error(HRESULT_FROM_WIN32(WAIT_TIMEOUT));
    }
    result = 0;
  } catch (hresult_error const& error) {
    std::cerr << "The owned WGC check failed at " << stage << "; HRESULT="
      << static_cast<unsigned long>(error.code()) << "\n";
  } catch (...) {
    std::cerr << "The owned WGC check did not complete.\n";
  }
  closing = true;
  if (pool && event_registered) pool.FrameArrived(arrived);
  if (session) session.Close();
  if (pool) pool.Close();
  { std::lock_guard<std::mutex> guard(mutex); }
  if (window && !DestroyWindow(window)) result = 1;
  UnregisterClassW(class_name, GetModuleHandleW(nullptr));

  if (result == 0) {
    const char* output = std::getenv("VANTAGE_PROBE_PIXELS");
    if (!output) return 1;
    std::ofstream file(output, std::ios::binary);
    file.write(reinterpret_cast<char const*>(pixels.data()), pixels.size());
    if (!file.good()) return 1;
    std::cout << "{\"width\":" << width << ",\"height\":" << height
      << ",\"framesSeen\":" << frames_seen << ",\"rgbaBytes\":" << pixels.size()
      << ",\"cursorDisabled\":" << (cursor_disabled ? "true" : "false")
      << ",\"fixtureWasForeground\":" << (fixture_was_foreground ? "true" : "false")
      << ",\"poolClosed\":true,\"sessionClosed\":true,\"windowDestroyed\":true,\"samples\":[";
    for (int i = 0; i < 4; ++i) {
      if (i) std::cout << ',';
      std::cout << '[' << samples[i][0] << ',' << samples[i][1] << ',' << samples[i][2]
        << ',' << samples[i][3] << ']';
    }
    std::cout << "],\"captureFormat\":\"rgba16float\",\"toneMapping\":\"Direct2D\",\"alphaMode\":\"straight\",\"hdrSamples\":[";
    for (int i = 0; i < 3; ++i) {
      if (i) std::cout << ',';
      std::cout << '[' << hdr_samples[i][0] << ',' << hdr_samples[i][1] << ',' << hdr_samples[i][2]
        << ',' << hdr_samples[i][3] << ']';
    }
    std::cout << "]}\n";
  }
  return result;
}

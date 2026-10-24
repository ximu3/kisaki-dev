// Capture only the probe's own HWND into floating-point compositor pixels.
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_6.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <limits>
#include <thread>

using namespace winrt;
using namespace winrt::Windows::Graphics::Capture;
using namespace winrt::Windows::Graphics::DirectX;
using namespace winrt::Windows::Graphics::DirectX::Direct3D11;

static float half(uint16_t bits) {
    int exponent = (bits >> 10) & 31;
    int fraction = bits & 1023;
    float sign = bits & 0x8000 ? -1.0f : 1.0f;
    if (exponent == 31) return fraction ? std::numeric_limits<float>::quiet_NaN()
                                       : sign * std::numeric_limits<float>::infinity();
    return sign * (exponent ? std::ldexp(1.0f + fraction / 1024.0f, exponent - 15)
                            : std::ldexp(static_cast<float>(fraction), -24));
}

extern "C" int capture_probe(uint64_t window, const double* points, size_t count) {
    try {
        init_apartment(apartment_type::multi_threaded);
        HWND hwnd = reinterpret_cast<HWND>(static_cast<uintptr_t>(window));
        if (!IsWindow(hwnd) || count > 16) return 2;
        com_ptr<ID3D11Device> device;
        com_ptr<ID3D11DeviceContext> context;
        check_hresult(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
            D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0, D3D11_SDK_VERSION,
            device.put(), nullptr, context.put()));
        auto dxgi = device.as<IDXGIDevice>();
        com_ptr<IInspectable> inspectable;
        check_hresult(CreateDirect3D11DeviceFromDXGIDevice(dxgi.get(), inspectable.put()));
        auto direct = inspectable.as<IDirect3DDevice>();
        auto factory = get_activation_factory<GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
        GraphicsCaptureItem item{nullptr};
        check_hresult(factory->CreateForWindow(hwnd, guid_of<GraphicsCaptureItem>(), put_abi(item)));
        auto pool = Direct3D11CaptureFramePool::CreateFreeThreaded(
            direct, DirectXPixelFormat::R16G16B16A16Float, 2, item.Size());
        auto session = pool.CreateCaptureSession(item);
        session.IsCursorCaptureEnabled(false);
        session.StartCapture();
        Direct3D11CaptureFrame frame{nullptr};
        int frames = 0;
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(4);
        while (std::chrono::steady_clock::now() < deadline && frames < 3) {
            auto next = pool.TryGetNextFrame();
            if (next) {
                if (frame) frame.Close();
                frame = std::move(next);
                frames++;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        if (!frame) return 3;
        auto access = frame.Surface().as<::Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();
        com_ptr<ID3D11Texture2D> texture;
        check_hresult(access->GetInterface(__uuidof(ID3D11Texture2D), texture.put_void()));
        D3D11_TEXTURE2D_DESC description{};
        texture->GetDesc(&description);
        if (description.Format != DXGI_FORMAT_R16G16B16A16_FLOAT) return 4;
        const auto size = frame.ContentSize();
        if (size.Width <= 0 || size.Height <= 0 || size.Width > 4096 || size.Height > 4096 ||
            static_cast<UINT>(size.Width) > description.Width || static_cast<UINT>(size.Height) > description.Height) return 5;
        DXGI_OUTPUT_DESC1 output_description{};
        bool output_found = false;
        com_ptr<IDXGIFactory1> dxgi_factory;
        check_hresult(CreateDXGIFactory1(__uuidof(IDXGIFactory1), dxgi_factory.put_void()));
        const auto monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        for (UINT adapter_index = 0; !output_found; adapter_index++) {
            com_ptr<IDXGIAdapter1> adapter;
            auto status = dxgi_factory->EnumAdapters1(adapter_index, adapter.put());
            if (status == DXGI_ERROR_NOT_FOUND) break;
            check_hresult(status);
            for (UINT output_index = 0; ; output_index++) {
                com_ptr<IDXGIOutput> output;
                status = adapter->EnumOutputs(output_index, output.put());
                if (status == DXGI_ERROR_NOT_FOUND) break;
                check_hresult(status);
                auto output6 = output.try_as<IDXGIOutput6>();
                if (output6 && SUCCEEDED(output6->GetDesc1(&output_description)) && output_description.Monitor == monitor) {
                    output_found = true;
                    break;
                }
            }
        }
        description.Usage = D3D11_USAGE_STAGING;
        description.BindFlags = description.MiscFlags = 0;
        description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
        com_ptr<ID3D11Texture2D> staging;
        check_hresult(device->CreateTexture2D(&description, nullptr, staging.put()));
        context->CopyResource(staging.get(), texture.get());
        D3D11_MAPPED_SUBRESOURCE mapped{};
        check_hresult(context->Map(staging.get(), 0, D3D11_MAP_READ, 0, &mapped));
        std::printf("{\"width\":%d,\"height\":%d,\"format\":\"rgba16float\",\"frames\":%d,", size.Width, size.Height, frames);
        if (output_found) {
            std::printf("\"dxgiDisplay\":{\"colorSpace\":%u,\"bitsPerColor\":%u,\"minLuminance\":%.9g,\"maxLuminance\":%.9g,\"maxFullFrameLuminance\":%.9g},",
                static_cast<unsigned>(output_description.ColorSpace), output_description.BitsPerColor,
                output_description.MinLuminance, output_description.MaxLuminance, output_description.MaxFullFrameLuminance);
        }
        std::printf("\"samples\":[");
        for (size_t index = 0; index < count; index++) {
            const int x = static_cast<int>(points[index * 2] * size.Width);
            const int y = static_cast<int>(points[index * 2 + 1] * size.Height);
            const auto pixel = reinterpret_cast<const uint16_t*>(static_cast<const uint8_t*>(mapped.pData) + y * mapped.RowPitch + x * 8);
            std::printf("%s[%.9g,%.9g,%.9g,%.9g]", index ? "," : "", half(pixel[0]), half(pixel[1]), half(pixel[2]), half(pixel[3]));
        }
        std::printf("]}");
        context->Unmap(staging.get(), 0);
        frame.Close();
        session.Close();
        pool.Close();
        return 0;
    } catch (const hresult_error& error) {
        std::fprintf(stderr, "Window capture failed (HRESULT 0x%08x).\n", static_cast<unsigned>(error.code()));
        return 1;
    }
}

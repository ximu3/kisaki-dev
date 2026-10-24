// Exercise native effects with known fixture luminance; this is not a metadata estimator.
#include "color.h"
#include <d2d1_1.h>
#include <d2d1effects_2.h>
#include <dxgi.h>
#include <cstdint>

using winrt::check_hresult;
using winrt::com_ptr;
using winrt::guid_of;

com_ptr<ID3D11Texture2D> convert_fixture_to_sdr(
  ID3D11Device* device, ID3D11Texture2D* source, unsigned width, unsigned height,
  float known_max_nits) {
  com_ptr<ID2D1Factory1> factory;
  check_hresult(D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED,
    guid_of<ID2D1Factory1>(), nullptr, factory.put_void()));
  com_ptr<IDXGIDevice> dxgi;
  check_hresult(device->QueryInterface(guid_of<IDXGIDevice>(), dxgi.put_void()));
  com_ptr<ID2D1Device> drawing_device;
  check_hresult(factory->CreateDevice(dxgi.get(), drawing_device.put()));
  com_ptr<ID2D1DeviceContext> drawing;
  check_hresult(drawing_device->CreateDeviceContext(D2D1_DEVICE_CONTEXT_OPTIONS_NONE, drawing.put()));
  com_ptr<ID2D1ColorContext> scrgb;
  com_ptr<ID2D1ColorContext> srgb;
  check_hresult(drawing->CreateColorContext(D2D1_COLOR_SPACE_SCRGB, nullptr, 0, scrgb.put()));
  check_hresult(drawing->CreateColorContext(D2D1_COLOR_SPACE_SRGB, nullptr, 0, srgb.put()));

  com_ptr<IDXGISurface> source_surface;
  check_hresult(source->QueryInterface(guid_of<IDXGISurface>(), source_surface.put_void()));
  auto source_props = D2D1::BitmapProperties1(D2D1_BITMAP_OPTIONS_NONE,
    D2D1::PixelFormat(DXGI_FORMAT_R16G16B16A16_FLOAT, D2D1_ALPHA_MODE_PREMULTIPLIED),
    96, 96, scrgb.get());
  com_ptr<ID2D1Bitmap1> input;
  check_hresult(drawing->CreateBitmapFromDxgiSurface(source_surface.get(), &source_props, input.put()));

  com_ptr<ID2D1Effect> tone;
  check_hresult(drawing->CreateEffect(CLSID_D2D1HdrToneMap, tone.put()));
  tone->SetInput(0, input.get());
  check_hresult(tone->SetValue(D2D1_HDRTONEMAP_PROP_INPUT_MAX_LUMINANCE, known_max_nits));
  check_hresult(tone->SetValue(D2D1_HDRTONEMAP_PROP_OUTPUT_MAX_LUMINANCE, 80.0f));
  check_hresult(tone->SetValue(D2D1_HDRTONEMAP_PROP_DISPLAY_MODE, D2D1_HDRTONEMAP_DISPLAY_MODE_SDR));

  com_ptr<ID2D1Effect> conversion;
  check_hresult(drawing->CreateEffect(CLSID_D2D1ColorManagement, conversion.put()));
  conversion->SetInputEffect(0, tone.get());
  check_hresult(conversion->SetValue(D2D1_COLORMANAGEMENT_PROP_SOURCE_COLOR_CONTEXT, scrgb.get()));
  check_hresult(conversion->SetValue(D2D1_COLORMANAGEMENT_PROP_DESTINATION_COLOR_CONTEXT, srgb.get()));

  D3D11_TEXTURE2D_DESC description{};
  description.Width = width;
  description.Height = height;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  description.SampleDesc.Count = 1;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE;
  com_ptr<ID3D11Texture2D> output;
  check_hresult(device->CreateTexture2D(&description, nullptr, output.put()));
  auto output_surface = output.as<IDXGISurface>();
  auto output_props = D2D1::BitmapProperties1(
    D2D1_BITMAP_OPTIONS_TARGET | D2D1_BITMAP_OPTIONS_CANNOT_DRAW,
    D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED),
    96, 96, srgb.get());
  com_ptr<ID2D1Bitmap1> target;
  check_hresult(drawing->CreateBitmapFromDxgiSurface(output_surface.get(), &output_props, target.put()));
  drawing->SetTarget(target.get());
  drawing->BeginDraw();
  drawing->Clear(D2D1::ColorF(0, 0.0f));
  drawing->DrawImage(conversion.get());
  check_hresult(drawing->EndDraw());
  drawing->SetTarget(nullptr);
  return output;
}

std::array<std::array<int, 4>, 3> check_hdr_effect(ID3D11Device* device, ID3D11DeviceContext* context) {
  // Half-float neutral pixels at scRGB 2, 4 and 8, with opaque alpha.
  const uint16_t values[] = {0x4000,0x4000,0x4000,0x3c00,
                            0x4400,0x4400,0x4400,0x3c00,
                            0x4800,0x4800,0x4800,0x3c00};
  D3D11_TEXTURE2D_DESC description{};
  description.Width = 3;
  description.Height = 1;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
  description.SampleDesc.Count = 1;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  D3D11_SUBRESOURCE_DATA initial{values, sizeof(values), sizeof(values)};
  com_ptr<ID3D11Texture2D> input;
  check_hresult(device->CreateTexture2D(&description, &initial, input.put()));
  auto output = convert_fixture_to_sdr(device, input.get(), 3, 1, 640.0f);
  output->GetDesc(&description);
  description.Usage = D3D11_USAGE_STAGING;
  description.BindFlags = 0;
  description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
  com_ptr<ID3D11Texture2D> staging;
  check_hresult(device->CreateTexture2D(&description, nullptr, staging.put()));
  context->CopyResource(staging.get(), output.get());
  D3D11_MAPPED_SUBRESOURCE mapped{};
  check_hresult(context->Map(staging.get(), 0, D3D11_MAP_READ, 0, &mapped));
  auto bytes = static_cast<unsigned char*>(mapped.pData);
  std::array<std::array<int, 4>, 3> result{};
  for (int i = 0; i < 3; ++i) result[i] = {bytes[i*4+2],bytes[i*4+1],bytes[i*4],bytes[i*4+3]};
  context->Unmap(staging.get(), 0);
  return result;
}

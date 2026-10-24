#pragma once
#include <d3d11.h>
#include <winrt/base.h>
#include <array>

winrt::com_ptr<ID3D11Texture2D> convert_fixture_to_sdr(
  ID3D11Device* device, ID3D11Texture2D* source, unsigned width, unsigned height,
  float known_max_nits);

std::array<std::array<int, 4>, 3> check_hdr_effect(ID3D11Device* device, ID3D11DeviceContext* context);

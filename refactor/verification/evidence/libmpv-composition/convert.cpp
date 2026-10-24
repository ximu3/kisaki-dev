#include <windows.h>
#include <d3d11_1.h>
#include <dxgi1_4.h>
#include <d3dcompiler.h>
#include <wrl/client.h>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

namespace {
void require(bool value, const char* message) {
    if (!value) throw std::runtime_error(message);
}

struct Handle {
    HANDLE value = nullptr;
    Handle() = default;
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
    ~Handle() { if (value) CloseHandle(value); }
};

std::vector<uint8_t> read_pixels(ID3D11Device* device, ID3D11DeviceContext* context,
                                 ID3D11Texture2D* texture) {
    D3D11_TEXTURE2D_DESC description{};
    texture->GetDesc(&description);
    description.Usage = D3D11_USAGE_STAGING;
    description.BindFlags = description.MiscFlags = 0;
    description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
    ComPtr<ID3D11Texture2D> staging;
    require(SUCCEEDED(device->CreateTexture2D(&description, nullptr, &staging)),
            "Failed to create probe readback storage.");
    context->CopyResource(staging.Get(), texture);
    D3D11_MAPPED_SUBRESOURCE mapped{};
    require(SUCCEEDED(context->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &mapped)),
            "Failed to map probe readback storage.");
    std::vector<uint8_t> bytes(size_t(description.Width) * description.Height * 8);
    for (UINT row = 0; row < description.Height; ++row) {
        std::memcpy(bytes.data() + size_t(row) * description.Width * 8,
                    static_cast<const uint8_t*>(mapped.pData) + size_t(row) * mapped.RowPitch,
                    size_t(description.Width) * 8);
    }
    context->Unmap(staging.Get(), 0);
    return bytes;
}

void write_pixels(const std::filesystem::path& path, const std::vector<uint8_t>& bytes) {
    std::ofstream file(path, std::ios::binary);
    require(file.good(), "Failed to create probe pixel file.");
    file.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
    file.close();
    require(file.good(), "Failed to write probe pixel file.");
}

const char shader[] = R"(
cbuffer Parameters : register(b0) { float factor; float3 padding; };
Texture2D<float4> sourceTexture : register(t0);
float4 vertexMain(uint vertexId : SV_VertexID) : SV_Position {
    float2 positions[3] = { float2(-1, -1), float2(-1, 3), float2(3, -1) };
    return float4(positions[vertexId], 0, 1);
}
float4 pixelMain(float4 position : SV_Position) : SV_Target {
    float4 value = sourceTexture.Load(int3(int2(position.xy), 0));
    return float4(value.rgb * factor, value.a);
}
)";

ComPtr<ID3DBlob> compile(const char* entry, const char* target) {
    ComPtr<ID3DBlob> result, errors;
    require(SUCCEEDED(D3DCompile(shader, sizeof(shader) - 1, nullptr, nullptr, nullptr,
        entry, target, D3DCOMPILE_OPTIMIZATION_LEVEL3 | D3DCOMPILE_WARNINGS_ARE_ERRORS,
        0, &result, &errors)), "Failed to compile probe conversion shader.");
    return result;
}
}

extern "C" int convert_probe(uint32_t parent, uint64_t raw_handle, uint64_t raw_luid,
                               float factor, const char* prefix) {
    try {
        Handle process, shared;
        process.value = OpenProcess(PROCESS_DUP_HANDLE, FALSE, parent);
        require(process.value != nullptr, "Failed to open the probe producer process.");
        require(DuplicateHandle(process.value, reinterpret_cast<HANDLE>(raw_handle),
            GetCurrentProcess(), &shared.value, 0, FALSE, DUPLICATE_SAME_ACCESS),
            "Failed to duplicate the probe texture handle.");

        ComPtr<IDXGIFactory4> factory;
        ComPtr<IDXGIAdapter1> adapter;
        require(SUCCEEDED(CreateDXGIFactory1(IID_PPV_ARGS(&factory))),
                "Failed to create the probe DXGI factory.");
        LUID luid{static_cast<DWORD>(raw_luid), static_cast<LONG>(raw_luid >> 32)};
        require(SUCCEEDED(factory->EnumAdapterByLuid(luid, IID_PPV_ARGS(&adapter))),
                "Failed to select the producer's graphics adapter.");
        ComPtr<ID3D11Device> device;
        ComPtr<ID3D11DeviceContext> context;
        D3D_FEATURE_LEVEL level{};
        require(SUCCEEDED(D3D11CreateDevice(adapter.Get(), D3D_DRIVER_TYPE_UNKNOWN, nullptr,
            D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0, D3D11_SDK_VERSION,
            &device, &level, &context)), "Failed to create the probe conversion device.");
        ComPtr<ID3D11Device1> device1;
        require(SUCCEEDED(device.As(&device1)), "Missing the probe shared-resource interface.");
        ComPtr<ID3D11Texture2D> source;
        require(SUCCEEDED(device1->OpenSharedResource1(shared.value, IID_PPV_ARGS(&source))),
                "Failed to open the probe shared texture.");
        D3D11_TEXTURE2D_DESC description{};
        source->GetDesc(&description);
        require(description.Format == DXGI_FORMAT_R16G16B16A16_FLOAT && description.ArraySize == 1 &&
            description.MipLevels == 1 && description.SampleDesc.Count == 1 &&
            description.Width > 0 && description.Height > 0 &&
            description.Width <= 16384 && description.Height <= 16384,
            "Unexpected probe texture layout.");
        auto input = read_pixels(device.Get(), context.Get(), source.Get());

        D3D11_TEXTURE2D_DESC output_description = description;
        output_description.Usage = D3D11_USAGE_DEFAULT;
        output_description.BindFlags = D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE;
        output_description.MiscFlags = output_description.CPUAccessFlags = 0;
        ComPtr<ID3D11Texture2D> output;
        ComPtr<ID3D11RenderTargetView> target;
        ComPtr<ID3D11ShaderResourceView> source_view;
        require(SUCCEEDED(device->CreateTexture2D(&output_description, nullptr, &output)),
                "Failed to allocate the probe output texture.");
        require(SUCCEEDED(device->CreateRenderTargetView(output.Get(), nullptr, &target)),
                "Failed to create the probe render target.");
        require(SUCCEEDED(device->CreateShaderResourceView(source.Get(), nullptr, &source_view)),
                "Failed to create the probe source view.");
        const auto vertex_code = compile("vertexMain", "vs_5_0");
        const auto pixel_code = compile("pixelMain", "ps_5_0");
        ComPtr<ID3D11VertexShader> vertex;
        ComPtr<ID3D11PixelShader> pixel;
        require(SUCCEEDED(device->CreateVertexShader(vertex_code->GetBufferPointer(),
            vertex_code->GetBufferSize(), nullptr, &vertex)), "Failed to create the probe vertex shader.");
        require(SUCCEEDED(device->CreatePixelShader(pixel_code->GetBufferPointer(),
            pixel_code->GetBufferSize(), nullptr, &pixel)), "Failed to create the probe pixel shader.");
        const float constants[4] = {factor, 0, 0, 0};
        D3D11_BUFFER_DESC constant_description{};
        constant_description.ByteWidth = sizeof(constants);
        constant_description.Usage = D3D11_USAGE_IMMUTABLE;
        constant_description.BindFlags = D3D11_BIND_CONSTANT_BUFFER;
        D3D11_SUBRESOURCE_DATA initial{constants, 0, 0};
        ComPtr<ID3D11Buffer> constant_buffer;
        require(SUCCEEDED(device->CreateBuffer(&constant_description, &initial, &constant_buffer)),
                "Failed to create the probe conversion constants.");
        D3D11_RASTERIZER_DESC raster_description{};
        raster_description.FillMode = D3D11_FILL_SOLID;
        raster_description.CullMode = D3D11_CULL_NONE;
        raster_description.DepthClipEnable = TRUE;
        ComPtr<ID3D11RasterizerState> raster;
        require(SUCCEEDED(device->CreateRasterizerState(&raster_description, &raster)),
                "Failed to create the probe rasterizer.");

        const float clear[4] = {0, 0, 0, 0};
        context->ClearRenderTargetView(target.Get(), clear);
        D3D11_VIEWPORT viewport{0, 0, float(description.Width), float(description.Height), 0, 1};
        context->RSSetViewports(1, &viewport);
        context->RSSetState(raster.Get());
        context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
        context->VSSetShader(vertex.Get(), nullptr, 0);
        context->PSSetShader(pixel.Get(), nullptr, 0);
        context->PSSetConstantBuffers(0, 1, constant_buffer.GetAddressOf());
        context->PSSetShaderResources(0, 1, source_view.GetAddressOf());
        context->OMSetRenderTargets(1, target.GetAddressOf(), nullptr);
        context->Draw(3, 0);
        context->ClearState();
        auto converted = read_pixels(device.Get(), context.Get(), output.Get());

        const auto base = std::filesystem::u8path(prefix);
        write_pixels(std::filesystem::path(base.wstring() + L".input.rgba16f"), input);
        write_pixels(std::filesystem::path(base.wstring() + L".output.rgba16f"), converted);
        std::printf("{\"width\":%u,\"height\":%u,\"factor\":%.9g,\"featureLevel\":%u,\"gpuConverted\":true}\n",
            description.Width, description.Height, factor, static_cast<unsigned>(level));
        std::fflush(stdout);
        return 0;
    } catch (const std::exception& error) {
        std::fprintf(stderr, "Composition probe failed: %s\n", error.what());
        return 1;
    }
}

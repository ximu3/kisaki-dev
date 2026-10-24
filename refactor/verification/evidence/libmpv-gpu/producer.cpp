// Isolated rendering and ownership experiment, not a production platform backend.
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_6.h>
#include <wrl/client.h>
#include <EGL/egl.h>
#include <EGL/eglext.h>
#include <EGL/eglext_angle.h>
#include <GLES3/gl3.h>
#include <mpv/client.h>
#include <mpv/render_gl.h>
#include <mpv/render_d3d11.h>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <memory>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

using Microsoft::WRL::ComPtr;

struct ProbeFailure : std::runtime_error { using std::runtime_error::runtime_error; };

static void require(bool condition, const char* message) {
    if (!condition) throw ProbeFailure(message);
}

struct Module {
    HMODULE value = nullptr;
    explicit Module(const std::wstring& path) {
        value = LoadLibraryExW(path.c_str(), nullptr,
                              LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
        require(value != nullptr, "Failed to load graphics probe input.");
    }
    ~Module() { if (value) FreeLibrary(value); }
    template<class T> T get(const char* name) {
        auto value = reinterpret_cast<T>(GetProcAddress(this->value, name));
        require(value != nullptr, "Missing graphics probe symbol.");
        return value;
    }
};

struct Api {
    Module library;
    decltype(&mpv_create) create;
    decltype(&mpv_set_option_string) option;
    decltype(&mpv_initialize) initialize;
    decltype(&mpv_command_async) command;
    decltype(&mpv_get_property_async) get;
    decltype(&mpv_observe_property) observe;
    decltype(&mpv_get_time_ns) now;
    decltype(&mpv_wait_event) wait;
    decltype(&mpv_terminate_destroy) destroy;
    decltype(&mpv_render_context_create) render_create;
    decltype(&mpv_render_context_set_update_callback) render_callback;
    decltype(&mpv_render_context_update) update;
    decltype(&mpv_render_context_get_info) info;
    decltype(&mpv_render_context_render) render;
    decltype(&mpv_render_context_free) render_free;
    explicit Api(const std::wstring& path) : library(path) {
#define MPV_LOAD(member, name) member = library.get<decltype(member)>(#name)
        MPV_LOAD(create, mpv_create);
        MPV_LOAD(option, mpv_set_option_string);
        MPV_LOAD(initialize, mpv_initialize);
        MPV_LOAD(command, mpv_command_async);
        MPV_LOAD(get, mpv_get_property_async);
        MPV_LOAD(observe, mpv_observe_property);
        MPV_LOAD(now, mpv_get_time_ns);
        MPV_LOAD(wait, mpv_wait_event);
        MPV_LOAD(destroy, mpv_terminate_destroy);
        MPV_LOAD(render_create, mpv_render_context_create);
        MPV_LOAD(render_callback, mpv_render_context_set_update_callback);
        MPV_LOAD(update, mpv_render_context_update);
        MPV_LOAD(info, mpv_render_context_get_info);
        MPV_LOAD(render, mpv_render_context_render);
        MPV_LOAD(render_free, mpv_render_context_free);
#undef MPV_LOAD
    }
};

struct Graphics {
    bool direct;
    DXGI_FORMAT target_format;
    std::unique_ptr<Module> eglLibrary;
    std::unique_ptr<Module> glesLibrary;
    decltype(&eglGetProcAddress) get_proc;
    decltype(&eglInitialize) initialize;
    decltype(&eglChooseConfig) choose_config;
    decltype(&eglCreateContext) create_context;
    decltype(&eglCreatePbufferFromClientBuffer) create_surface;
    decltype(&eglMakeCurrent) make_current;
    decltype(&eglDestroySurface) destroy_surface;
    decltype(&eglDestroyContext) destroy_context;
    decltype(&eglTerminate) terminate;
    PFNGLFINISHPROC finish;
    EGLDisplay display = EGL_NO_DISPLAY;
    EGLContext context = EGL_NO_CONTEXT;
    EGLSurface surface = EGL_NO_SURFACE;
    EGLConfig config = nullptr;
    ComPtr<ID3D11Device> device;
    ComPtr<ID3D11DeviceContext> commands;
    ComPtr<ID3D11Texture2D> target;

    explicit Graphics(const std::wstring& directory, bool direct, bool floating = false)
        : direct(direct), target_format(floating ? DXGI_FORMAT_R16G16B16A16_FLOAT : DXGI_FORMAT_B8G8R8A8_UNORM) {
        if (direct) {
            ComPtr<IDXGIFactory6> factory;
            require(SUCCEEDED(CreateDXGIFactory1(IID_PPV_ARGS(&factory))),
                    "Failed to create probe DXGI factory.");
            ComPtr<IDXGIAdapter1> adapter;
            require(SUCCEEDED(factory->EnumAdapterByGpuPreference(0, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE,
                                                                 IID_PPV_ARGS(&adapter))),
                    "Failed to select probe hardware adapter.");
            const D3D_FEATURE_LEVEL levels[] = {D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0};
            D3D_FEATURE_LEVEL actual;
            require(SUCCEEDED(D3D11CreateDevice(adapter.Get(), D3D_DRIVER_TYPE_UNKNOWN, nullptr,
                    D3D11_CREATE_DEVICE_BGRA_SUPPORT, levels, 2, D3D11_SDK_VERSION,
                    &device, &actual, &commands)), "Failed to create probe D3D11 device.");
            return;
        }
        eglLibrary = std::make_unique<Module>(directory + L"/libEGL.dll");
        glesLibrary = std::make_unique<Module>(directory + L"/libGLESv2.dll");
#define EGL_LOAD(member, name) member = eglLibrary->get<decltype(member)>(#name)
        EGL_LOAD(get_proc, eglGetProcAddress);
        EGL_LOAD(initialize, eglInitialize);
        EGL_LOAD(choose_config, eglChooseConfig);
        EGL_LOAD(create_context, eglCreateContext);
        EGL_LOAD(create_surface, eglCreatePbufferFromClientBuffer);
        EGL_LOAD(make_current, eglMakeCurrent);
        EGL_LOAD(destroy_surface, eglDestroySurface);
        EGL_LOAD(destroy_context, eglDestroyContext);
        EGL_LOAD(terminate, eglTerminate);
#undef EGL_LOAD
        auto platform = proc<PFNEGLGETPLATFORMDISPLAYEXTPROC>("eglGetPlatformDisplayEXT");
        const EGLint attributes[] = {EGL_PLATFORM_ANGLE_TYPE_ANGLE,
                                     EGL_PLATFORM_ANGLE_TYPE_D3D11_ANGLE, EGL_NONE};
        display = platform(EGL_PLATFORM_ANGLE_ANGLE, EGL_DEFAULT_DISPLAY, attributes);
        require(display != EGL_NO_DISPLAY, "Failed to obtain probe EGL display.");
        EGLint major = 0, minor = 0;
        require(initialize(display, &major, &minor), "Failed to initialize probe EGL display.");
        const EGLint bits = floating ? 16 : 8;
        std::vector<EGLint> configuration{EGL_SURFACE_TYPE, EGL_PBUFFER_BIT,
            EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT, EGL_RED_SIZE, bits, EGL_GREEN_SIZE, bits,
            EGL_BLUE_SIZE, bits, EGL_ALPHA_SIZE, bits};
        if (floating) {
            configuration.push_back(EGL_COLOR_COMPONENT_TYPE_EXT);
            configuration.push_back(EGL_COLOR_COMPONENT_TYPE_FLOAT_EXT);
        }
        configuration.push_back(EGL_NONE);
        EGLint count = 0;
        require(choose_config(display, configuration.data(), &config, 1, &count) && count == 1,
                "Failed to select probe EGL configuration.");
        const EGLint context_attributes[] = {EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE};
        context = create_context(display, config, EGL_NO_CONTEXT, context_attributes);
        require(context != EGL_NO_CONTEXT, "Failed to create probe EGL context.");
        EGLAttrib egl_device = 0, d3d_device = 0;
        auto query_display = proc<PFNEGLQUERYDISPLAYATTRIBEXTPROC>("eglQueryDisplayAttribEXT");
        auto query_device = proc<PFNEGLQUERYDEVICEATTRIBEXTPROC>("eglQueryDeviceAttribEXT");
        require(query_display(display, EGL_DEVICE_EXT, &egl_device), "Missing probe EGL device.");
        require(query_device(reinterpret_cast<EGLDeviceEXT>(egl_device), EGL_D3D11_DEVICE_ANGLE,
                             &d3d_device), "Missing probe D3D11 device.");
        device = reinterpret_cast<ID3D11Device*>(d3d_device);
        device->GetImmediateContext(&commands);
        finish = proc<PFNGLFINISHPROC>("glFinish");
    }

    template<class T> T proc(const char* name) {
        auto pointer = get_proc(name);
        if (!pointer) pointer = reinterpret_cast<__eglMustCastToProperFunctionPointerType>(
            GetProcAddress(glesLibrary->value, name));
        require(pointer != nullptr, "Missing probe EGL or GL procedure.");
        return reinterpret_cast<T>(pointer);
    }

    void resize(UINT width, UINT height) {
        ComPtr<ID3D11Texture2D> next_target;
        D3D11_TEXTURE2D_DESC description{};
        description.Width = width;
        description.Height = height;
        description.MipLevels = description.ArraySize = 1;
        description.Format = target_format;
        description.SampleDesc.Count = 1;
        description.Usage = D3D11_USAGE_DEFAULT;
        description.BindFlags = D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE;
        require(SUCCEEDED(device->CreateTexture2D(&description, nullptr, &next_target)),
                "Failed to allocate probe render target.");
        if (direct) { target = next_target; return; }
        const EGLint attributes[] = {EGL_NONE};
        auto next_surface = create_surface(display, EGL_D3D_TEXTURE_ANGLE,
                                 reinterpret_cast<EGLClientBuffer>(next_target.Get()), config, attributes);
        require(next_surface != EGL_NO_SURFACE, "Failed to bind probe D3D target to EGL.");
        if (!make_current(display, next_surface, next_surface, context)) {
            destroy_surface(display, next_surface);
            throw ProbeFailure("Failed to bind probe context.");
        }
        if (surface != EGL_NO_SURFACE) destroy_surface(display, surface);
        surface = next_surface;
        target = next_target;
    }

    void attach() {
        if (direct) return;
        require(make_current(display, surface, surface, context), "Failed to restore probe context.");
    }

    void detach() {
        if (direct) { commands->Flush(); return; }
        finish();
        require(make_current(display, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT),
                "Failed to finish probe surface.");
    }

    ~Graphics() {
        if (direct) { commands->ClearState(); commands->Flush(); }
        if (display != EGL_NO_DISPLAY) {
            make_current(display, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
            if (surface != EGL_NO_SURFACE) destroy_surface(display, surface);
            if (context != EGL_NO_CONTEXT) destroy_context(display, context);
            terminate(display);
        }
    }
};

struct Core {
    Api& api;
    mpv_handle* handle;
    mpv_render_context* renderer = nullptr;
    std::atomic<bool> updated{false};
    Graphics* render_graphics = nullptr;
    explicit Core(Api& api) : api(api), handle(api.create()) {
        require(handle != nullptr, "Failed to create graphics probe core.");
    }
    void set(const char* name, const char* value) {
        require(api.option(handle, name, value) >= 0, "Failed to set graphics probe option.");
    }
    void create_renderer(Graphics& graphics, bool gpu_next = false) {
        render_graphics = &graphics;
        auto get_proc = [](void* context, const char* name) -> void* {
            auto& graphics = *static_cast<Graphics*>(context);
            auto pointer = graphics.get_proc(name);
            if (!pointer) pointer = reinterpret_cast<__eglMustCastToProperFunctionPointerType>(
                GetProcAddress(graphics.glesLibrary->value, name));
            return reinterpret_cast<void*>(pointer);
        };
        mpv_opengl_init_params gl{get_proc, &graphics};
        int advanced = 1;
        const char* api_type = gpu_next ? "opengl-next" : "opengl";
        mpv_render_param parameters[] = {{MPV_RENDER_PARAM_API_TYPE, const_cast<char*>(api_type)},
            {MPV_RENDER_PARAM_OPENGL_INIT_PARAMS, &gl}, {MPV_RENDER_PARAM_ADVANCED_CONTROL, &advanced},
            {MPV_RENDER_PARAM_INVALID, nullptr}};
        int result;
        if (graphics.direct) {
            mpv_d3d11_init_params d3d{graphics.device.Get()};
            mpv_render_param direct_parameters[] = {
                {MPV_RENDER_PARAM_API_TYPE, const_cast<char*>(MPV_RENDER_API_TYPE_D3D11)},
                {MPV_RENDER_PARAM_D3D11_INIT_PARAMS, &d3d},
                {MPV_RENDER_PARAM_ADVANCED_CONTROL, &advanced}, {MPV_RENDER_PARAM_INVALID, nullptr}};
            result = api.render_create(&renderer, handle, direct_parameters);
        } else {
            result = api.render_create(&renderer, handle, parameters);
        }
        if (result < 0) throw ProbeFailure("Failed to create graphics probe renderer: " + std::to_string(result));
        api.render_callback(renderer, [](void* pointer) {
            static_cast<Core*>(pointer)->updated.store(true);
        }, this);
    }
    void render(int width, int height, bool wait_for_target = false) {
        const bool floating = render_graphics->target_format == DXGI_FORMAT_R16G16B16A16_FLOAT;
        mpv_opengl_fbo framebuffer{0, width, height, floating ? GL_RGBA16F : GL_RGBA8};
        int flip = 0, block = wait_for_target ? 1 : 0;
        int depth = floating ? 16 : 8;
        mpv_render_param parameters[] = {{MPV_RENDER_PARAM_OPENGL_FBO, &framebuffer},
            {MPV_RENDER_PARAM_FLIP_Y, &flip}, {MPV_RENDER_PARAM_BLOCK_FOR_TARGET_TIME, &block},
            {MPV_RENDER_PARAM_DEPTH, &depth},
            {MPV_RENDER_PARAM_INVALID, nullptr}};
        if (render_graphics->direct) {
            render_graphics->commands->ClearState();
            mpv_d3d11_fbo target{render_graphics->target.Get()};
            mpv_render_param direct_parameters[] = {{MPV_RENDER_PARAM_D3D11_FBO, &target},
                {MPV_RENDER_PARAM_FLIP_Y, &flip}, {MPV_RENDER_PARAM_BLOCK_FOR_TARGET_TIME, &block},
                {MPV_RENDER_PARAM_INVALID, nullptr}};
            require(api.render(renderer, direct_parameters) >= 0, "Direct D3D11 probe render failed.");
        } else {
            require(api.render(renderer, parameters) >= 0, "Graphics probe render failed.");
        }
    }
    void close() {
        if (renderer) { api.render_free(renderer); renderer = nullptr; }
        if (handle) { api.destroy(handle); handle = nullptr; }
    }
    void skip() {
        int skip_rendering = 1, block = 1;
        mpv_render_param parameters[] = {{MPV_RENDER_PARAM_SKIP_RENDERING, &skip_rendering},
            {MPV_RENDER_PARAM_BLOCK_FOR_TARGET_TIME, &block}, {MPV_RENDER_PARAM_INVALID, nullptr}};
        require(api.render(renderer, parameters) >= 0, "Failed to advance skipped probe frame.");
    }
    void wait_command(uint64_t id) {
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(3);
        for (;;) {
            require(std::chrono::steady_clock::now() < deadline, "Probe control reply did not arrive.");
            if (updated.exchange(false)) api.update(renderer);
            auto* event = api.wait(handle, 0);
            if (event->event_id == MPV_EVENT_COMMAND_REPLY && event->reply_userdata == id) {
                require(event->error >= 0, "Probe control command failed.");
                return;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    }
    std::string text_property(const char* name) {
        require(api.get(handle, 99, name, MPV_FORMAT_STRING) >= 0, "Probe property submission failed.");
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(3);
        for (;;) {
            require(std::chrono::steady_clock::now() < deadline, "Probe property reply did not arrive.");
            if (updated.exchange(false)) api.update(renderer);
            auto* event = api.wait(handle, 0);
            if (event->event_id == MPV_EVENT_GET_PROPERTY_REPLY && event->reply_userdata == 99) {
                require(event->error >= 0, "Probe property read failed.");
                auto* property = static_cast<mpv_event_property*>(event->data);
                require(property && property->format == MPV_FORMAT_STRING && property->data,
                        "Unexpected probe property format.");
                return *static_cast<char**>(property->data);
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    }
    ~Core() { close(); }
};

struct FrameInfo {
    uint32_t width, height, vendor, device, luid_low;
    int32_t luid_high;
    uint64_t flags;
    int64_t target_time;
    int64_t screenshot_width, screenshot_height, screenshot_stride;
    uint64_t screenshot_bytes;
    uint32_t renderer_before_initialize, startup_script, core_destroyed;
    uint32_t raw_vo_change_succeeded, gray_before_change, gray_after_change, direct_d3d11, pixel_bytes, target_mode;
};

struct Frame {
    HMODULE d3d_module = LoadLibraryExW(L"d3d11.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
    HMODULE dxgi_module = LoadLibraryExW(L"dxgi.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
    ComPtr<ID3D11Device> device;
    ComPtr<ID3D11Texture2D> texture;
    HANDLE shared = nullptr;
    FrameInfo info{};
    std::vector<uint8_t> screenshot;
    std::string screenshot_format;
    ~Frame() {
        if (shared) CloseHandle(shared);
        texture.Reset();
        device.Reset();
        if (d3d_module) FreeLibrary(d3d_module);
        if (dxgi_module) FreeLibrary(dxgi_module);
    }

    std::vector<uint8_t> pixels() {
        D3D11_TEXTURE2D_DESC description{};
        texture->GetDesc(&description);
        description.Usage = D3D11_USAGE_STAGING;
        description.BindFlags = description.MiscFlags = 0;
        description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
        ComPtr<ID3D11Texture2D> staging;
        require(SUCCEEDED(device->CreateTexture2D(&description, nullptr, &staging)),
                "Failed to allocate probe readback.");
        ComPtr<ID3D11DeviceContext> commands;
        device->GetImmediateContext(&commands);
        commands->CopyResource(staging.Get(), texture.Get());
        D3D11_MAPPED_SUBRESOURCE mapped{};
        require(SUCCEEDED(commands->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &mapped)),
                "Failed to read probe texture.");
        std::vector<uint8_t> bytes(size_t(info.width) * info.height * info.pixel_bytes);
        for (UINT row = 0; row < info.height; row++) {
            std::memcpy(bytes.data() + size_t(row) * info.width * info.pixel_bytes,
                        static_cast<const uint8_t*>(mapped.pData) + size_t(row) * mapped.RowPitch,
                        size_t(info.width) * info.pixel_bytes);
        }
        commands->Unmap(staging.Get(), 0);
        return bytes;
    }
};

static std::unique_ptr<Frame> capture(Graphics& graphics, const mpv_render_frame_info& timing) {
    graphics.detach();
    auto frame = std::make_unique<Frame>();
    frame->device = graphics.device;
    D3D11_TEXTURE2D_DESC description{};
    graphics.target->GetDesc(&description);
    description.MiscFlags = D3D11_RESOURCE_MISC_SHARED_NTHANDLE | D3D11_RESOURCE_MISC_SHARED;
    require(SUCCEEDED(graphics.device->CreateTexture2D(&description, nullptr, &frame->texture)),
            "Failed to allocate shared probe texture.");
    graphics.commands->CopyResource(frame->texture.Get(), graphics.target.Get());
    frame->info.width = description.Width;
    frame->info.height = description.Height;
    frame->info.pixel_bytes = description.Format == DXGI_FORMAT_R16G16B16A16_FLOAT ? 8 : 4;
    frame->info.flags = timing.flags;
    frame->info.target_time = timing.target_time;
    // Readback completion also fences the preceding immutable GPU copy.
    frame->pixels();
    ComPtr<IDXGIResource1> resource;
    require(SUCCEEDED(frame->texture.As(&resource)), "Missing probe shared-resource interface.");
    require(SUCCEEDED(resource->CreateSharedHandle(nullptr, DXGI_SHARED_RESOURCE_READ, nullptr,
                                                  &frame->shared)), "Failed to export probe NT handle.");
    ComPtr<IDXGIDevice> dxgi_device;
    ComPtr<IDXGIAdapter> adapter;
    DXGI_ADAPTER_DESC adapter_description{};
    require(SUCCEEDED(graphics.device.As(&dxgi_device)), "Missing probe DXGI device.");
    require(SUCCEEDED(dxgi_device->GetAdapter(&adapter)), "Missing probe DXGI adapter.");
    require(SUCCEEDED(adapter->GetDesc(&adapter_description)), "Missing probe adapter description.");
    frame->info.vendor = adapter_description.VendorId;
    frame->info.device = adapter_description.DeviceId;
    frame->info.luid_low = adapter_description.AdapterLuid.LowPart;
    frame->info.luid_high = adapter_description.AdapterLuid.HighPart;
    graphics.attach();
    return frame;
}

static const mpv_node* member(const mpv_node& map, const char* name) {
    require(map.format == MPV_FORMAT_NODE_MAP, "Unexpected probe screenshot result.");
    for (int index = 0; index < map.u.list->num; index++) {
        if (!std::strcmp(map.u.list->keys[index], name)) return &map.u.list->values[index];
    }
    throw ProbeFailure("Missing probe screenshot member.");
}

static int64_t integer(const mpv_node& map, const char* name) {
    const auto* value = member(map, name);
    require(value->format == MPV_FORMAT_INT64, "Unexpected probe screenshot integer.");
    return value->u.int64;
}

static void copy_screenshot(Frame& frame, const mpv_node& map) {
    frame.info.screenshot_width = integer(map, "w");
    frame.info.screenshot_height = integer(map, "h");
    frame.info.screenshot_stride = integer(map, "stride");
    const auto* format = member(map, "format");
    const auto* data = member(map, "data");
    require(format->format == MPV_FORMAT_STRING && data->format == MPV_FORMAT_BYTE_ARRAY,
            "Unexpected probe screenshot data.");
    frame.screenshot_format = format->u.string;
    const int bytes_per_pixel = frame.screenshot_format == "rgba64" ? 8 : 4;
    require(frame.info.screenshot_width > 0 && frame.info.screenshot_height > 0 &&
            frame.info.screenshot_width <= 16384 && frame.info.screenshot_height <= 16384 &&
            frame.info.screenshot_stride >= frame.info.screenshot_width * bytes_per_pixel &&
            frame.info.screenshot_stride <= 16384 * 8,
            "Unsafe screenshot layout in graphics probe.");
    require(data->u.ba->size == uint64_t(frame.info.screenshot_stride) * frame.info.screenshot_height &&
            data->u.ba->size <= 128 * 1024 * 1024,
            "Unsafe screenshot byte range in graphics probe.");
    frame.info.screenshot_bytes = data->u.ba->size;
    const auto* bytes = static_cast<const uint8_t*>(data->u.ba->data);
    frame.screenshot.assign(bytes, bytes + data->u.ba->size);
}

extern "C" int probe_produce(const wchar_t* dll, const wchar_t* angle, const char* media,
                              const char* script, int before_initialize, int direct_d3d11, int target_mode, int gpu_next, void** first, void** second,
                              char* error, size_t error_capacity) {
    try {
        require(!gpu_next || !direct_d3d11, "The gpu-next probe uses the OpenGL entry point.");
        Api api(dll);
        Graphics graphics(angle, direct_d3d11 != 0, target_mode == 1 || target_mode == 2);
        graphics.resize(63, 47);
        Core core(api);
        for (const auto& option : {std::pair{"config", "no"}, {"load-scripts", "no"},
                {"terminal", "no"}, {"idle", "yes"}, {"pause", "yes"}, {"ao", "null"},
                {"osd-level", "0"}, {"osc", "no"},
                {"vo", "libmpv"}, {"hwdec", "no"}, {"keep-open", "yes"},
                {"image-display-duration", "inf"}, {"target-prim", "bt.709"},
                {"target-trc", "srgb"}, {"target-peak", "auto"}, {"treat-srgb-as-power22", "no"},
                {"dither-depth", "no"}}) {
            core.set(option.first, option.second);
        }
        if (target_mode == 1 || target_mode == 2) {
            core.set("target-trc", target_mode == 1 ? "scrgb" : "pq");
            core.set("target-prim", target_mode == 1 ? "bt.709" : "bt.2020");
            core.set("target-peak", "1000");
        }
        if (target_mode == 3) core.set("background", "none");
        if (*script) core.set("scripts", script);
        if (before_initialize) core.create_renderer(graphics, gpu_next != 0);
        require(api.initialize(core.handle) >= 0, "Graphics probe initialization failed.");
        if (!before_initialize) core.create_renderer(graphics, gpu_next != 0);
        if (target_mode == 4) {
            mpv_render_frame_info timing{};
            core.render(63, 47);
            auto original = capture(graphics, timing);
            graphics.resize(31, 23);
            core.render(31, 23);
            auto resized = capture(graphics, timing);
            core.close();
            for (auto* frame : {original.get(), resized.get()}) {
                frame->info.renderer_before_initialize = before_initialize;
                frame->info.core_destroyed = 1;
                frame->info.direct_d3d11 = direct_d3d11;
                frame->info.target_mode = 4;
            }
            *first = original.release();
            *second = resized.release();
            return 0;
        }
        if (!*script) {
            const char* command[] = {"loadfile", media, nullptr};
            require(api.command(core.handle, 1, command) >= 0, "Graphics probe load failed.");
        }
        bool loaded = false, screenshot_requested = false, screenshot_received = false;
        std::unique_ptr<Frame> original;
        mpv_render_frame_info timing{};
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(8);
        while (!screenshot_received) {
            require(std::chrono::steady_clock::now() < deadline, "Graphics probe did not complete.");
            if (core.updated.exchange(false)) {
                if (api.update(core.renderer) & MPV_RENDER_UPDATE_FRAME) {
                    mpv_render_param information{MPV_RENDER_PARAM_NEXT_FRAME_INFO, &timing};
                    require(api.info(core.renderer, information) >= 0, "Missing probe frame timing.");
                    core.render(63, 47);
                    if (timing.flags & MPV_RENDER_FRAME_INFO_PRESENT) original = capture(graphics, timing);
                }
            }
            for (;;) {
                auto* event = api.wait(core.handle, 0);
                if (event->event_id == MPV_EVENT_NONE) break;
                require(event->event_id != MPV_EVENT_SHUTDOWN, "Graphics probe shut down early.");
                if (event->event_id == MPV_EVENT_FILE_LOADED) loaded = true;
                if (event->event_id == MPV_EVENT_COMMAND_REPLY && event->reply_userdata == 2) {
                    require(event->error >= 0, "Graphics probe screenshot failed.");
                    require(original != nullptr, "Missing rendered probe frame.");
                    copy_screenshot(*original, static_cast<mpv_event_command*>(event->data)->result);
                    screenshot_received = true;
                }
            }
            if (loaded && original && !screenshot_requested) {
                const char* command[] = {"screenshot-raw", "video", nullptr};
                require(api.command(core.handle, 2, command) >= 0, "Probe screenshot submission failed.");
                screenshot_requested = true;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
        const auto original_pixels = original->pixels();
        graphics.resize(31, 23);
        core.render(31, 23);
        auto resized = capture(graphics, timing);
        require(original->pixels() == original_pixels, "Held probe frame changed after resize.");
        uint32_t gray_before = 0, gray_after = 0;
        if (target_mode == 0) {
        gray_before = original_pixels[(size_t(47 / 2) * 63 + 63 / 2) * 4];
        const char* change_color[] = {"set", "target-trc", "linear", nullptr};
        require(api.command(core.handle, 3, change_color) >= 0, "Probe color change submission failed.");
        core.wait_command(3);
        require(core.text_property("target-trc") == "linear", "Probe color setting did not change.");
        core.render(31, 23);
        auto changed_color = capture(graphics, timing);
        const auto changed_pixels = changed_color->pixels();
        gray_after = changed_pixels[(size_t(23 / 2) * 31 + 31 / 2) * 4];
        if (!(gray_after > 0 && gray_after + 20 < gray_before && gray_before < 255)) {
            char message[128];
            snprintf(message, sizeof(message), "Unexpected probe gray values: before=%u after=%u.",
                     unsigned(gray_before), unsigned(gray_after));
            throw ProbeFailure(message);
        }
        }
        const char* change_output[] = {"set", "vo", "null", nullptr};
        require(api.command(core.handle, 4, change_output) >= 0, "Probe output change submission failed.");
        core.wait_command(4);
        require(core.text_property("current-vo") == "null", "Probe output driver did not change.");
        core.close();
        require(original->pixels() == original_pixels, "Held probe frame changed after core close.");
        for (auto* frame : {original.get(), resized.get()}) {
            frame->info.renderer_before_initialize = before_initialize;
            frame->info.startup_script = *script != 0;
            frame->info.core_destroyed = 1;
            frame->info.raw_vo_change_succeeded = 1;
            frame->info.gray_before_change = gray_before;
            frame->info.gray_after_change = gray_after;
            frame->info.direct_d3d11 = direct_d3d11;
            frame->info.target_mode = target_mode;
        }
        *first = original.release();
        *second = resized.release();
        return 0;
    } catch (const ProbeFailure& failure) {
        snprintf(error, error_capacity, "%s", failure.what());
        return -1;
    } catch (...) {
        snprintf(error, error_capacity, "Graphics probe failed internally.");
        return -1;
    }
}

extern "C" void probe_frame_info(void* pointer, FrameInfo* result) {
    *result = static_cast<Frame*>(pointer)->info;
}

extern "C" uint64_t probe_frame_handle(void* pointer) {
    return reinterpret_cast<uintptr_t>(static_cast<Frame*>(pointer)->shared);
}

extern "C" int probe_frame_pixels(void* pointer, uint8_t* output, size_t size) {
    try {
        const auto bytes = static_cast<Frame*>(pointer)->pixels();
        if (bytes.size() != size) return -1;
        std::memcpy(output, bytes.data(), size);
        return 0;
    } catch (...) { return -1; }
}

extern "C" size_t probe_screenshot(void* pointer, uint8_t* output, size_t capacity,
                                    char* format, size_t format_capacity) {
    auto& frame = *static_cast<Frame*>(pointer);
    snprintf(format, format_capacity, "%s", frame.screenshot_format.c_str());
    if (capacity >= frame.screenshot.size()) std::memcpy(output, frame.screenshot.data(), frame.screenshot.size());
    return frame.screenshot.size();
}

extern "C" void probe_release_frame(void* pointer) { delete static_cast<Frame*>(pointer); }

extern "C" int probe_angle_loaded() {
    return GetModuleHandleW(L"libEGL.dll") != nullptr || GetModuleHandleW(L"libGLESv2.dll") != nullptr;
}

struct PressureInfo {
    uint32_t capacity, produced, skipped, stable;
    double max_position, elapsed;
    int64_t first_target_raw, clock_at_target_ns, clock_at_target_us;
    char audio_codec[128];
};

extern "C" int probe_pressure(const wchar_t* dll, const char* media, uint32_t capacity,
                                PressureInfo* result, char* error, size_t error_capacity) {
    try {
        require(capacity > 0 && capacity <= 3, "Invalid probe frame capacity.");
        Api api(dll);
        Graphics graphics(L"", true);
        graphics.resize(64, 48);
        Core core(api);
        for (const auto& option : {std::pair{"config", "no"}, {"load-scripts", "no"},
                {"terminal", "no"}, {"idle", "yes"}, {"pause", "no"}, {"ao", "null"},
                {"vo", "libmpv"}, {"hwdec", "no"}, {"keep-open", "no"},
                {"osd-level", "0"}, {"osc", "no"}, {"video-sync", "audio"}}) {
            core.set(option.first, option.second);
        }
        core.create_renderer(graphics);
        require(api.initialize(core.handle) >= 0, "Pressure probe initialization failed.");
        require(api.observe(core.handle, 10, "time-pos", MPV_FORMAT_DOUBLE) >= 0,
                "Pressure probe position observation failed.");
        require(api.observe(core.handle, 11, "audio-codec-name", MPV_FORMAT_STRING) >= 0,
                "Pressure probe audio observation failed.");
        const char* command[] = {"loadfile", media, nullptr};
        const auto start = api.now(core.handle);
        require(api.command(core.handle, 1, command) >= 0, "Pressure probe loading failed.");
        bool ended = false;
        PressureInfo stats{};
        stats.capacity = capacity;
        std::vector<std::unique_ptr<Frame>> held;
        std::vector<std::vector<uint8_t>> original;
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(8);
        while (!ended) {
            require(std::chrono::steady_clock::now() < deadline, "Pressure probe did not complete.");
            if (core.updated.exchange(false) && (api.update(core.renderer) & MPV_RENDER_UPDATE_FRAME)) {
                mpv_render_frame_info timing{};
                require(api.info(core.renderer, {MPV_RENDER_PARAM_NEXT_FRAME_INFO, &timing}) >= 0,
                        "Pressure probe timing query failed.");
                if (!stats.first_target_raw && timing.target_time > 0) {
                    stats.first_target_raw = timing.target_time;
                    stats.clock_at_target_ns = api.now(core.handle);
                    auto clock_us = api.library.get<decltype(&mpv_get_time_us)>("mpv_get_time_us");
                    stats.clock_at_target_us = clock_us(core.handle);
                }
                if (held.size() < capacity) {
                    core.render(64, 48, true);
                    auto frame = capture(graphics, timing);
                    original.push_back(frame->pixels());
                    held.push_back(std::move(frame));
                    stats.produced++;
                } else {
                    core.skip();
                    stats.skipped++;
                }
            }
            for (;;) {
                auto* event = api.wait(core.handle, 0);
                if (event->event_id == MPV_EVENT_NONE) break;
                if (event->event_id == MPV_EVENT_PROPERTY_CHANGE) {
                    auto* property = static_cast<mpv_event_property*>(event->data);
                    if (event->reply_userdata == 10 && property->format == MPV_FORMAT_DOUBLE)
                        stats.max_position = std::max(stats.max_position, *static_cast<double*>(property->data));
                    if (event->reply_userdata == 11 && property->format == MPV_FORMAT_STRING)
                        snprintf(stats.audio_codec, sizeof(stats.audio_codec), "%s", *static_cast<char**>(property->data));
                }
                if (event->event_id == MPV_EVENT_END_FILE) {
                    auto* end = static_cast<mpv_event_end_file*>(event->data);
                    require(end->reason == MPV_END_FILE_REASON_EOF && end->error == 0,
                            "Pressure probe playback failed.");
                    ended = true;
                }
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
        stats.elapsed = double(api.now(core.handle) - start) / 1e9;
        core.close();
        for (size_t index = 0; index < held.size(); index++)
            require(held[index]->pixels() == original[index], "Held pressure probe frame changed.");
        stats.stable = 1;
        require(stats.produced == capacity && stats.skipped > 0 && stats.max_position >= 1.0 &&
                stats.elapsed >= 1.0 && stats.elapsed < 6.0 && stats.audio_codec[0] && stats.first_target_raw,
                "Pressure probe did not retain clock and bounded-frame behavior.");
        *result = stats;
        return 0;
    } catch (const ProbeFailure& failure) {
        snprintf(error, error_capacity, "%s", failure.what());
        return -1;
    } catch (...) {
        snprintf(error, error_capacity, "Pressure probe failed internally.");
        return -1;
    }
}

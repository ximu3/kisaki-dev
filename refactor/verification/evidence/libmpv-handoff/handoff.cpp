// Isolated live callback experiment. The existing renderer helper remains unchanged.
#include "../libmpv-gpu/producer.cpp"
#include <deque>
#include <mutex>
#include <set>

struct HandoffNotice {
    uint32_t channel, kind;
    int32_t event, error, reason;
    uint64_t order, request, token, flags;
    int64_t entry;
    double value;
    void* frame;
};
using EmitNotice = int (*)(void*, const HandoffNotice*);
struct HandoffCounters {
    std::atomic<uint32_t> live{0}, created{0}, released{0}, max_live{0}, skipped{0};
};
struct HandoffLease {
    std::unique_ptr<Frame> frame;
    std::shared_ptr<HandoffCounters> counters;
    ~HandoffLease() {
        counters->released++;
        counters->live--;
    }
};
struct HandoffCommand { std::string action, text; uint64_t id; double value; };
struct HandoffSession {
    std::mutex mutex;
    std::deque<HandoffCommand> commands;
    std::shared_ptr<HandoffCounters> counters = std::make_shared<HandoffCounters>();
    std::atomic<bool> stopping{false}, running{false}, finished{false};
    std::atomic<uint32_t> native_closed{0}, hook_count{0};
};
struct HandoffStats {
    uint32_t live, created, released, max_live, skipped, native_closed, hook_count;
};
// Readback is a test oracle and shares the immediate context with the worker.
static std::mutex handoff_gpu_mutex;

extern "C" void* handoff_new() {
    try { return new HandoffSession(); } catch (...) { return nullptr; }
}
extern "C" void handoff_free(void* pointer) { delete static_cast<HandoffSession*>(pointer); }
extern "C" int handoff_enqueue(void* pointer, const char* action, uint64_t id,
                                const char* text, double value) {
    try {
        auto& session = *static_cast<HandoffSession*>(pointer);
        std::lock_guard lock(session.mutex);
        if (session.finished || session.stopping || session.commands.size() >= 32) return -1;
        if (std::string(action) == "stop") session.stopping = true;
        else session.commands.push_back({action, text, id, value});
        return 0;
    } catch (...) { return -1; }
}
extern "C" void handoff_stats(void* pointer, HandoffStats* output) {
    auto& session = *static_cast<HandoffSession*>(pointer);
    auto& c = *session.counters;
    *output = {c.live, c.created, c.released, c.max_live, c.skipped,
               session.native_closed, session.hook_count};
}
extern "C" void handoff_release(void* pointer) {
    std::lock_guard lock(handoff_gpu_mutex);
    delete static_cast<HandoffLease*>(pointer);
}
extern "C" uint64_t handoff_handle(void* pointer) {
    return reinterpret_cast<uint64_t>(static_cast<HandoffLease*>(pointer)->frame->shared);
}
extern "C" uint64_t handoff_luid(void* pointer) {
    const auto& info = static_cast<HandoffLease*>(pointer)->frame->info;
    return (uint64_t(uint32_t(info.luid_high)) << 32) | info.luid_low;
}
extern "C" int handoff_pixels(void* pointer, uint8_t* output, size_t capacity) {
    try {
        std::lock_guard lock(handoff_gpu_mutex);
        const auto bytes = static_cast<HandoffLease*>(pointer)->frame->pixels();
        require(bytes.size() == capacity, "Invalid handoff readback size.");
        std::memcpy(output, bytes.data(), bytes.size());
        return 0;
    } catch (...) { return -1; }
}

extern "C" int handoff_run(void* pointer, const wchar_t* dll, int render_first,
                            void* context, EmitNotice emit, char* error, size_t error_size) {
    auto& session = *static_cast<HandoffSession*>(pointer);
    if (session.running.exchange(true)) return -1;
    try {
        Api api(dll);
        Graphics graphics(L"", true);
        graphics.resize(64, 48);
        Core core(api);
        for (const auto& option : {std::pair{"config", "no"}, {"load-scripts", "no"},
                {"terminal", "no"}, {"idle", "yes"}, {"pause", "yes"}, {"ao", "null"},
                {"osd-level", "0"}, {"osc", "no"}, {"vo", "libmpv"}, {"hwdec", "no"},
                {"keep-open", "yes"}, {"target-prim", "bt.709"}, {"target-trc", "srgb"},
                {"target-peak", "auto"}, {"treat-srgb-as-power22", "no"},
                {"background", "color"}, {"background-color", "#000000"}, {"dither-depth", "no"}})
            core.set(option.first, option.second);
        core.create_renderer(graphics);
        require(api.initialize(core.handle) >= 0, "Handoff core initialization failed.");
        auto create_client = api.library.get<decltype(&mpv_create_weak_client)>("mpv_create_weak_client");
        auto destroy_client = api.library.get<decltype(&mpv_destroy)>("mpv_destroy");
        auto add_hook = api.library.get<decltype(&mpv_hook_add)>("mpv_hook_add");
        auto continue_hook = api.library.get<decltype(&mpv_hook_continue)>("mpv_hook_continue");
        struct Client {
            mpv_handle* handle;
            decltype(&mpv_destroy) destroy;
            ~Client() { if (handle) destroy(handle); }
            void close() { if (handle) { destroy(handle); handle = nullptr; } }
        } hook{create_client(core.handle, "handoff-hook"), destroy_client},
          observer{create_client(core.handle, "handoff-observer"), destroy_client};
        require(hook.handle && observer.handle, "Handoff client initialization failed.");
        require(add_hook(hook.handle, 1, "on_before_start_file", 0) >= 0,
                "Handoff hook registration failed.");
        require(api.observe(observer.handle, 2, "playlist-entry-id", MPV_FORMAT_INT64) >= 0,
                "Handoff observation failed.");
        std::atomic<uint64_t> order{0};
        uint64_t token = 0;
        int64_t entry = -1;
        std::set<uint64_t> pending_hooks;
        auto send = [&](HandoffNotice notice) {
            notice.order = ++order;
            require(emit(context, &notice) == 0, "Handoff callback delivery failed.");
        };
        auto render = [&] {
            if (!core.updated.exchange(false)) return;
            if (!(api.update(core.renderer) & MPV_RENDER_UPDATE_FRAME)) return;
            if (token == 0 || session.counters->live >= 4) {
                core.skip();
                session.counters->skipped++;
                return;
            }
            mpv_render_frame_info timing{};
            require(api.info(core.renderer, {MPV_RENDER_PARAM_NEXT_FRAME_INFO, &timing}) >= 0,
                    "Handoff timing unavailable.");
            std::unique_ptr<Frame> frame;
            {
                std::lock_guard lock(handoff_gpu_mutex);
                core.render(64, 48);
                frame = capture(graphics, timing);
            }
            auto* lease = new HandoffLease{std::move(frame), session.counters};
            const auto live = ++session.counters->live;
            session.counters->created++;
            session.counters->max_live = std::max(session.counters->max_live.load(), live);
            // The token identifies a delivery subscription, never a source file.
            send({1, 1, 0, 0, 0, 0, 0, token, timing.flags, -1, 0, lease});
        };
        std::mutex render_commands_mutex;
        std::deque<uint64_t> render_commands;
        std::atomic<bool> render_stopping{false};
        std::exception_ptr render_failure;
        std::thread render_thread([&] {
            try {
                while (!render_stopping) {
                    std::deque<uint64_t> updates;
                    {
                        std::lock_guard lock(render_commands_mutex);
                        updates.swap(render_commands);
                    }
                    for (auto next : updates) {
                        token = next;
                        if (next == 0) {
                            unsigned drained = 0;
                            while (core.updated.load()) {
                                require(++drained < 256, "Handoff drain exceeded its bound.");
                                render();
                            }
                        }
                        // The barrier follows earlier frames on this same callback channel.
                        send({1, 3, 0, 0, 0, 0, next});
                    }
                    render();
                    std::this_thread::sleep_for(std::chrono::milliseconds(render_first ? 1 : 3));
                }
            } catch (...) {
                render_failure = std::current_exception();
                session.stopping = true;
            }
        });
        struct RenderCleanup {
            std::thread& thread;
            std::atomic<bool>& stopping;
            Core& core;
            void close() {
                stopping = true;
                if (thread.joinable()) thread.join();
                std::lock_guard lock(handoff_gpu_mutex);
                if (core.renderer) {
                    core.api.render_free(core.renderer);
                    core.renderer = nullptr;
                }
            }
            ~RenderCleanup() { close(); }
        } render_cleanup{render_thread, render_stopping, core};
        send({0, 4});
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(25);
        while (!session.stopping) {
            require(std::chrono::steady_clock::now() < deadline, "Handoff worker timed out.");
            std::deque<HandoffCommand> commands;
            {
                std::lock_guard lock(session.mutex);
                commands.swap(session.commands);
            }
            for (const auto& command : commands) {
                if (command.action == "subscription") {
                    std::lock_guard lock(render_commands_mutex);
                    require(render_commands.size() < 32, "Handoff render command limit exceeded.");
                    render_commands.push_back(command.id);
                } else if (command.action == "continue") {
                    require(pending_hooks.erase(command.id) == 1, "Unknown handoff hook.");
                    require(continue_hook(hook.handle, command.id) >= 0, "Handoff continuation failed.");
                } else if (command.action == "load") {
                    const char* args[] = {"loadfile", command.text.c_str(), "replace", nullptr};
                    require(api.command(core.handle, command.id, args) >= 0, "Handoff load submission failed.");
                } else if (command.action == "seek") {
                    const char* args[] = {"seek", command.text.c_str(), "absolute+exact", nullptr};
                    require(api.command(core.handle, command.id, args) >= 0, "Handoff seek submission failed.");
                } else if (command.action == "pause") {
                    const char* args[] = {"set", "pause", command.text.c_str(), nullptr};
                    require(api.command(core.handle, command.id, args) >= 0, "Handoff pause submission failed.");
                } else if (command.action == "position") {
                    require(api.get(core.handle, command.id, "time-pos", MPV_FORMAT_DOUBLE) >= 0,
                            "Handoff position request failed.");
                } else { throw ProbeFailure("Unknown handoff command."); }
            }
            for (auto* client : {core.handle, observer.handle}) {
                for (;;) {
                    auto* event = api.wait(client, 0);
                    if (event->event_id == MPV_EVENT_NONE) break;
                    HandoffNotice notice{0, 2, event->event_id, event->error};
                    notice.request = event->reply_userdata;
                    if (client == core.handle && event->event_id == MPV_EVENT_START_FILE)
                        entry = static_cast<mpv_event_start_file*>(event->data)->playlist_entry_id;
                    notice.entry = entry;
                    if (event->event_id == MPV_EVENT_END_FILE) {
                        const auto* data = static_cast<mpv_event_end_file*>(event->data);
                        notice.entry = data->playlist_entry_id;
                        notice.error = data->error;
                        notice.reason = data->reason;
                    }
                    if (event->event_id == MPV_EVENT_GET_PROPERTY_REPLY && event->error >= 0) {
                        const auto* property = static_cast<mpv_event_property*>(event->data);
                        if (property && property->format == MPV_FORMAT_DOUBLE && property->data)
                            notice.value = *static_cast<double*>(property->data);
                    }
                    if (client == observer.handle) {
                        if (event->event_id != MPV_EVENT_PROPERTY_CHANGE) continue;
                        notice.kind = 5;
                        const auto* property = static_cast<mpv_event_property*>(event->data);
                        notice.entry = property && property->format == MPV_FORMAT_INT64 && property->data
                            ? *static_cast<int64_t*>(property->data) : -1;
                    }
                    send(notice);
                }
            }
            for (;;) {
                auto* event = api.wait(hook.handle, 0);
                if (event->event_id == MPV_EVENT_NONE) break;
                if (event->event_id != MPV_EVENT_HOOK) continue;
                const auto* data = static_cast<mpv_event_hook*>(event->data);
                pending_hooks.insert(data->id);
                session.hook_count++;
                send({2, 6, event->event_id, 0, 0, 0, data->id});
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(render_first ? 3 : 1));
        }
        // Destroying the private client also continues a pending hook during cleanup.
        hook.close();
        observer.close();
        render_cleanup.close();
        core.close();
        session.native_closed = 1;
        session.finished = true;
        if (render_failure) std::rethrow_exception(render_failure);
        require(!probe_angle_loaded(), "Handoff production unexpectedly loaded ANGLE.");
        return 0;
    } catch (const std::exception& failure) {
        session.finished = true;
        if (error_size) {
            std::strncpy(error, failure.what(), error_size - 1);
            error[error_size - 1] = 0;
        }
        return -1;
    }
}

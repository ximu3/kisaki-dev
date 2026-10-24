// Reuse the pinned graphics experiment without changing its source or receipts.
#include "../libmpv-gpu/producer.cpp"
#include <array>
#include <cmath>
#include <iostream>
#include <map>
#include <set>

struct PlaybackFrame {
    uint64_t order, flags;
    int64_t entry;
    std::unique_ptr<Frame> frame;
    std::vector<uint8_t> pixels;
};

struct PlaybackEvent {
    uint64_t order;
    int type, error, reason;
    int64_t entry;
    std::string hook;
};

struct PlaybackPump {
    Api& api;
    Core& core;
    Graphics& graphics;
    decltype(&mpv_hook_continue) continue_hook;
    bool render_first;
    uint64_t order = 0;
    uint64_t boundary_order = 0;
    int64_t entry = -1;
    std::vector<PlaybackEvent> events;
    std::vector<PlaybackFrame> frames;
    std::map<uint64_t, int> replies;
    std::map<uint64_t, double> values;

    void render() {
        if (!core.updated.exchange(false)) return;
        if (!(api.update(core.renderer) & MPV_RENDER_UPDATE_FRAME)) return;
        mpv_render_frame_info timing{};
        require(api.info(core.renderer, {MPV_RENDER_PARAM_NEXT_FRAME_INFO, &timing}) >= 0,
                "Missing playback frame information.");
        core.render(64, 48);
        auto frame = capture(graphics, timing);
        auto pixels = frame->pixels();
        frames.push_back({++order, timing.flags, entry, std::move(frame), std::move(pixels)});
        require(frames.size() < 256, "Playback probe exceeded its frame limit.");
    }

    void read_events() {
        for (;;) {
            auto* event = api.wait(core.handle, 0);
            if (event->event_id == MPV_EVENT_NONE) break;
            PlaybackEvent record{++order, event->event_id, event->error, -1, entry, {}};
            if (event->event_id == MPV_EVENT_START_FILE) {
                entry = static_cast<mpv_event_start_file*>(event->data)->playlist_entry_id;
                record.entry = entry;
            } else if (event->event_id == MPV_EVENT_END_FILE) {
                auto* data = static_cast<mpv_event_end_file*>(event->data);
                record.entry = data->playlist_entry_id;
                record.reason = data->reason;
                record.error = data->error;
            } else if (event->event_id == MPV_EVENT_COMMAND_REPLY) {
                replies[event->reply_userdata] = event->error;
            } else if (event->event_id == MPV_EVENT_GET_PROPERTY_REPLY) {
                auto* data = static_cast<mpv_event_property*>(event->data);
                require(event->error >= 0 && data && data->format == MPV_FORMAT_DOUBLE && data->data,
                        "Playback property was unavailable.");
                values[event->reply_userdata] = *static_cast<double*>(data->data);
            } else if (event->event_id == MPV_EVENT_HOOK) {
                auto* data = static_cast<mpv_event_hook*>(event->data);
                record.hook = data->name;
                if (record.hook == "on_before_start_file") {
                    // Flush pending old redraw work before allowing the next file to start.
                    render();
                    boundary_order = order;
                    entry = -1;
                }
                require(continue_hook(core.handle, data->id) >= 0, "Failed to continue playback hook.");
            }
            events.push_back(std::move(record));
            require(events.size() < 512, "Playback probe exceeded its event limit.");
        }
    }

    void tick() {
        if (render_first) render();
        read_events();
        if (!render_first) render();
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }

    template<class Predicate> void until(Predicate done) {
        auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
        while (!done()) {
            require(std::chrono::steady_clock::now() < deadline, "Playback stage timed out.");
            tick();
        }
    }

    bool has(int type, uint64_t after) const {
        for (const auto& event : events) if (event.order > after && event.type == type) return true;
        return false;
    }

    void command(uint64_t id, std::initializer_list<const char*> parts) {
        std::vector<const char*> args(parts);
        args.push_back(nullptr);
        require(api.command(core.handle, id, args.data()) >= 0, "Playback command submission failed.");
    }

    size_t ready_frame(uint64_t after) const {
        for (size_t i = frames.size(); i > 0; --i) {
            const auto& frame = frames[i - 1];
            if (frame.order > after && frame.order > boundary_order &&
                (frame.flags & MPV_RENDER_FRAME_INFO_PRESENT) &&
                !(frame.flags & (MPV_RENDER_FRAME_INFO_REDRAW | MPV_RENDER_FRAME_INFO_REPEAT)))
                return i - 1;
        }
        return frames.size();
    }

    size_t load(uint64_t request, const char* path, int channel) {
        const auto before = order;
        command(request, {"loadfile", path, "replace"});
        until([&] {
            return replies.count(request) && has(MPV_EVENT_FILE_LOADED, before) &&
                   has(MPV_EVENT_PLAYBACK_RESTART, before) && ready_frame(before) < frames.size();
        });
        require(replies[request] >= 0, "Load command failed.");
        auto index = ready_frame(before);
        const auto& bytes = frames[index].pixels;
        size_t center = (24 * 64 + 32) * 4;
        require(bytes[center + channel] > 220, "Ready frame belongs to the wrong generated source.");
        for (int i = 0; i < 3; ++i)
            if (i != channel) require(bytes[center + i] < 35, "Ready frame has unexpected source color.");
        require(bytes[center + 3] == 255, "Managed frame is not opaque.");
        return index;
    }
};

static void run_playback_case(const wchar_t* dll, const char* first, const char* second,
                              const char* missing, bool render_first) {
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
    require(api.initialize(core.handle) >= 0, "Playback core initialization failed.");
    auto add_hook = api.library.get<decltype(&mpv_hook_add)>("mpv_hook_add");
    auto continue_hook = api.library.get<decltype(&mpv_hook_continue)>("mpv_hook_continue");
    require(add_hook(core.handle, 1000, "on_before_start_file", 0) >= 0, "Playback hook registration failed.");
    require(add_hook(core.handle, 1001, "on_after_end_file", 0) >= 0, "Playback hook registration failed.");
    PlaybackPump pump{api, core, graphics, continue_hook, render_first};
    auto* original_core = core.handle;
    auto* original_context = core.renderer;
    const size_t first_frame = pump.load(1, first, 2);
    const auto first_entry = pump.entry;
    const auto before_seek = pump.order;
    pump.command(2, {"seek", "0.5", "absolute+exact"});
    pump.until([&] { return pump.replies.count(2) && pump.has(MPV_EVENT_SEEK, before_seek) &&
                           pump.has(MPV_EVENT_PLAYBACK_RESTART, before_seek); });
    require(pump.replies[2] >= 0, "Playback seek failed.");
    require(api.get(core.handle, 50, "time-pos", MPV_FORMAT_DOUBLE) >= 0, "Position read failed.");
    pump.until([&] { return pump.values.count(50); });
    require(std::abs(pump.values[50] - 0.5) < 0.06, "Seek did not reach the requested media position.");
    const size_t second_frame = pump.load(3, second, 0);
    const auto second_entry = pump.entry;
    require(first_entry != second_entry, "Different loads reused a playlist entry identity.");
    const auto before_failure = pump.order;
    pump.command(4, {"loadfile", missing, "replace"});
    pump.until([&] { return pump.replies.count(4) && pump.has(MPV_EVENT_END_FILE, before_failure); });
    bool loading_failed = false;
    for (const auto& event : pump.events)
        if (event.order > before_failure && event.type == MPV_EVENT_END_FILE &&
            event.reason == MPV_END_FILE_REASON_ERROR && event.error < 0) loading_failed = true;
    if (!loading_failed) pump.until([&] {
        for (const auto& event : pump.events)
            if (event.order > before_failure && event.type == MPV_EVENT_END_FILE &&
                event.reason == MPV_END_FILE_REASON_ERROR && event.error < 0) return true;
        return false;
    });
    require(!pump.has(MPV_EVENT_FILE_LOADED, before_failure), "Missing file incorrectly became loaded.");
    const size_t recovery_frame = pump.load(5, first, 2);
    require(core.handle == original_core && core.renderer == original_context,
            "The playback probe replaced its native owners.");
    core.close();
    for (size_t index : {first_frame, second_frame, recovery_frame})
        require(pump.frames[index].frame->pixels() == pump.frames[index].pixels,
                "Previously held content changed after replacement or closure.");
    require(!probe_angle_loaded(), "Direct playback unexpectedly loaded ANGLE.");
    std::cout << "{\"renderFirst\":" << (render_first ? "true" : "false")
              << ",\"sameCore\":true,\"sameRenderContext\":true,\"seekPosition\":" << pump.values[50]
              << ",\"firstEntry\":\"" << first_entry << "\",\"secondEntry\":\"" << second_entry
              << "\",\"failedLoadReply\":" << pump.replies[4]
              << ",\"missingFileFailed\":true,\"recoverySucceeded\":true,\"heldFramesStable\":true,\"events\":[";
    bool comma = false;
    for (const auto& event : pump.events) {
        if (comma) std::cout << ',';
        comma = true;
        std::cout << "{\"order\":" << event.order << ",\"type\":" << event.type
                  << ",\"entry\":\"" << event.entry << "\",\"error\":" << event.error
                  << ",\"reason\":" << event.reason << ",\"hook\":\"" << event.hook << "\"}";
    }
    std::cout << "],\"frames\":[";
    comma = false;
    for (const auto& frame : pump.frames) {
        if (comma) std::cout << ',';
        comma = true;
        const size_t center = (24 * 64 + 32) * 4;
        std::cout << "{\"order\":" << frame.order << ",\"flags\":" << frame.flags << ",\"bgr\":["
                  << int(frame.pixels[center]) << ',' << int(frame.pixels[center + 1]) << ','
                  << int(frame.pixels[center + 2]) << "]}";
    }
    std::cout << "]}";
}

extern "C" int playback_probe(const wchar_t* dll, const char* first, const char* second, const char* missing) {
    try {
        std::cout << "{\"cases\":[";
        run_playback_case(dll, first, second, missing, false);
        std::cout << ',';
        run_playback_case(dll, first, second, missing, true);
        std::cout << "]}" << std::endl;
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << std::endl;
        return 1;
    }
}

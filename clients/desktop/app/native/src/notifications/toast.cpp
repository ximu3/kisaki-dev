#include <windows.h>
#include <notificationactivationcallback.h>
#include <shellapi.h>
#include <wrl.h>
#include <winrt/Windows.Data.Xml.Dom.h>
#include <winrt/Windows.System.Threading.h>
#include <winrt/Windows.UI.Notifications.h>
#include <filesystem>
#include <string>
#include <vector>

namespace {

using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::Make;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;

using Click = void (*)(const char *);

using Completion = void (*)(void *, int);

DWORD registration = 0;

const wchar_t *class_id(std::wstring_view app_id) {
    if (app_id == L"me.kisaki") {
        return L"{FA2B87ED-E2BE-44D5-A0D4-845CE29A35FB}";
    }
    if (app_id == L"me.kisaki.dev") {
        return L"{1982CC5E-9D53-4DDE-B53D-226C1B20E8A9}";
    }
    return nullptr;
}

bool owns_server(const wchar_t *id) {
    const auto key = std::wstring(L"CLSID\\") + id + L"\\LocalServer32";
    DWORD bytes = 0;
    if (RegGetValueW(HKEY_CLASSES_ROOT, key.c_str(), nullptr, RRF_RT_REG_SZ, nullptr, nullptr, &bytes) != ERROR_SUCCESS) {
        return false;
    }
    std::vector<wchar_t> command(bytes / sizeof(wchar_t) + 1);
    if (RegGetValueW(HKEY_CLASSES_ROOT, key.c_str(), nullptr, RRF_RT_REG_SZ, nullptr, command.data(), &bytes) != ERROR_SUCCESS) {
        return false;
    }

    int count = 0;
    auto args = CommandLineToArgvW(command.data(), &count);
    if (!args) {
        return false;
    }
    std::filesystem::path server = count ? args[0] : L"";
    LocalFree(args);
    std::wstring executable(32768, L'\0');
    const auto length = GetModuleFileNameW(nullptr, executable.data(), static_cast<DWORD>(executable.size()));
    if (!length || length == executable.size()) {
        return false;
    }
    executable.resize(length);
    std::error_code error;
    return std::filesystem::equivalent(executable, server, error);
}

class Activator final : public RuntimeClass<RuntimeClassFlags<ClassicCom>, INotificationActivationCallback> {
public:
    Activator(std::wstring app_id, Click receive) : app_id_(std::move(app_id)), receive_(receive) {}

    HRESULT STDMETHODCALLTYPE Activate(LPCWSTR app_id, LPCWSTR arguments,
                                      const NOTIFICATION_USER_INPUT_DATA *, ULONG) noexcept override {
        if (!app_id || app_id_ != app_id || !arguments) {
            return E_INVALIDARG;
        }
        try {
            receive_(winrt::to_string(arguments).c_str());
            return S_OK;
        } catch (...) {
            return winrt::to_hresult();
        }
    }

private:
    std::wstring app_id_;
    Click receive_;
};

class Factory final : public RuntimeClass<RuntimeClassFlags<ClassicCom>, IClassFactory> {
public:
    Factory(std::wstring app_id, Click receive) : app_id_(std::move(app_id)), receive_(receive) {}

    HRESULT STDMETHODCALLTYPE CreateInstance(IUnknown *outer, REFIID iid, void **object) noexcept override {
        if (outer) {
            return CLASS_E_NOAGGREGATION;
        }
        try {
            auto activation = Make<Activator>(app_id_, receive_);
            return activation ? activation->QueryInterface(iid, object) : E_OUTOFMEMORY;
        } catch (...) {
            return winrt::to_hresult();
        }
    }

    HRESULT STDMETHODCALLTYPE LockServer(BOOL) noexcept override { return S_OK; }

private:
    std::wstring app_id_;
    Click receive_;
};

struct Apartment {
    Apartment() { winrt::init_apartment(winrt::apartment_type::multi_threaded); }

    ~Apartment() { winrt::uninit_apartment(); }
};

winrt::fire_and_forget post(winrt::hstring app_id, winrt::hstring identifier, winrt::hstring title,
                            winrt::hstring body, void *context, Completion complete) {
    using namespace winrt::Windows::Data::Xml::Dom;
    using namespace winrt::Windows::UI::Notifications;
    try {
        co_await winrt::resume_background();
        const Apartment apartment;
        const auto notifier = ToastNotificationManager::CreateToastNotifier(app_id);
        if (notifier.Setting() != NotificationSetting::Enabled) {
            complete(context, 0);
            co_return;
        }
        XmlDocument xml;
        xml.LoadXml(L"<toast><visual><binding template='ToastGeneric'><text/><text/></binding></visual></toast>");
        xml.DocumentElement().SetAttribute(L"launch", identifier);
        const auto lines = xml.GetElementsByTagName(L"text");
        lines.Item(0).AppendChild(xml.CreateTextNode(title));
        lines.Item(1).AppendChild(xml.CreateTextNode(body));
        notifier.Show(ToastNotification(xml));
        complete(context, 1);
    } catch (...) {
        complete(context, -1);
    }
}

} // namespace

extern "C" int kisaki_set_notification_receiver(const char *app_id, Click receive) noexcept {
    try {
        if (registration) {
            CoRevokeClassObject(registration);
            registration = 0;
        }
        if (!receive) {
            return 1;
        }
        const auto identity = winrt::to_hstring(app_id);
        const auto id = class_id(identity);
        if (!id || !owns_server(id)) {
            return 0;
        }
        CLSID clsid;
        winrt::check_hresult(CLSIDFromString(id, &clsid));
        const auto factory = Make<Factory>(std::wstring(identity), receive);
        if (!factory) {
            return -1;
        }
        winrt::check_hresult(CoRegisterClassObject(clsid, factory.Get(), CLSCTX_LOCAL_SERVER,
                                                   REGCLS_MULTIPLEUSE, &registration));
        return 1;
    } catch (...) {
        return -1;
    }
}

extern "C" void kisaki_post_notification(const char *app_id, const char *identifier, const char *title,
                                       const char *body, void *context, Completion complete) noexcept {
    try {
        post(winrt::to_hstring(app_id), winrt::to_hstring(identifier), winrt::to_hstring(title),
             winrt::to_hstring(body), context, complete);
    } catch (...) {
        complete(context, -1);
    }
}

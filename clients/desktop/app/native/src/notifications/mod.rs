use napi::threadsafe_function::ThreadsafeFunction;
use napi::{Result, Status};
use napi_derive::napi;

/// A click can arrive on the platform's callback thread before the first window exists.
type Click = ThreadsafeFunction<String, (), String, Status, false, true>;

type Completion = ThreadsafeFunction<bool, (), bool, Status, true, true>;

#[cfg(any(target_os = "macos", windows))]
mod platform;

/// Connects the macOS delegate or registered Windows COM identity, or detaches the receiver at exit.
#[napi(ts_args_type = "appId: string, receive: ((identifier: string) => void) | null")]
pub fn set_notification_receiver(app_id: String, receive: Option<Click>) -> Result<bool> {
    #[cfg(any(target_os = "macos", windows))]
    {
        platform::set_receiver(app_id, receive)
    }
    #[cfg(not(any(target_os = "macos", windows)))]
    {
        drop((app_id, receive));
        Ok(false)
    }
}

/// Submits a system-owned notification whose identifier survives the lifetime of this Node process.
#[napi(
    ts_args_type = "appId: string, identifier: string, title: string, body: string, complete: (error: Error | null, accepted?: boolean) => void"
)]
pub fn post_system_notification(
    app_id: String,
    identifier: String,
    title: String,
    body: String,
    complete: Completion,
) -> Result<()> {
    #[cfg(any(target_os = "macos", windows))]
    {
        platform::post(app_id, identifier, title, body, complete)
    }
    #[cfg(not(any(target_os = "macos", windows)))]
    {
        drop((app_id, identifier, title, body, complete));
        Err(napi::Error::from_reason(
            "Use the Linux desktop notification service",
        ))
    }
}

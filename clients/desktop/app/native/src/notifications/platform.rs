use super::{Click, Completion};
use napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking;
use napi::{Error, Result};
use std::ffi::{CStr, CString, c_char, c_void};
use std::sync::Mutex;

static RECEIVER: Mutex<Option<Click>> = Mutex::new(None);

unsafe extern "C" {
    /// Installs or detaches the application's delegate on the calling main thread.
    fn kisaki_set_notification_receiver(
        app_id: *const c_char,
        receive: Option<extern "C" fn(*const c_char)>,
    ) -> i32;

    /// Retains no borrowed strings after returning and calls completion exactly once.
    fn kisaki_post_notification(
        app_id: *const c_char,
        identifier: *const c_char,
        title: *const c_char,
        body: *const c_char,
        context: *mut c_void,
        complete: extern "C" fn(*mut c_void, i32),
    );
}

extern "C" fn clicked(identifier: *const c_char) {
    if let Some(receive) = RECEIVER.lock().unwrap().as_ref() {
        // SAFETY: The native adapter passes a live, NUL-terminated string for this callback.
        let value = unsafe { CStr::from_ptr(identifier) }
            .to_string_lossy()
            .into_owned();
        receive.call(value, NonBlocking);
    }
}

pub(super) fn set_receiver(app_id: String, receive: Option<Click>) -> Result<bool> {
    let id =
        CString::new(app_id).map_err(|_| Error::from_reason("Invalid application identity"))?;
    let callback = receive
        .as_ref()
        .map(|_| clicked as extern "C" fn(*const c_char));
    *RECEIVER.lock().unwrap() = receive;
    // SAFETY: The callback is static; its Node target is protected independently by the mutex.
    let status = unsafe { kisaki_set_notification_receiver(id.as_ptr(), callback) };
    if status != 1 {
        *RECEIVER.lock().unwrap() = None;
    }
    match status {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(Error::from_reason(
            "The system notification receiver could not connect",
        )),
    }
}

extern "C" fn completed(context: *mut c_void, status: i32) {
    // SAFETY: Each submitted operation owns one boxed callback until this sole completion.
    let complete = unsafe { Box::from_raw(context.cast::<Completion>()) };
    let result = match status {
        1 => Ok(true),
        0 => Ok(false),
        _ => Err(Error::from_reason(
            "The system could not deliver the notification",
        )),
    };
    complete.call(result, NonBlocking);
}

/// Submits without keeping a libuv worker blocked on a user's permission decision.
pub(super) fn post(
    app_id: String,
    identifier: String,
    title: String,
    body: String,
    complete: Completion,
) -> Result<()> {
    let string =
        |value| CString::new(value).map_err(|_| Error::from_reason("Invalid notification text"));
    let identifier = string(identifier)?;
    let app_id = string(app_id)?;
    let title = string(title)?;
    let body = string(body)?;
    let context = Box::into_raw(Box::new(complete)).cast();
    // SAFETY: The adapter copies the UTF-8 inputs and takes ownership of the completion context.
    unsafe {
        kisaki_post_notification(
            app_id.as_ptr(),
            identifier.as_ptr(),
            title.as_ptr(),
            body.as_ptr(),
            context,
            completed,
        )
    };
    Ok(())
}

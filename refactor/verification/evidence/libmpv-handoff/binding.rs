//! Probe-only live Node callbacks and independently held shared textures.
use napi::{bindgen_prelude::*, threadsafe_function::*, Env, Task};
use napi_derive::napi;
use std::{
    ffi::{c_char, c_void, CStr, CString},
    sync::{Arc, Mutex},
};

#[repr(C)]
struct RawNotice {
    channel: u32,
    kind: u32,
    event: i32,
    error: i32,
    reason: i32,
    order: u64,
    request: u64,
    token: u64,
    flags: u64,
    entry: i64,
    value: f64,
    frame: *mut c_void,
}
#[repr(C)]
#[derive(Default)]
struct RawStats {
    live: u32,
    created: u32,
    released: u32,
    max_live: u32,
    skipped: u32,
    native_closed: u32,
    hook_count: u32,
}
extern "C" {
    fn handoff_new() -> *mut c_void;
    fn handoff_free(pointer: *mut c_void);
    fn handoff_enqueue(
        pointer: *mut c_void,
        action: *const c_char,
        id: u64,
        text: *const c_char,
        value: f64,
    ) -> i32;
    fn handoff_run(
        pointer: *mut c_void,
        dll: *const u16,
        render_first: i32,
        context: *mut c_void,
        emit: extern "C" fn(*mut c_void, *const RawNotice) -> i32,
        error: *mut c_char,
        capacity: usize,
    ) -> i32;
    fn handoff_stats(pointer: *mut c_void, output: *mut RawStats);
    fn handoff_release(pointer: *mut c_void);
    fn handoff_handle(pointer: *mut c_void) -> u64;
    fn handoff_luid(pointer: *mut c_void) -> u64;
    fn handoff_pixels(pointer: *mut c_void, output: *mut u8, capacity: usize) -> i32;
}
struct OwnedFrame(usize);
impl Drop for OwnedFrame {
    fn drop(&mut self) {
        unsafe { handoff_release(self.0 as *mut c_void) };
    }
}
#[napi]
pub struct HandoffFrame {
    frame: Mutex<Option<OwnedFrame>>,
}
#[napi]
impl HandoffFrame {
    #[napi]
    pub fn adapter_luid(&self) -> Result<String> {
        let guard = self.frame.lock().unwrap();
        let frame = guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Handoff frame was released."))?;
        Ok(format!("{:016x}", unsafe {
            handoff_luid(frame.0 as *mut c_void)
        }))
    }
    #[napi]
    pub fn handle(&self) -> Result<Buffer> {
        let guard = self.frame.lock().unwrap();
        let frame = guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Handoff frame was released."))?;
        Ok(unsafe { handoff_handle(frame.0 as *mut c_void) }
            .to_le_bytes()
            .to_vec()
            .into())
    }
    #[napi]
    pub fn pixels(&self) -> Result<Buffer> {
        let guard = self.frame.lock().unwrap();
        let frame = guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Handoff frame was released."))?;
        let mut bytes = vec![0; 64 * 48 * 4];
        if unsafe { handoff_pixels(frame.0 as *mut c_void, bytes.as_mut_ptr(), bytes.len()) } != 0 {
            return Err(Error::from_reason("Handoff readback failed."));
        }
        Ok(bytes.into())
    }
    #[napi]
    pub fn release(&self) {
        self.frame.lock().unwrap().take();
    }
}
#[napi(object, object_from_js = false)]
pub struct Notice {
    pub kind: u32,
    pub event: i32,
    pub error: i32,
    pub reason: i32,
    pub order: u32,
    pub request: u32,
    pub token: u32,
    pub flags: u32,
    pub entry: String,
    pub value: f64,
    pub frame: Option<HandoffFrame>,
}
#[napi(object)]
pub struct Stats {
    pub live: u32,
    pub created: u32,
    pub released: u32,
    pub max_live: u32,
    pub skipped: u32,
    pub native_closed: bool,
    pub hook_count: u32,
}
type Callback = ThreadsafeFunction<Notice, (), Notice, Status, false, true>;
struct Inner(usize);
impl Drop for Inner {
    fn drop(&mut self) {
        unsafe { handoff_free(self.0 as *mut c_void) };
    }
}
impl Inner {
    fn stats(&self) -> Stats {
        let mut raw = RawStats::default();
        unsafe { handoff_stats(self.0 as *mut c_void, &mut raw) };
        Stats {
            live: raw.live,
            created: raw.created,
            released: raw.released,
            max_live: raw.max_live,
            skipped: raw.skipped,
            native_closed: raw.native_closed != 0,
            hook_count: raw.hook_count,
        }
    }
}
#[napi]
pub struct HandoffProbe {
    inner: Arc<Inner>,
}
#[napi]
impl HandoffProbe {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        let pointer = unsafe { handoff_new() };
        if pointer.is_null() {
            return Err(Error::from_reason("Handoff allocation failed."));
        }
        Ok(Self {
            inner: Arc::new(Inner(pointer as usize)),
        })
    }
    #[napi]
    pub fn enqueue(&self, action: String, id: u32, text: Option<String>) -> Result<()> {
        let action =
            CString::new(action).map_err(|_| Error::from_reason("Invalid handoff action."))?;
        let text = CString::new(text.unwrap_or_default())
            .map_err(|_| Error::from_reason("Invalid handoff text."))?;
        if unsafe {
            handoff_enqueue(
                self.inner.0 as *mut c_void,
                action.as_ptr(),
                id.into(),
                text.as_ptr(),
                0.0,
            )
        } != 0
        {
            return Err(Error::from_reason("Handoff command was not accepted."));
        }
        Ok(())
    }
    #[napi]
    pub fn stats(&self) -> Stats {
        self.inner.stats()
    }
    #[napi]
    pub fn run(
        &self,
        dll: String,
        render_first: bool,
        events: Callback,
        frames: Callback,
        hooks: Callback,
    ) -> AsyncTask<RunTask> {
        AsyncTask::new(RunTask {
            inner: self.inner.clone(),
            dll,
            render_first,
            callbacks: [events, frames, hooks],
        })
    }
}
pub struct RunTask {
    inner: Arc<Inner>,
    dll: String,
    render_first: bool,
    callbacks: [Callback; 3],
}
extern "C" fn emit_notice(context: *mut c_void, raw: *const RawNotice) -> i32 {
    let task = unsafe { &*(context as *const RunTask) };
    let raw = unsafe { &*raw };
    let notice = Notice {
        kind: raw.kind,
        event: raw.event,
        error: raw.error,
        reason: raw.reason,
        order: raw.order as u32,
        request: raw.request as u32,
        token: raw.token as u32,
        flags: raw.flags as u32,
        entry: raw.entry.to_string(),
        value: raw.value,
        frame: (!raw.frame.is_null()).then(|| HandoffFrame {
            frame: Mutex::new(Some(OwnedFrame(raw.frame as usize))),
        }),
    };
    if task.callbacks[raw.channel as usize].call(notice, ThreadsafeFunctionCallMode::NonBlocking)
        == Status::Ok
    {
        0
    } else {
        -1
    }
}
impl Task for RunTask {
    type Output = Stats;
    type JsValue = Stats;
    fn compute(&mut self) -> Result<Self::Output> {
        let dll: Vec<u16> = self.dll.encode_utf16().chain(Some(0)).collect();
        let mut error = [0 as c_char; 256];
        if unsafe {
            handoff_run(
                self.inner.0 as *mut c_void,
                dll.as_ptr(),
                self.render_first.into(),
                self as *mut Self as *mut c_void,
                emit_notice,
                error.as_mut_ptr(),
                error.len(),
            )
        } != 0
        {
            return Err(Error::from_reason(
                unsafe { CStr::from_ptr(error.as_ptr()) }
                    .to_string_lossy()
                    .into_owned(),
            ));
        }
        Ok(self.inner.stats())
    }
    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

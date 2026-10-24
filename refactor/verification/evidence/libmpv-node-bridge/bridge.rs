//! Isolated Windows stream-callback experiment; this is not a package implementation.

use libloading::Library;
use napi::{bindgen_prelude::*, sys, threadsafe_function::*};
use napi_derive::napi;
use std::{
    collections::HashMap,
    ffi::{c_char, c_void, CStr, CString},
    ptr,
    sync::{
        atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering::SeqCst},
        Arc, Condvar, Mutex,
    },
};

static LIVE_CORES: AtomicU32 = AtomicU32::new(0);
type Handle = *mut c_void;
type OpenFn = unsafe extern "C" fn(Handle, *mut c_char, *mut StreamInfo) -> i32;

#[repr(C)]
struct StreamInfo {
    cookie: Handle,
    read: Option<unsafe extern "C" fn(Handle, *mut c_char, u64) -> i64>,
    seek: Option<unsafe extern "C" fn(Handle, i64) -> i64>,
    size: Option<unsafe extern "C" fn(Handle) -> i64>,
    close: Option<unsafe extern "C" fn(Handle)>,
    cancel: Option<unsafe extern "C" fn(Handle)>,
}

#[repr(C)]
struct Event {
    id: i32,
    error: i32,
    userdata: u64,
    data: Handle,
}

struct Api {
    _library: Library,
    create: unsafe extern "C" fn() -> Handle,
    option: unsafe extern "C" fn(Handle, *const c_char, *const c_char) -> i32,
    initialize: unsafe extern "C" fn(Handle) -> i32,
    register: unsafe extern "C" fn(Handle, *const c_char, Handle, OpenFn) -> i32,
    command: unsafe extern "C" fn(Handle, u64, *const *const c_char) -> i32,
    property: unsafe extern "C" fn(Handle, *const c_char, i32, Handle) -> i32,
    wait: unsafe extern "C" fn(Handle, f64) -> *const Event,
    destroy: unsafe extern "C" fn(Handle),
}

impl Api {
    unsafe fn load(path: &str) -> Result<Self> {
        // An absolute DLL path and restricted dependency search avoid PATH substitution.
        let library: Library = libloading::os::windows::Library::load_with_flags(path, 0x1100)
            .map_err(|_| Error::from_reason("Failed to load probe library."))?
            .into();
        macro_rules! symbol {
            ($name:literal) => {
                *library
                    .get(concat!($name, "\0").as_bytes())
                    .map_err(|_| Error::from_reason("Missing probe symbol."))?
            };
        }
        Ok(Self {
            create: symbol!("mpv_create"),
            option: symbol!("mpv_set_option_string"),
            initialize: symbol!("mpv_initialize"),
            register: symbol!("mpv_stream_cb_add_ro"),
            command: symbol!("mpv_command_async"),
            property: symbol!("mpv_get_property"),
            wait: symbol!("mpv_wait_event"),
            destroy: symbol!("mpv_terminate_destroy"),
            _library: library,
        })
    }
}

#[napi(object)]
pub struct Message {
    pub operation: String,
    pub stream: u32,
    pub job: u32,
    pub value: String,
    pub uri: String,
}

type Callback = ThreadsafeFunction<Message, (), Message, Status, false, true>;

#[derive(Default)]
struct Reply {
    ok: bool,
    bytes: Vec<u8>,
    value: i64,
    seekable: bool,
    has_size: bool,
}

#[derive(Default)]
struct JobState {
    canceled: bool,
    reply: Option<Reply>,
}

struct Job {
    stream: u32,
    state: Mutex<JobState>,
    ready: Condvar,
}

struct Core {
    api: Api,
    handle: Mutex<usize>,
    callback: Mutex<Option<Callback>>,
    pending: Mutex<HashMap<u32, Arc<Job>>>,
    next: AtomicU32,
    closing: AtomicBool,
    environment_closing: AtomicBool,
    destroyed: AtomicBool,
    canceled_waits: AtomicU32,
    late_replies: AtomicU32,
    native_closes: AtomicU32,
    native_cancels: AtomicU32,
    close_work: AtomicUsize,
}

impl Core {
    fn emit(&self, operation: &str, stream: u32, job: u32, value: String, uri: String) -> bool {
        if self.environment_closing.load(SeqCst) {
            return false;
        }
        self.callback
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(|callback| {
                callback.call(
                    Message {
                        operation: operation.into(),
                        stream,
                        job,
                        value,
                        uri,
                    },
                    ThreadsafeFunctionCallMode::NonBlocking,
                ) == Status::Ok
            })
    }

    fn request(
        &self,
        operation: &str,
        stream: u32,
        value: String,
        uri: String,
        canceled: Option<&AtomicBool>,
    ) -> Reply {
        let id = self.next.fetch_add(1, SeqCst);
        let job = Arc::new(Job {
            stream,
            state: Mutex::new(JobState::default()),
            ready: Condvar::new(),
        });
        {
            let mut pending = self.pending.lock().unwrap();
            if self.closing.load(SeqCst) || canceled.is_some_and(|flag| flag.load(SeqCst)) {
                return Reply::default();
            }
            pending.insert(id, job.clone());
        }
        if !self.emit(operation, stream, id, value, uri) {
            job.state.lock().unwrap().canceled = true;
        }
        let result = {
            let mut state = job.state.lock().unwrap();
            while !state.canceled && state.reply.is_none() {
                state = job.ready.wait(state).unwrap();
            }
            if state.canceled {
                self.canceled_waits.fetch_add(1, SeqCst);
                Reply::default()
            } else {
                state.reply.take().unwrap()
            }
        };
        self.pending.lock().unwrap().remove(&id);
        result
    }

    fn cancel_waits(&self, stream: Option<u32>) {
        for job in self.pending.lock().unwrap().values() {
            if stream.is_none() || stream == Some(job.stream) {
                job.state.lock().unwrap().canceled = true;
                job.ready.notify_all();
            }
        }
    }

    fn destroy(&self) {
        let handle = std::mem::take(&mut *self.handle.lock().unwrap());
        if handle != 0 {
            unsafe { (self.api.destroy)(handle as Handle) };
            LIVE_CORES.fetch_sub(1, SeqCst);
        }
        self.destroyed.store(true, SeqCst);
        self.emit("nativeClosed", 0, 0, String::new(), String::new());
        self.callback.lock().unwrap().take();
    }
}

struct Cookie {
    core: Arc<Core>,
    stream: u32,
    canceled: AtomicBool,
}

unsafe extern "C" fn open_stream(userdata: Handle, uri: *mut c_char, info: *mut StreamInfo) -> i32 {
    let pointer = userdata as *const Core;
    Arc::increment_strong_count(pointer);
    let core = Arc::from_raw(pointer);
    let stream = core.next.fetch_add(1, SeqCst);
    let Ok(uri) = CStr::from_ptr(uri).to_str() else {
        return -13;
    };
    let reply = core.request("open", stream, String::new(), uri.into(), None);
    if !reply.ok {
        return -13;
    }
    let cookie = Box::new(Cookie {
        core,
        stream,
        canceled: AtomicBool::new(false),
    });
    *info = StreamInfo {
        cookie: Box::into_raw(cookie).cast(),
        read: Some(read_stream),
        seek: reply.seekable.then_some(seek_stream),
        size: reply.has_size.then_some(size_stream),
        close: Some(close_stream),
        cancel: Some(cancel_stream),
    };
    0
}

unsafe extern "C" fn read_stream(pointer: Handle, buffer: *mut c_char, capacity: u64) -> i64 {
    let cookie = &*(pointer as *const Cookie);
    if cookie.canceled.load(SeqCst) {
        return -1;
    }
    let reply = cookie.core.request(
        "read",
        cookie.stream,
        capacity.to_string(),
        String::new(),
        Some(&cookie.canceled),
    );
    if !reply.ok || reply.bytes.len() as u64 > capacity {
        return -1;
    }
    // Only this native callback owns the destination pointer. Late replies cannot reach it.
    ptr::copy_nonoverlapping(reply.bytes.as_ptr(), buffer.cast(), reply.bytes.len());
    reply.bytes.len() as i64
}

unsafe extern "C" fn seek_stream(pointer: Handle, offset: i64) -> i64 {
    let cookie = &*(pointer as *const Cookie);
    if cookie.canceled.load(SeqCst) {
        return -1;
    }
    let reply = cookie.core.request(
        "seek",
        cookie.stream,
        offset.to_string(),
        String::new(),
        Some(&cookie.canceled),
    );
    if reply.ok {
        offset
    } else {
        -1
    }
}

unsafe extern "C" fn size_stream(pointer: Handle) -> i64 {
    let cookie = &*(pointer as *const Cookie);
    let reply = cookie.core.request(
        "getSize",
        cookie.stream,
        String::new(),
        String::new(),
        Some(&cookie.canceled),
    );
    if reply.ok {
        reply.value
    } else {
        -20
    }
}

unsafe extern "C" fn close_stream(pointer: Handle) {
    let cookie = Box::from_raw(pointer as *mut Cookie);
    cookie.core.native_closes.fetch_add(1, SeqCst);
    cookie
        .core
        .emit("close", cookie.stream, 0, String::new(), String::new());
}

unsafe extern "C" fn cancel_stream(pointer: Handle) {
    let cookie = &*(pointer as *const Cookie);
    cookie.canceled.store(true, SeqCst);
    cookie.core.native_cancels.fetch_add(1, SeqCst);
    cookie.core.cancel_waits(Some(cookie.stream));
    cookie
        .core
        .emit("cancel", cookie.stream, 0, String::new(), String::new());
}

struct CloseWork {
    core: Arc<Core>,
    env: sys::napi_env,
    work: sys::napi_async_work,
    hook: sys::napi_async_cleanup_hook_handle,
}

unsafe extern "C" fn execute_close(_env: sys::napi_env, data: Handle) {
    (*(data as *const CloseWork)).core.destroy();
}

unsafe extern "C" fn complete_close(env: sys::napi_env, _status: sys::napi_status, data: Handle) {
    let work = Box::from_raw(data as *mut CloseWork);
    work.core.close_work.store(0, SeqCst);
    assert_eq!(
        sys::napi_delete_async_work(env, work.work),
        sys::Status::napi_ok
    );
    assert_eq!(
        sys::napi_remove_async_cleanup_hook(work.hook),
        sys::Status::napi_ok
    );
}

unsafe fn queue_close(work: *mut CloseWork, environment: bool) {
    if work.is_null() {
        return;
    }
    let work = &*work;
    if environment {
        work.core.environment_closing.store(true, SeqCst);
    }
    if !work.core.closing.swap(true, SeqCst) {
        work.core.cancel_waits(None);
        assert_eq!(
            sys::napi_queue_async_work(work.env, work.work),
            sys::Status::napi_ok
        );
    }
}

unsafe extern "C" fn cleanup_environment(_hook: sys::napi_async_cleanup_hook_handle, data: Handle) {
    queue_close(data.cast(), true);
}

#[napi(object)]
pub struct Statistics {
    pub destroyed: bool,
    pub pending: u32,
    pub canceled_waits: u32,
    pub late_replies: u32,
    pub native_closes: u32,
    pub native_cancels: u32,
}

#[napi]
pub struct NativeBridge {
    core: Arc<Core>,
}

#[napi]
impl NativeBridge {
    #[napi(constructor)]
    pub fn new(env: Env, path: String, callback: Callback) -> Result<Self> {
        let api = unsafe { Api::load(&path)? };
        let handle = unsafe { (api.create)() };
        if handle.is_null() {
            return Err(Error::from_reason("Failed to create probe core."));
        }
        let setup = (|| {
            for (name, value) in [
                ("config", "no"),
                ("load-scripts", "no"),
                ("terminal", "no"),
                ("idle", "yes"),
                ("pause", "yes"),
                ("ao", "null"),
                ("vo", "null"),
                ("cache", "no"),
            ] {
                let (name, value) = (CString::new(name).unwrap(), CString::new(value).unwrap());
                if unsafe { (api.option)(handle, name.as_ptr(), value.as_ptr()) } < 0 {
                    return Err(Error::from_reason("Failed to set probe option."));
                }
            }
            if unsafe { (api.initialize)(handle) } < 0 {
                return Err(Error::from_reason("Failed to initialize probe core."));
            }
            Ok(())
        })();
        if let Err(error) = setup {
            unsafe { (api.destroy)(handle) };
            return Err(error);
        }
        let core = Arc::new(Core {
            api,
            handle: Mutex::new(handle as usize),
            callback: Mutex::new(Some(callback)),
            pending: Mutex::new(HashMap::new()),
            next: AtomicU32::new(1),
            closing: AtomicBool::new(false),
            environment_closing: AtomicBool::new(false),
            destroyed: AtomicBool::new(false),
            canceled_waits: AtomicU32::new(0),
            late_replies: AtomicU32::new(0),
            native_closes: AtomicU32::new(0),
            native_cancels: AtomicU32::new(0),
            close_work: AtomicUsize::new(0),
        });
        LIVE_CORES.fetch_add(1, SeqCst);
        let registered = unsafe {
            (core.api.register)(
                handle,
                c"probe".as_ptr(),
                Arc::as_ptr(&core) as Handle,
                open_stream,
            )
        };
        if registered < 0 {
            core.destroy();
            return Err(Error::from_reason("Failed to register probe protocol."));
        }
        unsafe {
            let mut work = Box::new(CloseWork {
                core: core.clone(),
                env: env.raw(),
                work: ptr::null_mut(),
                hook: ptr::null_mut(),
            });
            let pointer: *mut CloseWork = &mut *work;
            let mut name = ptr::null_mut();
            assert_eq!(
                sys::napi_create_string_utf8(
                    env.raw(),
                    c"libmpv-probe-close".as_ptr(),
                    -1,
                    &mut name
                ),
                sys::Status::napi_ok
            );
            assert_eq!(
                sys::napi_create_async_work(
                    env.raw(),
                    ptr::null_mut(),
                    name,
                    Some(execute_close),
                    Some(complete_close),
                    pointer.cast(),
                    &mut work.work
                ),
                sys::Status::napi_ok
            );
            assert_eq!(
                sys::napi_add_async_cleanup_hook(
                    env.raw(),
                    Some(cleanup_environment),
                    pointer.cast(),
                    &mut work.hook
                ),
                sys::Status::napi_ok
            );
            core.close_work.store(Box::into_raw(work) as usize, SeqCst);
        }
        Ok(Self { core })
    }

    #[napi]
    pub fn command(&self, arguments: Vec<String>) -> Result<()> {
        let arguments: Vec<_> = arguments
            .into_iter()
            .map(CString::new)
            .collect::<std::result::Result<_, _>>()
            .map_err(|_| Error::from_reason("Invalid probe command."))?;
        let mut pointers: Vec<_> = arguments.iter().map(|argument| argument.as_ptr()).collect();
        pointers.push(ptr::null());
        let handle = self.core.handle.lock().unwrap();
        if self.core.closing.load(SeqCst) || *handle == 0 {
            return Err(Error::from_reason("Probe core is closed."));
        }
        if unsafe { (self.core.api.command)(*handle as Handle, 0, pointers.as_ptr()) } < 0 {
            return Err(Error::from_reason("Probe command failed."));
        }
        Ok(())
    }

    #[napi]
    pub fn pause(&self) -> Result<bool> {
        let handle = self.core.handle.lock().unwrap();
        if self.core.closing.load(SeqCst) || *handle == 0 {
            return Err(Error::from_reason("Probe core is closed."));
        }
        let mut value = 0i32;
        if unsafe {
            (self.core.api.property)(
                *handle as Handle,
                c"pause".as_ptr(),
                3,
                (&mut value as *mut i32).cast(),
            )
        } < 0
        {
            return Err(Error::from_reason("Probe property failed."));
        }
        Ok(value != 0)
    }

    #[napi]
    pub fn poll(&self) -> Vec<i32> {
        let handle = self.core.handle.lock().unwrap();
        if self.core.closing.load(SeqCst) || *handle == 0 {
            return vec![];
        }
        let mut events = vec![];
        for _ in 0..100 {
            let id = unsafe { (*(self.core.api.wait)(*handle as Handle, 0.0)).id };
            if id == 0 {
                break;
            }
            events.push(id);
        }
        events
    }

    #[napi]
    pub fn respond(
        &self,
        job: u32,
        ok: bool,
        bytes: Uint8Array,
        value: String,
        seekable: bool,
        has_size: bool,
    ) -> bool {
        let pending = self.core.pending.lock().unwrap();
        let Some(job) = pending.get(&job) else {
            self.core.late_replies.fetch_add(1, SeqCst);
            return false;
        };
        let mut state = job.state.lock().unwrap();
        if state.canceled {
            self.core.late_replies.fetch_add(1, SeqCst);
            return false;
        }
        state.reply = Some(Reply {
            ok,
            bytes: bytes.to_vec(),
            value: value.parse().unwrap_or(-20),
            seekable,
            has_size,
        });
        job.ready.notify_all();
        true
    }

    #[napi]
    pub fn close_native(&self) {
        unsafe { queue_close(self.core.close_work.load(SeqCst) as *mut CloseWork, false) };
    }

    #[napi]
    pub fn statistics(&self) -> Statistics {
        Statistics {
            destroyed: self.core.destroyed.load(SeqCst),
            pending: self.core.pending.lock().unwrap().len() as u32,
            canceled_waits: self.core.canceled_waits.load(SeqCst),
            late_replies: self.core.late_replies.load(SeqCst),
            native_closes: self.core.native_closes.load(SeqCst),
            native_cancels: self.core.native_cancels.load(SeqCst),
        }
    }
}

#[napi]
pub fn live_cores() -> u32 {
    LIVE_CORES.load(SeqCst)
}

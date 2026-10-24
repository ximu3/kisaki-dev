//! Probe-only Node bridge for independently held D3D11 textures.
use napi::{bindgen_prelude::*, Env, Task};
use napi_derive::napi;
use std::{
    ffi::{c_char, c_void, CStr, CString},
    ptr,
    sync::Mutex,
};

#[repr(C)]
#[derive(Default)]
struct RawInfo {
    width: u32,
    height: u32,
    vendor: u32,
    device: u32,
    luid_low: u32,
    luid_high: i32,
    flags: u64,
    target_time: i64,
    screenshot_width: i64,
    screenshot_height: i64,
    screenshot_stride: i64,
    screenshot_bytes: u64,
    renderer_before_initialize: u32,
    startup_script: u32,
    core_destroyed: u32,
    raw_vo_change_succeeded: u32,
    gray_before_change: u32,
    gray_after_change: u32,
    direct_d3d11: u32,
    pixel_bytes: u32,
    target_mode: u32,
}

extern "C" {
    fn probe_produce(
        dll: *const u16,
        angle: *const u16,
        media: *const c_char,
        script: *const c_char,
        before_initialize: i32,
        direct_d3d11: i32,
        target_mode: i32,
        gpu_next: i32,
        first: *mut *mut c_void,
        second: *mut *mut c_void,
        error: *mut c_char,
        capacity: usize,
    ) -> i32;
    fn probe_frame_info(frame: *mut c_void, info: *mut RawInfo);
    fn probe_frame_handle(frame: *mut c_void) -> u64;
    fn probe_frame_pixels(frame: *mut c_void, output: *mut u8, size: usize) -> i32;
    fn probe_screenshot(
        frame: *mut c_void,
        output: *mut u8,
        capacity: usize,
        format: *mut c_char,
        format_capacity: usize,
    ) -> usize;
    fn probe_release_frame(frame: *mut c_void);
    fn probe_angle_loaded() -> i32;
    fn probe_pressure(
        dll: *const u16,
        media: *const c_char,
        capacity: u32,
        result: *mut RawPressureInfo,
        error: *mut c_char,
        error_capacity: usize,
    ) -> i32;
}

#[repr(C)]
struct RawPressureInfo {
    capacity: u32,
    produced: u32,
    skipped: u32,
    stable: u32,
    max_position: f64,
    elapsed: f64,
    first_target_raw: i64,
    clock_at_target_ns: i64,
    clock_at_target_us: i64,
    audio_codec: [c_char; 128],
}

#[napi(object)]
pub struct PressureInfo {
    pub capacity: u32,
    pub produced: u32,
    pub skipped: u32,
    pub held_frames_stable: bool,
    pub max_position: f64,
    pub elapsed_seconds: f64,
    pub first_target_raw: String,
    pub clock_at_target_ns: String,
    pub clock_at_target_us: String,
    pub audio_codec: String,
}

pub struct PressureTask {
    dll: String,
    media: String,
    capacity: u32,
}

impl Task for PressureTask {
    type Output = PressureInfo;
    type JsValue = PressureInfo;
    fn compute(&mut self) -> Result<Self::Output> {
        let dll: Vec<u16> = self.dll.encode_utf16().chain(Some(0)).collect();
        let media = CString::new(self.media.clone())
            .map_err(|_| Error::from_reason("Invalid probe media path."))?;
        let mut info = RawPressureInfo {
            capacity: 0,
            produced: 0,
            skipped: 0,
            stable: 0,
            max_position: 0.0,
            elapsed: 0.0,
            first_target_raw: 0,
            clock_at_target_ns: 0,
            clock_at_target_us: 0,
            audio_codec: [0; 128],
        };
        let mut error = [0 as c_char; 256];
        if unsafe {
            probe_pressure(
                dll.as_ptr(),
                media.as_ptr(),
                self.capacity,
                &mut info,
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
        Ok(PressureInfo {
            capacity: info.capacity,
            produced: info.produced,
            skipped: info.skipped,
            held_frames_stable: info.stable != 0,
            max_position: info.max_position,
            elapsed_seconds: info.elapsed,
            first_target_raw: info.first_target_raw.to_string(),
            clock_at_target_ns: info.clock_at_target_ns.to_string(),
            clock_at_target_us: info.clock_at_target_us.to_string(),
            audio_codec: unsafe { CStr::from_ptr(info.audio_codec.as_ptr()) }
                .to_string_lossy()
                .into_owned(),
        })
    }
    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

#[napi]
pub fn test_frame_pressure(dll: String, media: String, capacity: u32) -> AsyncTask<PressureTask> {
    AsyncTask::new(PressureTask {
        dll,
        media,
        capacity,
    })
}

pub struct OwnedFrame(usize);
impl Drop for OwnedFrame {
    fn drop(&mut self) {
        unsafe { probe_release_frame(self.0 as *mut c_void) };
    }
}

#[napi(object)]
pub struct FrameInfo {
    pub width: u32,
    pub height: u32,
    pub vendor: u32,
    pub device: u32,
    pub adapter_luid: String,
    pub flags: String,
    pub target_time: String,
    pub screenshot_width: String,
    pub screenshot_height: String,
    pub screenshot_stride: String,
    pub screenshot_bytes: String,
    pub renderer_before_initialize: bool,
    pub startup_script: bool,
    pub core_destroyed: bool,
    pub raw_vo_change_succeeded: bool,
    pub gray_before_change: u32,
    pub gray_after_change: u32,
    pub backend: String,
    pub pixel_format: String,
    pub target: String,
}

#[napi(object)]
pub struct Screenshot {
    pub format: String,
    pub data: Buffer,
}

#[napi]
pub struct ProbeFrame {
    frame: Mutex<Option<OwnedFrame>>,
}

impl ProbeFrame {
    fn with_frame<T>(&self, operation: impl FnOnce(*mut c_void) -> Result<T>) -> Result<T> {
        let frame = self.frame.lock().unwrap();
        let frame = frame
            .as_ref()
            .ok_or_else(|| Error::from_reason("Probe frame is released."))?;
        operation(frame.0 as *mut c_void)
    }
}

#[napi]
impl ProbeFrame {
    #[napi]
    pub fn info(&self) -> Result<FrameInfo> {
        self.with_frame(|frame| {
            let mut raw = RawInfo::default();
            unsafe { probe_frame_info(frame, &mut raw) };
            Ok(FrameInfo {
                width: raw.width,
                height: raw.height,
                vendor: raw.vendor,
                device: raw.device,
                adapter_luid: format!("{:08x}{:08x}", raw.luid_high as u32, raw.luid_low),
                flags: raw.flags.to_string(),
                target_time: raw.target_time.to_string(),
                screenshot_width: raw.screenshot_width.to_string(),
                screenshot_height: raw.screenshot_height.to_string(),
                screenshot_stride: raw.screenshot_stride.to_string(),
                screenshot_bytes: raw.screenshot_bytes.to_string(),
                renderer_before_initialize: raw.renderer_before_initialize != 0,
                startup_script: raw.startup_script != 0,
                core_destroyed: raw.core_destroyed != 0,
                raw_vo_change_succeeded: raw.raw_vo_change_succeeded != 0,
                gray_before_change: raw.gray_before_change,
                gray_after_change: raw.gray_after_change,
                backend: if raw.direct_d3d11 != 0 {
                    "d3d11"
                } else {
                    "angle"
                }
                .into(),
                pixel_format: if raw.pixel_bytes == 8 {
                    "rgba16float"
                } else {
                    "bgra8unorm"
                }
                .into(),
                target: match raw.target_mode {
                    1 => "scrgb",
                    2 => "pq",
                    3 => "transparent",
                    4 => "blank",
                    _ => "srgb",
                }
                .into(),
            })
        })
    }

    #[napi]
    pub fn handle(&self) -> Result<Buffer> {
        self.with_frame(|frame| {
            Ok(unsafe { probe_frame_handle(frame) }
                .to_le_bytes()
                .to_vec()
                .into())
        })
    }

    #[napi]
    pub fn pixels(&self) -> Result<Buffer> {
        self.with_frame(|frame| {
            let mut info = RawInfo::default();
            unsafe { probe_frame_info(frame, &mut info) };
            let mut bytes =
                vec![0; info.width as usize * info.height as usize * info.pixel_bytes as usize];
            if unsafe { probe_frame_pixels(frame, bytes.as_mut_ptr(), bytes.len()) } != 0 {
                return Err(Error::from_reason("Probe frame readback failed."));
            }
            Ok(bytes.into())
        })
    }

    #[napi]
    pub fn screenshot(&self) -> Result<Screenshot> {
        self.with_frame(|frame| {
            let mut info = RawInfo::default();
            unsafe { probe_frame_info(frame, &mut info) };
            let mut bytes = vec![0; info.screenshot_bytes as usize];
            let mut format = [0 as c_char; 64];
            unsafe {
                probe_screenshot(
                    frame,
                    bytes.as_mut_ptr(),
                    bytes.len(),
                    format.as_mut_ptr(),
                    format.len(),
                )
            };
            Ok(Screenshot {
                format: unsafe { CStr::from_ptr(format.as_ptr()) }
                    .to_string_lossy()
                    .into(),
                data: bytes.into(),
            })
        })
    }

    #[napi]
    pub fn release(&self) {
        self.frame.lock().unwrap().take();
    }
}

pub struct ProduceTask {
    dll: String,
    angle: String,
    media: String,
    script: String,
    before: bool,
    direct: bool,
    target: i32,
    gpu_next: bool,
}

impl Task for ProduceTask {
    type Output = Vec<OwnedFrame>;
    type JsValue = Vec<ProbeFrame>;

    fn compute(&mut self) -> Result<Self::Output> {
        let dll: Vec<u16> = self.dll.encode_utf16().chain(Some(0)).collect();
        let angle: Vec<u16> = self.angle.encode_utf16().chain(Some(0)).collect();
        let media = CString::new(self.media.clone())
            .map_err(|_| Error::from_reason("Invalid probe path."))?;
        let script = CString::new(self.script.clone())
            .map_err(|_| Error::from_reason("Invalid probe script path."))?;
        let (mut first, mut second) = (ptr::null_mut(), ptr::null_mut());
        let mut error = [0 as c_char; 256];
        let status = unsafe {
            probe_produce(
                dll.as_ptr(),
                angle.as_ptr(),
                media.as_ptr(),
                script.as_ptr(),
                self.before as i32,
                self.direct as i32,
                self.target,
                self.gpu_next as i32,
                &mut first,
                &mut second,
                error.as_mut_ptr(),
                error.len(),
            )
        };
        if status != 0 {
            return Err(Error::from_reason(
                unsafe { CStr::from_ptr(error.as_ptr()) }
                    .to_string_lossy()
                    .into_owned(),
            ));
        }
        Ok(vec![
            OwnedFrame(first as usize),
            OwnedFrame(second as usize),
        ])
    }

    fn resolve(&mut self, _env: Env, frames: Self::Output) -> Result<Self::JsValue> {
        Ok(frames
            .into_iter()
            .map(|frame| ProbeFrame {
                frame: Mutex::new(Some(frame)),
            })
            .collect())
    }
}

#[napi]
pub fn produce_frames(
    dll: String,
    angle: String,
    media: String,
    script: String,
    before_initialize: bool,
    direct_d3d11: Option<bool>,
    target: Option<String>,
    gpu_next: Option<bool>,
) -> Result<AsyncTask<ProduceTask>> {
    let target = match target.as_deref() {
        None | Some("srgb") => 0,
        Some("scrgb") => 1,
        Some("pq") => 2,
        Some("transparent") => 3,
        Some("blank") => 4,
        _ => return Err(Error::from_reason("Invalid graphics probe target.")),
    };
    Ok(AsyncTask::new(ProduceTask {
        dll,
        angle,
        media,
        script,
        before: before_initialize,
        direct: direct_d3d11.unwrap_or(false),
        target,
        gpu_next: gpu_next.unwrap_or(false),
    }))
}

#[napi]
pub fn angle_libraries_loaded() -> bool {
    unsafe { probe_angle_loaded() != 0 }
}

//! Determines the backing filesystem of an existing path on a worker before database access.

use napi::bindgen_prelude::AsyncTask;
use napi::{Env, Error, Result, Status, Task};
use napi_derive::napi;
use std::io;

/// Reads actual volume or mount information, following the supplied path to its backing location.
#[cfg(windows)]
fn location(path: &str) -> io::Result<&'static str> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetVolumePathNameW};

    let canonical = std::fs::canonicalize(path)?;
    let spelling = canonical.to_string_lossy();
    if spelling.starts_with(r"\\?\UNC\")
        || spelling.starts_with(r"\\") && !spelling.starts_with(r"\\?\")
    {
        return Ok("network");
    }
    let input: Vec<u16> = canonical.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut volume = vec![0_u16; 32768];
    // SAFETY: Input is NUL-terminated; output is writable for the supplied capacity.
    if unsafe { GetVolumePathNameW(input.as_ptr(), volume.as_mut_ptr(), volume.len() as u32) } == 0
    {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: The successful call above produced a NUL-terminated volume root.
    Ok(match unsafe { GetDriveTypeW(volume.as_ptr()) } {
        2 | 3 | 5 | 6 => "local",
        4 => "network",
        _ => "unknown",
    })
}

/// Reads the mounted filesystem's local flag on macOS.
#[cfg(target_os = "macos")]
fn location(path: &str) -> io::Result<&'static str> {
    let path = std::ffi::CString::new(path)?;
    let mut information = std::mem::MaybeUninit::<libc::statfs>::uninit();
    // SAFETY: The path is NUL-terminated and the output has the exact statfs layout.
    if unsafe { libc::statfs(path.as_ptr(), information.as_mut_ptr()) } != 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: statfs initialized the complete output on success.
    let information = unsafe { information.assume_init() };
    Ok(if information.f_flags & (libc::MNT_LOCAL as u32) != 0 {
        "local"
    } else {
        "network"
    })
}

/// Classifies Linux network mounts by their kernel filesystem type; FUSE remains unverified.
#[cfg(target_os = "linux")]
fn location(path: &str) -> io::Result<&'static str> {
    let path = std::ffi::CString::new(path)?;
    let mut information = std::mem::MaybeUninit::<libc::statfs>::uninit();
    // SAFETY: The path is NUL-terminated and the output has the exact statfs layout.
    if unsafe { libc::statfs(path.as_ptr(), information.as_mut_ptr()) } != 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: statfs initialized the complete output on success.
    let information = unsafe { information.assume_init() };
    Ok(match information.f_type as u64 {
        0x6969 | 0xff53_4d42 | 0xfe53_4d42 | 0x517b | 0x0102_1997 | 0x5346_414f | 0x6b41_4653
        | 0x7375_7245 | 0x564c | 0x00c3_6400 => "network",
        0x6573_5546 => "unknown",
        _ => "local",
    })
}

/// Owns one existing path while its filesystem is inspected off the JavaScript thread.
pub struct FilesystemTask {
    path: String,
}

impl Task for FilesystemTask {
    /// The verified local, network or unknown classification.
    type Output = String;

    /// The plain classification delivered to Node.
    type JsValue = String;

    /// Obtains the actual filesystem without opening or mutating a database.
    fn compute(&mut self) -> Result<Self::Output> {
        location(&self.path)
            .map(str::to_owned)
            .map_err(|error| Error::from_reason(error.to_string()))
    }

    /// Delivers the completed filesystem observation.
    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

/// Inspects the actual backing filesystem of an existing absolute path.
///
/// No files are created. Unknown classification is not evidence of local filesystem support.
///
/// # Errors
/// Returns InvalidArg for non-absolute or NUL-containing paths; platform inspection failures reject.
#[napi(ts_return_type = "Promise<'local' | 'network' | 'unknown'>")]
pub fn get_filesystem_location(path: String) -> Result<AsyncTask<FilesystemTask>> {
    if !crate::files::valid_path(&path) {
        return Err(Error::new(
            Status::InvalidArg,
            "Expected an absolute path without NUL",
        ));
    }
    Ok(AsyncTask::new(FilesystemTask { path }))
}

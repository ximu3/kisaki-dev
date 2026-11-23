use super::FilesystemQueryFailure;
use napi::bindgen_prelude::{AsyncTask, Either};
use napi::{Env, Error, Result, Status, Task};
use napi_derive::napi;
use std::io;

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

#[cfg(target_os = "macos")]
pub(super) fn mount_info(path: &std::path::Path) -> io::Result<libc::statfs> {
    use std::os::unix::ffi::OsStrExt;

    let path = std::ffi::CString::new(path.as_os_str().as_bytes())?;
    let mut information = std::mem::MaybeUninit::<libc::statfs>::uninit();
    // SAFETY: The path is NUL-terminated and the output has the exact statfs layout.
    if unsafe { libc::statfs(path.as_ptr(), information.as_mut_ptr()) } != 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: statfs initialized the complete output on success.
    Ok(unsafe { information.assume_init() })
}

#[cfg(target_os = "macos")]
fn location(path: &str) -> io::Result<&'static str> {
    let information = mount_info(std::path::Path::new(path))?;
    Ok(if information.f_flags & (libc::MNT_LOCAL as u32) != 0 {
        "local"
    } else {
        "network"
    })
}

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
        // Known shared filesystems, including OCFS2 and GFS2.
        0x7461_636f | 0x0116_1970 | 0x6969 | 0xff53_4d42 | 0xfe53_4d42 | 0x517b | 0x0102_1997
        | 0x5346_414f | 0x6b41_4653 | 0x7375_7245 | 0x564c | 0x00c3_6400 => "network",
        // ext2/3/4, XFS, Btrfs, F2FS, JFS, ZFS and bcachefs.
        0xef53 | 0x5846_5342 | 0x9123_683e | 0xf2f5_2010 | 0x3153_464a | 0x2fc1_2fc1
        | 0xca45_1a4e => "local",
        _ => "unknown",
    })
}

pub struct FilesystemTask {
    path: String,
}

impl Task for FilesystemTask {
    type Output = io::Result<&'static str>;

    type JsValue = Either<String, FilesystemQueryFailure>;

    fn compute(&mut self) -> Result<Self::Output> {
        Ok(location(&self.path))
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(match output {
            Ok(location) => Either::A(location.to_owned()),
            Err(error) => Either::B(error.into()),
        })
    }
}

/// Inspects the actual backing filesystem of an existing absolute path.
///
/// No files are created. Unknown classification is not evidence of local filesystem support.
///
/// # Errors
/// Returns InvalidArg before queueing an invalid path. Platform failures retain their cause and code.
#[napi(ts_return_type = "Promise<'local' | 'network' | 'unknown' | FilesystemQueryFailure>")]
pub fn get_filesystem_location(path: String) -> Result<AsyncTask<FilesystemTask>> {
    if !crate::files::valid_path(&path) {
        return Err(Error::new(
            Status::InvalidArg,
            "Expected an absolute path without NUL",
        ));
    }
    Ok(AsyncTask::new(FilesystemTask { path }))
}

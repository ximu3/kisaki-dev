//! Implements platform file moves and synchronization on libuv workers, returning stable reasons
//! and system codes.

use napi::bindgen_prelude::AsyncTask;
use napi::{Env, Error, Result, Status, Task};
use napi_derive::napi;
use std::io;
use std::path::Path;

/// Native completion. A missing reason means the system operation succeeded.
#[napi(object)]
pub struct FileOperationResult {
    /// Stable reason consumed by the Node boundary, never parsed from an error message.
    pub reason: Option<String>,
    /// Platform error code for diagnostics; absent for successful or structural results.
    pub system_code: Option<i32>,
}

fn success() -> FileOperationResult {
    FileOperationResult {
        reason: None,
        system_code: None,
    }
}

fn failure(reason: &str, error: Option<io::Error>) -> FileOperationResult {
    FileOperationResult {
        reason: Some(reason.to_owned()),
        system_code: error.and_then(|value| value.raw_os_error()),
    }
}

fn valid_path(path: &str) -> bool {
    Path::new(path).is_absolute() && !path.contains('\0')
}

/// Preserve the system cause while distinguishing a currently missing source from a missing parent.
fn move_failure(error: io::Error, source: &str) -> FileOperationResult {
    // Missing target parents use the same system code as missing sources on both platforms.
    let missing_reason = if std::fs::symlink_metadata(source)
        .is_err_and(|error| error.kind() == io::ErrorKind::NotFound)
    {
        "sourceMissing"
    } else {
        "ioFailure"
    };

    #[cfg(windows)]
    let reason = match error.raw_os_error() {
        Some(80 | 183) => "targetExists",
        Some(2 | 3) => missing_reason,
        Some(17) => "crossDevice",
        Some(1 | 50 | 120) => "unsupported",
        Some(5 | 32 | 33) => "permissionDenied",
        _ => "ioFailure",
    };

    #[cfg(unix)]
    let reason = match error.raw_os_error() {
        Some(libc::EEXIST | libc::ENOTEMPTY) => "targetExists",
        Some(libc::ENOENT) => missing_reason,
        Some(libc::EXDEV) => "crossDevice",
        Some(libc::ENOSYS | libc::EOPNOTSUPP | libc::EINVAL) => "unsupported",
        Some(libc::EACCES | libc::EPERM) => "permissionDenied",
        _ => "ioFailure",
    };
    failure(reason, Some(error))
}

/// Move one path without replacement. Both paths remain owned by the caller.
fn move_no_replace_impl(source: &str, target: &str) -> io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Storage::FileSystem::{MOVEFILE_WRITE_THROUGH, MoveFileExW};

        let source: Vec<u16> = std::ffi::OsStr::new(source)
            .encode_wide()
            .chain(Some(0))
            .collect();
        let target: Vec<u16> = std::ffi::OsStr::new(target)
            .encode_wide()
            .chain(Some(0))
            .collect();

        // SAFETY: Both buffers are NUL-terminated and live throughout the call.
        if unsafe { MoveFileExW(source.as_ptr(), target.as_ptr(), MOVEFILE_WRITE_THROUGH) } != 0 {
            return Ok(());
        }

        Err(io::Error::last_os_error())
    }

    #[cfg(unix)]
    {
        let source = std::ffi::CString::new(source)?;
        let target = std::ffi::CString::new(target)?;

        #[cfg(target_os = "macos")]
        // SAFETY: Absolute, NUL-terminated paths remain valid throughout the call.
        let result = unsafe {
            libc::renameatx_np(
                libc::AT_FDCWD,
                source.as_ptr(),
                libc::AT_FDCWD,
                target.as_ptr(),
                libc::RENAME_EXCL,
            )
        };

        #[cfg(target_os = "linux")]
        // SAFETY: Both paths are valid C strings; no-replace is delegated to the kernel.
        let result = unsafe {
            libc::renameat2(
                libc::AT_FDCWD,
                source.as_ptr(),
                libc::AT_FDCWD,
                target.as_ptr(),
                libc::RENAME_NOREPLACE,
            )
        };

        if result == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }
}

/// Owns one libuv worker operation; completion is delivered after the system result.
pub struct MoveTask {
    source: String,
    target: String,
}

impl Task for MoveTask {
    type Output = FileOperationResult;
    type JsValue = FileOperationResult;

    fn compute(&mut self) -> Result<Self::Output> {
        Ok(match move_no_replace_impl(&self.source, &self.target) {
            Ok(()) => success(),
            Err(error) => move_failure(error, &self.source),
        })
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

/// Queue an atomic same-filesystem move. No cancellation or copy fallback is provided.
#[napi(ts_return_type = "Promise<FileOperationResult>")]
pub fn move_no_replace(source: String, target: String) -> Result<AsyncTask<MoveTask>> {
    if !valid_path(&source) || !valid_path(&target) {
        return Err(Error::new(
            Status::InvalidArg,
            "Expected absolute paths without NUL",
        ));
    }

    Ok(AsyncTask::new(MoveTask { source, target }))
}

fn sync_failure(error: io::Error) -> FileOperationResult {
    let reason = match error.kind() {
        io::ErrorKind::NotFound => "pathMissing",
        io::ErrorKind::PermissionDenied => "permissionDenied",
        io::ErrorKind::Unsupported | io::ErrorKind::InvalidInput => "unsupported",
        _ => "ioFailure",
    };
    failure(reason, Some(error))
}

/// Owns opening, synchronization and closing of exactly one existing regular file.
pub struct SyncTask {
    path: String,
}

impl Task for SyncTask {
    type Output = FileOperationResult;
    type JsValue = FileOperationResult;

    fn compute(&mut self) -> Result<Self::Output> {
        let metadata = match std::fs::metadata(&self.path) {
            Ok(value) => value,
            Err(error) => return Ok(sync_failure(error)),
        };
        if !metadata.is_file() {
            return Ok(failure("wrongType", None));
        }

        let mut options = std::fs::OpenOptions::new();
        options.read(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;

            // A path replaced by a FIFO must not block the worker before the handle type check.
            options.custom_flags(libc::O_NONBLOCK);
        }
        #[cfg(windows)]
        options.write(true);

        let file = match options.open(&self.path) {
            Ok(value) => value,
            Err(error) => return Ok(sync_failure(error)),
        };
        // Recheck the opened handle: the path may have changed after metadata().
        match file.metadata() {
            Ok(value) if value.is_file() => (),
            Ok(_) => return Ok(failure("wrongType", None)),
            Err(error) => return Ok(sync_failure(error)),
        }

        #[cfg(target_os = "macos")]
        let result = {
            use std::os::fd::AsRawFd;

            // SAFETY: The borrowed descriptor belongs to the live File above.
            if unsafe { libc::fcntl(file.as_raw_fd(), libc::F_FULLFSYNC) } == 0 {
                Ok(())
            } else {
                Err(io::Error::last_os_error())
            }
        };

        #[cfg(not(target_os = "macos"))]
        let result = file.sync_all();

        drop(file);
        Ok(match result {
            Ok(()) => success(),
            Err(error) => sync_failure(error),
        })
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

/// Request the platform's specified synchronization on a worker, without creating files.
#[napi(ts_return_type = "Promise<FileOperationResult>")]
pub fn sync_file(path: String) -> Result<AsyncTask<SyncTask>> {
    if !valid_path(&path) {
        return Err(Error::new(
            Status::InvalidArg,
            "Expected an absolute path without NUL",
        ));
    }

    Ok(AsyncTask::new(SyncTask { path }))
}

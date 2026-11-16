//! Compares two names in one directory using the entries selected by the host filesystem.

use super::FilesystemQueryFailure;
use crate::files::valid_path;
use napi::bindgen_prelude::{AsyncTask, Either};
use napi::{Env, Error, Result, Status, Task};
use napi_derive::napi;
use std::io;
use std::path::{Path, PathBuf};

/// Reads the NT volume and normalized path of the opened entry, including a reparse point itself.
#[cfg(windows)]
fn entry_path(path: &Path) -> io::Result<Vec<u16>> {
    use std::fs::OpenOptions;
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, GetFinalPathNameByHandleW,
        VOLUME_NAME_NT,
    };

    let file = OpenOptions::new()
        .access_mode(0)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS)
        .open(path)?;
    let mut name = vec![0_u16; 256];
    loop {
        // SAFETY: The handle remains open and name is writable for the supplied number of UTF-16 units.
        let length = unsafe {
            GetFinalPathNameByHandleW(
                file.as_raw_handle(),
                name.as_mut_ptr(),
                name.len() as u32,
                VOLUME_NAME_NT,
            )
        } as usize;
        if length == 0 {
            return Err(io::Error::last_os_error());
        }
        if length < name.len() {
            name.truncate(length);
            return Ok(name);
        }
        // An insufficient-buffer result includes room for the terminator.
        name.resize(length, 0);
    }
}

/// Compares Windows volume roots or entries in the caller's established common directory.
#[cfg(windows)]
fn same_entry(left: &Path, right: &Path) -> io::Result<bool> {
    Ok(entry_path(left)? == entry_path(right)?)
}

/// Pins both Linux directory entries before reading their kernel paths, including symbolic links.
#[cfg(target_os = "linux")]
fn same_entry(left: &Path, right: &Path) -> io::Result<bool> {
    use std::fs::{OpenOptions, read_link};
    use std::os::fd::AsRawFd;
    use std::os::unix::fs::OpenOptionsExt;

    let mut options = OpenOptions::new();
    options
        .read(true)
        .custom_flags(libc::O_PATH | libc::O_NOFOLLOW);
    let left = options.open(left)?;
    let right = options.open(right)?;
    let left_path = read_link(format!("/proc/self/fd/{}", left.as_raw_fd()))?;
    let right_path = read_link(format!("/proc/self/fd/{}", right.as_raw_fd()))?;
    Ok(left_path == right_path)
}

/// Reads Darwin's volume-local link ID for the named entry without following its final link.
#[cfg(target_os = "macos")]
fn link_id(path: &Path) -> io::Result<u64> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let path = CString::new(path.as_os_str().as_bytes())?;
    let mut attributes = libc::attrlist {
        bitmapcount: libc::ATTR_BIT_MAP_COUNT,
        reserved: 0,
        commonattr: 0,
        volattr: 0,
        dirattr: 0,
        fileattr: 0,
        forkattr: libc::ATTR_CMNEXT_LINKID,
    };
    // Darwin packs a four-byte result length followed by the requested 64-bit attribute.
    let mut result = [0_u8; 12];
    // SAFETY: The path is terminated, and the attrlist and result are live for this call.
    if unsafe {
        libc::getattrlist(
            path.as_ptr(),
            (&raw mut attributes).cast(),
            result.as_mut_ptr().cast(),
            result.len(),
            libc::FSOPT_NOFOLLOW | libc::FSOPT_ATTR_CMN_EXTENDED,
        )
    } != 0
    {
        return Err(io::Error::last_os_error());
    }
    Ok(u64::from_ne_bytes(result[4..].try_into().unwrap()))
}

/// Resolves multi-link names on a filesystem without documented per-link IDs from its directory.
#[cfg(target_os = "macos")]
fn listed_links(left: &Path, right: &Path, inode: u64) -> io::Result<bool> {
    use std::os::unix::fs::DirEntryExt;

    let mut candidates = 0;
    let mut exact_names = 0;
    for entry in std::fs::read_dir(left.parent().unwrap())? {
        let entry = entry?;
        if entry.ino() == inode {
            candidates += 1;
            let name = entry.file_name();
            if Some(name.as_os_str()) == left.file_name()
                || Some(name.as_os_str()) == right.file_name()
            {
                exact_names += 1;
                if exact_names == 2 {
                    return Ok(false);
                }
            }
        }
    }
    if candidates == 1 {
        return Ok(true);
    }
    Err(io::Error::from(io::ErrorKind::Unsupported))
}

/// Compares Darwin entries on their backing devices, including separate names for hard links.
#[cfg(target_os = "macos")]
fn same_entry(left: &Path, right: &Path) -> io::Result<bool> {
    use std::ffi::CStr;
    use std::fs::symlink_metadata;
    use std::os::unix::fs::MetadataExt;

    let first = symlink_metadata(left)?;
    let second = symlink_metadata(right)?;
    if first.dev() != second.dev() || first.ino() != second.ino() {
        return Ok(false);
    }
    if left == right || first.nlink() == 1 {
        return Ok(true);
    }

    // XNU may substitute the file ID for a filesystem without distinct link IDs.
    let mount = super::location::mount_info(left.parent().unwrap())?;
    // SAFETY: statfs returns a terminated filesystem type in f_fstypename.
    let format = unsafe { CStr::from_ptr(mount.f_fstypename.as_ptr()) }.to_bytes();
    if format == b"apfs" || format == b"hfs" {
        return Ok(link_id(left)? == link_id(right)?);
    }
    listed_links(left, right, first.ino())
}

/// Owns both sibling lookup paths until the host has compared the selected entries.
pub struct EntryComparison {
    left: PathBuf,
    right: PathBuf,
}

impl Task for EntryComparison {
    /// The observed equality or an I/O error from accessing the entries.
    type Output = io::Result<bool>;

    /// A boolean observation or classified lookup failure for the Node consumer.
    type JsValue = Either<bool, FilesystemQueryFailure>;

    /// Observes names on the worker without modifying the parent or either entry.
    fn compute(&mut self) -> Result<Self::Output> {
        Ok(same_entry(&self.left, &self.right))
    }

    /// Preserves platform diagnostics when a lookup could not complete.
    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(match output {
            Ok(same) => Either::A(same),
            Err(error) => Either::B(error.into()),
        })
    }
}

/// Compares entries in an established common directory, or two Windows volume roots.
///
/// # Errors
/// Returns InvalidArg for invalid paths. Lookup failures retain their OS code.
#[napi(ts_return_type = "Promise<boolean | FilesystemQueryFailure>")]
pub fn same_directory_entry(first: String, second: String) -> Result<AsyncTask<EntryComparison>> {
    if [&first, &second]
        .iter()
        .any(|path| !valid_path(path) || (!cfg!(windows) && Path::new(path).file_name().is_none()))
    {
        return Err(Error::new(
            Status::InvalidArg,
            "Expected two absolute paths to named directory entries",
        ));
    }
    Ok(AsyncTask::new(EntryComparison {
        left: PathBuf::from(first),
        right: PathBuf::from(second),
    }))
}

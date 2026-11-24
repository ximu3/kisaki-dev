mod entries;
mod location;

pub use entries::same_directory_entry;
pub use location::get_filesystem_location;

use napi_derive::napi;
use std::io;

#[napi(string_enum = "camelCase")]
pub enum FilesystemQueryReason {
    PathMissing,
    NotDirectory,
    PermissionDenied,
    Unsupported,
    IoFailure,
}

#[napi(object)]
pub struct FilesystemQueryFailure {
    pub reason: FilesystemQueryReason,
    pub system_code: Option<i32>,
}

impl From<io::Error> for FilesystemQueryFailure {
    fn from(error: io::Error) -> Self {
        let reason = match error.kind() {
            io::ErrorKind::NotFound => FilesystemQueryReason::PathMissing,
            io::ErrorKind::NotADirectory => FilesystemQueryReason::NotDirectory,
            io::ErrorKind::PermissionDenied => FilesystemQueryReason::PermissionDenied,
            io::ErrorKind::Unsupported => FilesystemQueryReason::Unsupported,
            _ => FilesystemQueryReason::IoFailure,
        };
        Self {
            reason,
            system_code: error.raw_os_error(),
        }
    }
}

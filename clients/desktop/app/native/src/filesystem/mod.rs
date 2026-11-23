mod entries;
mod location;

pub use entries::same_directory_entry;
pub use location::get_filesystem_location;

use napi_derive::napi;
use std::io;

/// Stable causes shared by volume and directory-entry lookups.
#[napi(string_enum = "camelCase")]
pub enum FilesystemQueryReason {
    /// The host could not find the requested location.
    PathMissing,
    /// A path component required as a directory was another kind of entry.
    NotDirectory,
    /// The host denied access to the requested metadata.
    PermissionDenied,
    /// The filesystem cannot provide the observation.
    Unsupported,
    /// Another I/O error prevented lookup.
    IoFailure,
}

/// A filesystem metadata lookup failure with its original operating-system code.
#[napi(object)]
pub struct FilesystemQueryFailure {
    /// Stable outcome of the attempted lookup.
    pub reason: FilesystemQueryReason,
    /// Native code for diagnostics when the operating system supplied one.
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

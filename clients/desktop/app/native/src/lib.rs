mod files;

/// Export the filesystem operations implemented by the native module.
pub use files::{move_no_replace, sync_file};

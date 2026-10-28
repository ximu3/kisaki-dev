//! Private Node-API library entry for the desktop application's asynchronous file primitives.

mod files;

pub use files::{move_no_replace, sync_file};

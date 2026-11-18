//! Reads family names from the operating system's font catalog on a libuv worker.

use font_kit::source::SystemSource;
use napi::bindgen_prelude::{AbortSignal, AsyncTask};
use napi::{Env, Error, Result, Task};
use napi_derive::napi;

/// A single read of the host's current DirectWrite, Core Text or Fontconfig catalog.
pub struct FontFamilies;

impl Task for FontFamilies {
    /// System family names read on the worker.
    type Output = Vec<String>;

    /// The same family names delivered to the application.
    type JsValue = Vec<String>;

    /// Opens the native catalog for this request so later reads see installed and removed fonts.
    fn compute(&mut self) -> Result<Self::Output> {
        SystemSource::new()
            .all_families()
            .map_err(|cause| Error::from_reason(cause.to_string()))
    }

    /// Transfers the names after the worker has released the platform collection.
    fn resolve(&mut self, _env: Env, families: Self::Output) -> Result<Self::JsValue> {
        Ok(families)
    }
}

/// Queues a cancellable read of installed font family names.
#[napi(ts_return_type = "Promise<string[]>")]
pub fn list_font_families(signal: Option<AbortSignal>) -> AsyncTask<FontFamilies> {
    AsyncTask::with_optional_signal(FontFamilies, signal)
}

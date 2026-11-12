//! Configures the native build for Node-API symbol loading.

/// Configures linker support for the Node-API addon build.
fn main() {
    napi_build::setup();
}

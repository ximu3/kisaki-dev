use std::path::Path;

fn main() {
    let mut build = cc::Build::new();
    build.cpp(true).std("c++17").flag("/EHsc");
    let compiler = build.get_compiler();
    for (key, value) in compiler.get_envs() {
        if key.to_string_lossy().eq_ignore_ascii_case("include") {
            for entry in value.to_string_lossy().split(';') {
                let path = Path::new(entry);
                if path.file_name().is_some_and(|name| name == "winrt") {
                    let cppwinrt = path.parent().unwrap().join("cppwinrt");
                    if cppwinrt.is_dir() {
                        build.include(cppwinrt);
                    }
                }
            }
        }
    }
    build
        .define("NOMINMAX", None)
        .file("capture.cpp")
        .file("color.cpp")
        .compile("capture_probe");
    for library in [
        "windowsapp",
        "d3d11",
        "dxgi",
        "d2d1",
        "dxguid",
        "user32",
        "gdi32",
        "ole32",
    ] {
        println!("cargo:rustc-link-lib={library}");
    }
    println!("cargo:rerun-if-changed=capture.cpp");
    println!("cargo:rerun-if-changed=color.cpp");
    println!("cargo:rerun-if-changed=color.h");
}

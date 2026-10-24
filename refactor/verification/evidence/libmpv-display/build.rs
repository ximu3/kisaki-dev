fn main() {
    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .flag("/EHsc")
        .define("NOMINMAX", None)
        .include("C:/Program Files (x86)/Windows Kits/10/Include/10.0.22621.0/cppwinrt")
        .file("capture.cpp")
        .compile("display_capture_probe");
    println!("cargo:rustc-link-lib=d3d11");
    println!("cargo:rustc-link-lib=dxgi");
    println!("cargo:rustc-link-lib=windowsapp");
    println!("cargo:rustc-link-lib=user32");
    println!("cargo:rerun-if-changed=capture.cpp");
}

fn main() {
    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .flag("/EHsc")
        .define("NOMINMAX", None)
        .file("convert.cpp")
        .compile("composition_probe");
    println!("cargo:rustc-link-lib=d3d11");
    println!("cargo:rustc-link-lib=dxgi");
    println!("cargo:rustc-link-lib=d3dcompiler");
    println!("cargo:rerun-if-changed=convert.cpp");
}

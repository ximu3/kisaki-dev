use std::path::PathBuf;

fn main() {
    napi_build::setup();
    let manifest = PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let root = manifest.ancestors().nth(4).unwrap();
    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .flag("/EHsc")
        .define("NOMINMAX", None)
        .include(root.join("node_modules/.cache/libmpv-design/graphics/include"))
        .include(root.join("node_modules/.cache/libmpv-design/20261018/extracted/include"))
        .file("handoff.cpp")
        .compile("handoff_probe");
    println!("cargo:rustc-link-lib=d3d11");
    println!("cargo:rustc-link-lib=dxgi");
    println!("cargo:rerun-if-changed=handoff.cpp");
    println!("cargo:rerun-if-changed=../libmpv-gpu/producer.cpp");
}

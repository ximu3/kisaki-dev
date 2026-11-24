use std::fs;

fn main() {
    napi_build::setup();

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let source = "src/notifications/center.m";
        println!("cargo:rerun-if-changed={source}");
        cc::Build::new()
            .file(source)
            .flag("-fobjc-arc")
            .flag("-fblocks")
            .compile("kisaki_notifications");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=UserNotifications");
    }
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let source = "src/notifications/toast.cpp";
        println!("cargo:rerun-if-changed={source}");
        cc::Build::new()
            .cpp(true)
            .std("c++20")
            .flag("/EHsc")
            .file(source)
            .compile("kisaki_notifications");
        for library in ["windowsapp", "ole32", "advapi32", "shell32"] {
            println!("cargo:rustc-link-lib={library}");
        }
    }

    println!("cargo:rerun-if-changed=Cargo.lock");
    let lock: toml::Table = fs::read_to_string("Cargo.lock").unwrap().parse().unwrap();
    let components: Vec<_> = lock["package"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|package| {
            let name = package["name"].as_str().unwrap();
            name.starts_with("icu_")
                .then(|| format!("{}@{}", name, package["version"].as_str().unwrap()))
        })
        .collect();
    println!(
        "cargo:rustc-env=KISAKI_ICU_COMPONENTS={}",
        components.join(",")
    );
}

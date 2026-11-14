//! Configures Node-API linking and identifies the ICU engine and data behind SQLite indexes.

use std::fs;

/// Embeds the locked ICU component versions so changing their ordering rebuilds derived indexes.
fn main() {
    napi_build::setup();

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

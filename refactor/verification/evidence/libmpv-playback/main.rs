use std::ffi::CString;
use std::os::windows::ffi::OsStrExt;

extern "C" {
    fn playback_probe(
        dll: *const u16,
        first: *const i8,
        second: *const i8,
        missing: *const i8,
    ) -> i32;
}

fn main() {
    let arguments: Vec<_> = std::env::args_os().skip(1).collect();
    assert_eq!(arguments.len(), 4);
    let dll: Vec<u16> = arguments[0].encode_wide().chain(Some(0)).collect();
    let paths: Vec<_> = arguments[1..]
        .iter()
        .map(|value| CString::new(value.to_str().unwrap()).unwrap())
        .collect();
    let code = unsafe {
        playback_probe(
            dll.as_ptr(),
            paths[0].as_ptr(),
            paths[1].as_ptr(),
            paths[2].as_ptr(),
        )
    };
    std::process::exit(code);
}

use std::ffi::CString;

extern "C" {
    fn convert_probe(parent: u32, handle: u64, luid: u64, factor: f32, prefix: *const i8) -> i32;
}

fn main() {
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    assert_eq!(arguments.len(), 5);
    let parent = arguments[0].parse().unwrap();
    let handle = u64::from_str_radix(&arguments[1], 16).unwrap();
    let luid = u64::from_str_radix(&arguments[2], 16).unwrap();
    let factor: f32 = arguments[3].parse().unwrap();
    assert!(factor.is_finite() && factor > 0.0);
    let prefix = CString::new(arguments[4].as_bytes()).unwrap();
    let code = unsafe { convert_probe(parent, handle, luid, factor, prefix.as_ptr()) };
    std::process::exit(code);
}

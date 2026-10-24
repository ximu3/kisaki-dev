extern "C" {
    fn capture_probe(window: u64, points: *const f64, count: usize) -> i32;
}

fn main() {
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    assert!(arguments.len() >= 3 && arguments.len() % 2 == 1);
    let window = arguments[0].parse().unwrap();
    let points: Vec<f64> = arguments[1..]
        .iter()
        .map(|value| value.parse().unwrap())
        .collect();
    assert!(points
        .iter()
        .all(|value| value.is_finite() && *value >= 0.0 && *value < 1.0));
    let code = unsafe { capture_probe(window, points.as_ptr(), points.len() / 2) };
    std::process::exit(code);
}

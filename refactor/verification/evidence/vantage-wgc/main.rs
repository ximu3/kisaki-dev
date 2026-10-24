unsafe extern "C" {
    fn run_capture_probe() -> i32;
}

fn main() -> std::process::ExitCode {
    if unsafe { run_capture_probe() } == 0 {
        std::process::ExitCode::SUCCESS
    } else {
        std::process::ExitCode::FAILURE
    }
}

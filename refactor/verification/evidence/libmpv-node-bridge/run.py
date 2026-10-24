"""Build and run the isolated Node-API probe in an owned, bounded child process."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import platform
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
TARGET = ROOT / "node_modules/.cache/libmpv-design/node-bridge-target"
ADDON = TARGET / "libmpv-stream-bridge-probe.node"
INPUT = json.loads((HERE.parent / "libmpv-native/binary-input.json").read_text(encoding="utf-8"))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run(arguments, timeout):
    result = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True,
                            timeout=timeout, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError(f"Probe child failed ({result.returncode}).\n{result.stdout}\n{result.stderr}")
    return result


assert digest(INPUT["dll"]) == INPUT["dllSha256"]
run(["cargo", "build", "--offline", "--locked", "--manifest-path", str(HERE / "Cargo.toml"),
     "--target-dir", str(TARGET)], 120)
shutil.copy2(TARGET / "debug/libmpv_stream_bridge_probe.dll", ADDON)
execution = run(["node", "--unhandled-rejections=strict", str(HERE / "probe.mjs"),
                 str(ADDON), INPUT["dll"]], 35)
result = json.loads(execution.stdout)
result.update({
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "host": {"system": platform.system(), "release": platform.release(), "machine": platform.machine()},
    "nodeAddonExecuted": True,
    "javascriptProviderBridgeExecuted": True,
    "graphicsExecuted": False,
    "productionPackageImplemented": False,
    "selectedReleaseBuildVerified": False,
    "dllSha256": INPUT["dllSha256"],
    "libmpvSourceCommit": INPUT["sourceCommit"],
    "addonSha256": digest(ADDON),
    "cargoLockSha256": digest(HERE / "Cargo.lock"),
    "requestedNodeApi": 8,
    "rustc": run(["rustc", "--version"], 10).stdout.strip(),
    "sources": {name: digest(HERE / name) for name in
                ["Cargo.toml", "build.rs", "bridge.rs", "provider.mjs", "probe.mjs", "worker.mjs", "run.py"]},
    "stderr": execution.stderr,
})
(HERE / "runtime-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"cases": len(result["cases"]), "nodeAddonExecuted": True,
                  "liveCores": result["liveCores"], "unhandledRejections": result["unhandledRejections"]}))

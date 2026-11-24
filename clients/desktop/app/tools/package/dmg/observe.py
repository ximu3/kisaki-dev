import datetime
from pathlib import Path
import plistlib
import select
import subprocess
import sys


def mount_snapshot(output):
    info = subprocess.run(
        ["/usr/bin/hdiutil", "info", "-plist"], check=True, capture_output=True, timeout=5
    )
    volumes = []
    for image in plistlib.loads(info.stdout)["images"]:
        path = Path(image["image-path"])
        if path.parent.resolve() != output or path.suffix != ".dmg":
            continue
        for entity in image["system-entities"]:
            mount = entity.get("mount-point")
            if not mount:
                continue
            try:
                holders = subprocess.run(
                    ["/usr/bin/sudo", "-n", "/usr/sbin/lsof", "-nP", "-Fpc", "+f", "--", mount],
                    capture_output=True, text=True, timeout=5,
                )
                detail = (holders.stdout + holders.stderr).strip()
                if holders.returncode == 1 and not detail:
                    detail = "No open files reported"
                detail = f"lsof exit={holders.returncode}\n{detail}"
            except (OSError, subprocess.SubprocessError) as error:
                detail = f"Could not read open files: {error}"
            volumes.append((entity["dev-entry"], mount, path.name, detail))
    return volumes


def observe(output, report):
    report.parent.mkdir(parents=True, exist_ok=True)
    previous = None
    observed = set()
    started = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with report.open("w", encoding="utf-8") as log:
        while True:
            try:
                volumes = mount_snapshot(output)
                observed.update(volume[0] for volume in volumes)
                snapshot = "\n".join(
                    f"{device} mounted at {mount} from {image}\n{detail}"
                    for device, mount, image, detail in volumes
                ) or "No mounted DMG from this output directory"
            except (OSError, KeyError, ValueError, plistlib.InvalidFileException, subprocess.SubprocessError) as error:
                snapshot = f"Mount observation failed: {error}"
            if snapshot != previous:
                stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
                print(f"{stamp}\n{snapshot}", file=log, flush=True)
                previous = snapshot
            # The packaging process owns stdin. EOF also stops observation if that process exits.
            if select.select([sys.stdin], [], [], 1)[0]:
                break
        if sys.stdin.read() == "failed" and observed:
            # dmgbuild may have force-detached the disk before reporting the error.
            disks = " OR ".join(
                f'eventMessage CONTAINS[c] "{Path(device).name}"' for device in sorted(observed)
            )
            print("Disk Arbitration events for the observed devices", file=log, flush=True)
            try:
                subprocess.run(
                    ["/usr/bin/log", "show", "--style", "compact", "--info", "--debug",
                     "--start", started, "--predicate", f'process == "diskarbitrationd" AND ({disks})'],
                    stdout=log, stderr=log, timeout=10, check=True,
                )
            except (OSError, subprocess.SubprocessError) as error:
                print(f"Could not read Disk Arbitration events: {error}", file=log)
    print(f"DMG mount observation recorded {len(observed)} device(s) in {report}", flush=True)


if __name__ == "__main__":
    observe(Path(sys.argv[1]).resolve(), Path(sys.argv[2]))

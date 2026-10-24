"""Run unchanged test binaries under a simple executable suffix on this Windows host."""

import hashlib
from pathlib import Path
import shutil
import subprocess
import sys


arguments = sys.argv[1:]
original = Path(arguments[0])
if original.name.endswith(".mkv.exe"):
    executable = original.with_name(original.name.removesuffix(".mkv.exe") + ".exe")
    shutil.copy2(original, executable)
    assert original.read_bytes() == executable.read_bytes()
    print(f"Identical test executable renamed: {original.name}; sha256={hashlib.sha256(original.read_bytes()).hexdigest()}", flush=True)
    arguments[0] = str(executable)
result = subprocess.run(arguments, creationflags=subprocess.CREATE_NO_WINDOW)
sys.exit(result.returncode)

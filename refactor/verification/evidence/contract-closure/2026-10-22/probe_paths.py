"""Shared paths for isolated contract probes; no product files are generated."""
from pathlib import Path
import os

HERE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('KISAKI_REFACTOR_ROOT', HERE.parents[4])).resolve()
WORK = Path(os.environ.get('KISAKI_CLOSURE_WORK', ROOT / 'node_modules/.cache/libmpv-design/contract-closure-replay')).resolve()
OUT = Path(os.environ.get('KISAKI_CLOSURE_OUT', WORK / 'receipts')).resolve()
assert (ROOT / 'refactor/implementation/patches/libmpv/manifest.json').is_file()
WORK.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

"""Write verification receipts in repository format before dependent steps fingerprint them."""
from pathlib import Path
import json
import shutil
import subprocess


def write_receipt(path, value):
    root = Path(__file__).resolve().parents[4]
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    subprocess.run([shutil.which('node'), str(root / 'node_modules/prettier/bin/prettier.cjs'), '--write', str(path)],
                   cwd=root, check=True, capture_output=True, text=True)

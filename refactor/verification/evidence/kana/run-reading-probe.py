"""Prepare owned fixtures and run the isolated browser mechanism proof."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-design'
FIXTURES = CACHE / 'fixtures'
FIXTURES.mkdir(parents=True, exist_ok=True)

objects = [
    b'<< /Type /Catalog /Pages 2 0 R >>',
    b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /CropBox [20 40 180 260] /Rotate 90 /UserUnit 2 /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
]
content = b'BT /F1 12 Tf 35 100 Td (Kana PDF fixture) Tj ET'
objects.append(b'<< /Length ' + str(len(content)).encode() + b' >>\nstream\n' + content + b'\nendstream')
padding = b'0' * (8 * 1024 * 1024)
objects.append(b'<< /Length ' + str(len(padding)).encode() + b' >>\nstream\n' + padding + b'\nendstream')
pdf = bytearray(b'%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')
offsets = [0]
for index, obj in enumerate(objects, 1):
    offsets.append(len(pdf))
    pdf.extend(str(index).encode() + b' 0 obj\n' + obj + b'\nendobj\n')
xref = len(pdf)
pdf.extend(f'xref\n0 {len(offsets)}\n0000000000 65535 f \n'.encode())
for offset in offsets[1:]:
    pdf.extend(f'{offset:010d} 00000 n \n'.encode())
pdf.extend(f'trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode())
(FIXTURES / 'doc.pdf').write_bytes(pdf)
with zipfile.ZipFile(FIXTURES / 'large.zip', 'w') as archive:
    archive.writestr('unused.bin', padding, compress_type=zipfile.ZIP_STORED)
    archive.writestr('chapter.xhtml', '<p>Kana ZIP range fixture</p>', compress_type=zipfile.ZIP_DEFLATED)
(FIXTURES / 'manifest.json').write_text(json.dumps({
    'pdfSize': len(pdf), 'zipSize': (FIXTURES / 'large.zip').stat().st_size,
}), encoding='utf-8')

inputs = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text())
environment = dict(os.environ)
environment.pop('ELECTRON_RUN_AS_NODE', None)
output = HERE / 'reading-browser-contract.json'
result = subprocess.run([
    str(Path(inputs['electron']['runtime']) / 'electron.exe'),
    str(HERE / 'reading-electron.cjs'), str(CACHE), str(output),
], cwd=ROOT, env=environment, capture_output=True, text=True, timeout=45,
    creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:
    raise RuntimeError(f'Browser proof failed ({result.returncode}).\n{result.stdout}\n{result.stderr}')
receipt = json.loads(output.read_text(encoding='utf-8'))
receipt['sources'] = {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
                      for name in ['reading-probe.html', 'reading-probe.mjs', 'reading-electron.cjs', 'run-reading-probe.py']}
receipt['dependencies'] = {name: {'version': version, 'tarballSha256': hashlib.sha256((CACHE / f'{name}.tgz').read_bytes()).hexdigest()}
                           for name, version in [('pdf', '6.4.299'), ('zip', '2.24.0')]}
receipt['fixtures'] = {name: hashlib.sha256((FIXTURES / name).read_bytes()).hexdigest() for name in ['doc.pdf', 'large.zip']}
receipt['kanaImplementationExecuted'] = False
receipt['rarDecoderExecuted'] = False
receipt['mobiDecoderExecuted'] = False
output.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps({'electron': receipt['electron'], 'checks': list(receipt['checks']), 'externalRequests': receipt['externalRequests']}))

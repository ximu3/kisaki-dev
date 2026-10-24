"""Expose raw decoding seams in a private, attributed copy of the fixed Foliate module."""
from pathlib import Path
import hashlib
import json
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-formats'
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt

source = ROOT / 'node_modules/.cache/kana-design/sources/mobi.js'
expected = '016526df13a9f11ee6671a8c74346e1cf41fe6bdfe50165fdcbf744f015694f3'
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
text = source.read_text(encoding='utf-8')
start = text.index('export class MOBI extends PDB {')
position = text.index('    async open(file) {', start)
method = '''    async openRawForProof(file, start = 0) {
        await super.open(file)
        this.#start = start
        this.headers = this.#getHeaders(await super.loadRecord(start))
        this.#resourceStart = this.headers.mobi.resourceStart
        await this.#setup()
        return this
    }
'''
text = text[:position] + method + text[position:]
text += '\nexport { getIndexData, getUint, concatTypedArray3 };\n'
(CACHE / 'foliate-raw.mjs').write_text(text, encoding='utf-8', newline='\n')
(CACHE / 'foliate-LICENSE').write_bytes((source.parent / 'foliate-LICENSE').read_bytes())
write_receipt(HERE / 'mobi-adapter-input.json', {
    'source': 'https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/mobi.js',
    'originalSha256': expected, 'adaptedSha256': hashlib.sha256((CACHE / 'foliate-raw.mjs').read_bytes()).hexdigest(),
    'license': 'MIT', 'changes': ['Add explicit raw branch opening for tests without constructing a reader',
                                'Export the unchanged index and byte helper functions for the reconstruction probe'],
    'productionCodeAdopted': False
})

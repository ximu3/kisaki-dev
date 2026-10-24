"""Create tiny original fonts whose private-use glyphs have different meanings."""

from hashlib import sha256
import json
from pathlib import Path

from fontTools import __version__
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / "node_modules/.cache/kana-styling"
CACHE.mkdir(parents=True, exist_ok=True)


def rectangle(width):
    pen = TTGlyphPen(None)
    pen.moveTo((40, 0))
    pen.lineTo((width - 40, 0))
    pen.lineTo((width - 40, 700))
    pen.lineTo((40, 700))
    pen.closePath()
    return pen.glyph()


def make_font(name, letter_width, private_width):
    font = FontBuilder(1000, isTTF=True)
    order = [".notdef", "space", "A", "B"]
    widths = {".notdef": 600, "space": 300, "A": letter_width, "B": letter_width}
    cmap = {32: "space", 65: "A", 66: "B"}
    if private_width is not None:
        order.append("private")
        widths["private"] = private_width
        cmap[0xE000] = "private"
    font.setupGlyphOrder(order)
    font.setupCharacterMap(cmap)
    glyphs = {key: rectangle(width) for key, width in widths.items()}
    glyphs["space"] = TTGlyphPen(None).glyph()
    font.setupGlyf(glyphs)
    font.setupHorizontalMetrics({key: (width, 0) for key, width in widths.items()})
    font.setupHorizontalHeader(ascent=800, descent=-200)
    font.setupNameTable(
        {"familyName": name, "styleName": "Regular", "uniqueFontIdentifier": name,
         "fullName": name, "psName": name}
    )
    font.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    font.setupPost()
    font.setupMaxp()
    font.font["head"].created = 3400000000
    font.font["head"].modified = 3400000000
    font.font.recalcTimestamp = False
    path = CACHE / f"{name}.ttf"
    font.save(path)
    return {"name": name, "sha256": sha256(path.read_bytes()).hexdigest(),
            "letterWidth": letter_width, "privateWidth": private_width}


record = {
    "fontToolsVersion": __version__,
    "generatorSha256": sha256(Path(__file__).read_bytes()).hexdigest(),
    "originalFixtures": True,
    "fonts": [
        make_font("AuthorFixture", 700, 1000),
        make_font("ReaderFixture", 450, 300),
        make_font("MissingFixture", 450, None),
    ],
}
(CACHE / "fonts.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps(record))

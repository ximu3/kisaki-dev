"""Probe documented LaunchBox shapes and proposed mappings; this is not an importer."""
from __future__ import annotations

import ctypes
from ctypes import wintypes
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import ntpath
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import uuid

from lxml import etree
from PIL import Image

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
SEVEN_ZIP = HERE.parents[3] / "node_modules/.pnpm/7zip-bin@5.2.0/node_modules/7zip-bin/win/x64/7za.exe"
RESULTS = []
UNKNOWN = object()


def check(name, condition, category="mapping-model"):
    if not condition:
        raise AssertionError(name)
    RESULTS.append({"name": name, "category": category, "passed": True})


def fails(fn):
    try:
        fn()
    except (ValueError, etree.XMLSyntaxError, InvalidOperation, OverflowError):
        return True
    return False


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


manifest = json.loads((HERE / "fixture-manifest.json").read_text(encoding="utf-8-sig"))
before = {row["path"]: sha(HERE / row["path"]) for row in manifest["files"]}
check("all source fixtures match the committed manifest",
      all(before[row["path"]] == row["sha256"] for row in manifest["files"]), "byte-readability")


def parse(data):
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False,
                             huge_tree=False, recover=False, remove_comments=True)
    root = etree.fromstring(data, parser)
    if root.getroottree().docinfo.doctype:
        raise ValueError("DTD is not an accepted input.")
    if root.tag != "LaunchBox":
        raise ValueError("Unexpected root or namespace.")
    for row in root:
        seen = set()
        for field in row:
            if field.tag in seen:
                raise ValueError("Repeated scalar.")
            seen.add(field.tag)
    return root


def read(name):
    return parse((FIXTURES / name).read_bytes())


def values(element):
    return {child.tag: child.text if child.text is not None else "" for child in element}


def guid(value):
    parsed = uuid.UUID(value)
    if parsed.int == 0:
        raise ValueError("Empty source identity.")
    return str(parsed)


def build_game_index(root):
    index = {}
    for node in root.findall("Game"):
        row = values(node)
        identity = guid(row["ID"]) if "ID" in row else None
        if identity is None:
            raise ValueError("Missing source identity.")
        if identity in index and index[identity] != row:
            raise ValueError("Conflicting game identity.")
        index[identity] = row
    return index


w = read("installation/Data/Platforms/Windows.xml")
r = read("installation/Data/Platforms/Disc System.xml")
games = build_game_index(w)
games.update(build_game_index(r))
a, b, c = [values(row) for row in w.findall("Game")]
d = values(r.find("Game"))
check("platform XML has four distinct selected games", len(games) == 4, "xml-structure")
check("UTF-16 declaration and Unicode decode exactly",
      read("utf16-platform.xml").findtext("Game/Title") == "静かな星 & café", "xml-structure")
check("field reordering leaves source values unchanged",
      values(read("reordered-platform.xml").find("Game")) == a, "xml-structure")
check("XML character references preserve Notes as literal text",
      a["Notes"].endswith("Literal <placeholder> & personal edits are possible."), "xml-structure")
for name in ["duplicate-scalar.xml", "doctype.xml", "wrong-root.xml", "wrong-namespace.xml", "broken.xml"]:
    check("reject " + name, fails(lambda name=name: read(name)), "xml-structure")
check("Game ID casing is not silently rewritten from Id",
      fails(lambda: build_game_index(read("case-distinction.xml"))), "xml-structure")
check("conflicting GUID across rows is not last-write-wins",
      fails(lambda: build_game_index(read("duplicate-game.xml"))), "xml-structure")
check("GUID text case normalizes without becoming public identity",
      guid("EEEEEEEE-EEEE-4EEE-8EEE-EEEEEEEEEEEE") == d["Emulator"], "xml-structure")
check("unknown optional XML field stays source data",
      c["UnknownFutureField"] == "Do not infer a native field", "xml-structure")
check("additional apps are root siblings and reference GameID",
      len(w.findall("AdditionalApplication")) == 3
      and all(x.findtext("GameID") == a["ID"] for x in w.findall("AdditionalApplication")), "xml-structure")
check("custom fields reference source owner and keep untyped strings",
      w.findall("CustomField")[1].findtext("Value") == "Wishlist; maybe"
      and w.findall("CustomField")[1].findtext("GameID") == b["ID"], "xml-structure")


def public_db_id(text):
    if not re.fullmatch(r"[0-9]+", text) or int(text) <= 0:
        raise ValueError("Invalid public database identity.")
    return ("launchbox", "game/" + str(int(text)))


def steam_uri_identity(text):
    match = re.fullmatch(r"steam://(?:rungameid|run)/([1-9][0-9]*)/?", text)
    return ("steam", "app/" + match[1]) if match and int(match[1]) <= 2**32 - 1 else None


check("public database number and local GUID use different identities",
      public_db_id(a["DatabaseID"]) == ("launchbox", "game/700001")
      and fails(lambda: public_db_id(a["ID"])))
check("numeric public IDs stay distinct for different platform records",
      public_db_id(a["DatabaseID"]) != public_db_id(d["DatabaseID"]))
check("known Steam launch URI has exact app identity",
      steam_uri_identity(b["ApplicationPath"]) == ("steam", "app/123456"))
check("unknown URI query and arbitrary source label do not invent Steam IDs",
      steam_uri_identity("steam://rungameid/123456?other=5") is None
      and steam_uri_identity("Steam 123456") is None
      and steam_uri_identity("steam://rungameid/1152921504606846976") is None)


def score(row):
    key = "StarRatingFloat" if "StarRatingFloat" in row else "StarRating"
    if key not in row:
        return UNKNOWN
    text = row[key]
    if not re.fullmatch(r"(?:[0-9]+)(?:\.[0-9]+)?", text):
        raise ValueError("Invalid star value.")
    value = Decimal(text)
    if value < 0 or value > 5:
        raise ValueError("Invalid star range.")
    if key == "StarRating" and value != int(value):
        raise ValueError("Legacy integer rating required.")
    return None if value == 0 else int((value * 20).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


check("fractional user rating is preferred over legacy integer", score(a) == 75)
check("explicit zero is unrated despite legacy or community positive values", score(b) is None)
check("absent rating stays unknown", score(c) is UNKNOWN)
check("valid legacy integer has its stated scale", score({"StarRating": "4"}) == 80)
check("five stars and half-up precision use the native integer scale",
      score({"StarRatingFloat": "5"}) == 100 and score({"StarRatingFloat": "3.725"}) == 75)
check("invalid preferred rating does not fall back to valid legacy data",
      fails(lambda: score({"StarRatingFloat": "NaN", "StarRating": "5"})))
check("out-of-range and malformed values are not clamped",
      all(fails(lambda value=value: score({"StarRatingFloat": value})) for value in ["-1", "5.1", "Infinity", "3,75", ""]))


def progress(row, choices):
    if "Progress" in row:
        return choices.get(row["Progress"], (None, None))
    return (None, True) if row.get("Completed") == "true" else (None, None)


check("unconfigured Progress suppresses stale Completed", progress(b, {}) == (None, None))
check("legacy Completed means at least once without a date", progress(a, {}) == (None, True))
check("Dropped receives no inferred completion from its category",
      progress(b, {"Done / Dropped": ("onHold", None)}) == ("onHold", None))
check("custom progress mapping can express replaying after a completion",
      progress(c, {"My shelf / Replay someday": ("planned", True)}) == ("planned", True))
check("empty Progress does not fall through to old Completed",
      progress({"Progress": "", "Completed": "true"}, {}) == (None, None))
check("launch count and last played are not needed for completion mapping",
      progress({"PlayCount": "99", "LastPlayedDate": a["LastPlayedDate"]}, {}) == (None, None))


def milliseconds(text):
    if not re.fullmatch(r"[0-9]+", text):
        raise ValueError("Invalid duration.")
    result = int(text) * 1000
    if result > 2**53 - 1:
        raise OverflowError("Duration outside native integer range.")
    return result


def additional_value(source_total, activities):
    if source_total < activities:
        raise ValueError("Source total is below existing activities.")
    return source_total - activities


check("source seconds become exact milliseconds", milliseconds(a["PlayTime"]) == 3661000)
check("zero playtime is a valid duration", milliseconds(b["PlayTime"]) == 0)
check("large duration is rejected before floating-point rounding", fails(lambda: milliseconds(c["PlayTime"])))
check("fractional, negative and locale duration strings are rejected",
      all(fails(lambda value=value: milliseconds(value)) for value in ["-1", "1.5", "1,000"]))
check("main total is not summed with overlapping version fields",
      milliseconds(a["PlayTime"]) == 3661000
      and sum(int(x.findtext("PlayTime")) for x in w.findall("AdditionalApplication")) != int(a["PlayTime"]))
check("absolute duration adoption subtracts actual activity once",
      additional_value(36000000, 10800000) == 25200000
      and additional_value(36000000, 14400000) == 21600000)
check("smaller source total cannot delete actual activity", fails(lambda: additional_value(1000, 2000)))
check("newer history presence is detected without parsing an invented source schema",
      bool(list((FIXTURES / "newer-unmapped/PlaySessions").glob("*.jsonl"))), "format-limit")


def playlist_members(root):
    header = values(root.find("Playlist"))
    if header.get("AutoPopulate") != "false":
        raise ValueError("Not a saved manual snapshot.")
    members = []
    orphaned = 0
    for position, node in enumerate(root.findall("PlaylistGame")):
        row = values(node)
        key = guid(row["GameId"])
        if key not in games:
            orphaned += 1
            continue
        order = int(row.get("ManualOrder", "-1"))
        members.append((key, order, position))
    if header.get("SortBy") == "Manual":
        members.sort(key=lambda x: (x[1] < 0, x[1] if x[1] >= 0 else 0, x[2]))
    return list(dict.fromkeys(x[0] for x in members)), orphaned


members, orphans = playlist_members(read("installation/Data/Playlists/Manual.xml"))
check("manual order retains explicit positions and leaves unspecified items last",
      members == [b["ID"], a["ID"], d["ID"]])
check("duplicate target membership is not duplicated and orphan is not title-matched",
      len(members) == 3 and orphans == 1)
check("dynamic cached members are not claimed as a complete snapshot",
      fails(lambda: playlist_members(read("installation/Data/Playlists/Dynamic.xml"))))
check("platform folder and media folder keep their separate owners",
      read("installation/Data/Platforms.xml").findtext("PlatformFolder/MediaType") == "Box - Front"
      and read("installation/Data/Platforms.xml").findtext("Platform/Folder") == r"Games\Windows")


def safe_member(name):
    if re.match(r"^[A-Za-z]:", name) or name.startswith(("/", "\\")) or "\x00" in name:
        raise ValueError("Absolute member name.")
    normalized = name.replace("\\", "/")
    if any(part in ("", ".", "..") for part in normalized.split("/")):
        raise ValueError("Unsafe member components.")
    if "\n" in name or "\r" in name:
        raise ValueError("Unsupported member name.")
    return str(PurePosixPath(normalized))


check("archive members normalize separators without escaping",
      safe_member(r"Data\Platforms\Windows.xml") == "Data/Platforms/Windows.xml", "archive")
check("archive traversal, drive, UNC and separator tricks are rejected",
      all(fails(lambda value=value: safe_member(value)) for value in
          ["../Windows.xml", r"Data\..\outside.xml", "C:/outside.xml", r"\\host\share\x", "Data//x", "Data/\nx"]), "archive")


def seven_zip(*args):
    return subprocess.run([str(SEVEN_ZIP), *args], check=True, capture_output=True, timeout=30,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


for archive, prefix in [("data-root.7z", ""), ("wrapped-data.7z", "Data/")]:
    source = FIXTURES / archive
    listing = seven_zip("l", "-slt", "-sccUTF-8", str(source)).stdout.decode("utf-8")
    # Known synthetic names only. This is not a general 7-Zip listing parser.
    names = [safe_member(line[7:]) for line in listing.split("----------", 1)[1].splitlines()
             if line.startswith("Path = ")]
    check(archive + " contains the expected platform XML",
          prefix + "Platforms/Windows.xml" in names, "archive")
    data = seven_zip("x", "-so", "-spd", str(source), prefix + "Platforms/Windows.xml").stdout
    check(archive + " streamed member equals the original bytes",
          data == (FIXTURES / "installation/Data/Platforms/Windows.xml").read_bytes(), "archive")
    check(archive + " excludes game and image bytes",
          not any("/Games/" in "/" + name or "/Images/" in "/" + name for name in names), "archive")
    seven_zip("t", "-bd", str(source))
    check(archive + " passes the native archive integrity check", True, "archive")


def local_source_path(root, value, allowed):
    resolved = ntpath.normpath(value if ntpath.isabs(value) else ntpath.join(root, value))
    if not any(ntpath.commonpath([resolved.casefold(), item.casefold()]) == item.casefold() for item in allowed):
        raise ValueError("Source path outside selected roots.")
    return resolved


check("source relative paths use the installation root",
      local_source_path(r"C:\LB", r"Games\Aster\play.exe", [r"C:\LB"]) == r"C:\LB\Games\Aster\play.exe")
check("parent-relative source paths can resolve inside an explicitly allowed root",
      local_source_path(r"C:\LB", r"..\ROMs\aster.iso", [r"C:\ROMs"]) == r"C:\ROMs\aster.iso")
check("source parent-relative paths do not grant access outside selected roots",
      fails(lambda: local_source_path(r"C:\LB", r"..\outside\file", [r"C:\LB"])))
check("matching path prefix alone does not grant sibling-root access",
      fails(lambda: local_source_path(r"C:\LB", r"C:\LB-other\file", [r"C:\LB"])))
check("explicit RootFolder differs from a platform-wide ROM folder",
      a["RootFolder"] == r"Games\Aster" and "RootFolder" not in d)
check("inert local launch paths exist without being executable probes",
      (FIXTURES / "installation" / Path(*a["ApplicationPath"].split("\\"))).read_text().startswith("SYNTHETIC"))


def arguments(game, platform, emulator, rom, no_quotes=False, bare=False, no_space=False):
    selected = game or platform or emulator
    token = ntpath.splitext(ntpath.basename(rom))[0] if bare else rom
    quoted = token if no_quotes else '"' + token + '"'
    has_rom = "%romfile%" in selected
    no_rom = "%noromfile%" in selected
    selected = selected.replace("%romfile%", quoted).replace("%noromfile%", "")
    if re.search(r"%[^%]+%", selected):
        raise ValueError("Unresolved runtime variable.")
    return selected if has_rom or no_rom else selected + ("" if no_space or not selected else " ") + quoted


rom = r"C:\Games\aster (Disc 1).iso"
check("game parameter level replaces platform and emulator values",
      arguments("--game", "--platform", "--default", rom) == '--game "' + rom + '"')
check("nonempty associated-platform parameters replace emulator defaults",
      arguments("", '--core disc %romfile%', "--default", rom) == '--core disc "' + rom + '"')
check("ROM placeholder is not appended a second time",
      arguments("", "", "%romfile% --end", rom).count(rom) == 1)
check("noromfile suppresses automatic ROM append",
      arguments("", "", "--flag %noromfile%", rom) == "--flag ")
check("NoSpace and bare filename retain their explicit source meaning",
      arguments("", "", "--rom=", rom, no_quotes=True, bare=True, no_space=True) == "--rom=aster (Disc 1)")
check("unknown frontend variables are rejected",
      fails(lambda: arguments("", "", "%launchboxorbigboxexepath%", rom)))

if sys.platform == "win32":
    splitter = ctypes.windll.shell32.CommandLineToArgvW
    splitter.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(ctypes.c_int)]
    splitter.restype = ctypes.POINTER(wintypes.LPWSTR)
    free = ctypes.windll.kernel32.LocalFree
    free.argtypes = [wintypes.HLOCAL]
    free.restype = wintypes.HLOCAL
    count = ctypes.c_int()
    text = '"C:\\fixture.exe" ' + arguments("", "", '--label "a&b" %romfile%', rom)
    pointers = splitter(text, ctypes.byref(count))
    parsed = [pointers[index] for index in range(count.value)]
    free(ctypes.cast(pointers, wintypes.HLOCAL))
    check("Windows API splits quoted ROM and literal ampersand without a process launch",
          parsed == [r"C:\fixture.exe", "--label", "a&b", rom], "windows-arguments")
else:
    raise RuntimeError("This probe's native argument check requires Windows.")

check("automatic helper remains distinguishable from a selected playable version",
      w.findall("AdditionalApplication")[2].findtext("AutoRunBefore") == "true"
      and w.findall("AdditionalApplication")[1].findtext("Version") == "Alternate")
images = sorted((FIXTURES / "installation/Images/Windows/Box - Front").glob("Aster_ Memory-*.png"))
check("multiple same-role images remain ambiguous without a user choice", len(images) == 2)
with Image.open(images[0]) as image:
    image.load()
    check("synthetic image bytes decode through a real image library", image.size == (1, 1), "byte-readability")
check("actual ROM basename gives a distinct platform-local image candidate",
      (FIXTURES / "installation/Images/Disc System/Box - Front/aster (Disc 1).png").is_file())

after = {row["path"]: sha(HERE / row["path"]) for row in manifest["files"]}
check("all source fixture hashes remain unchanged after reads", before == after, "byte-readability")
result = {
    "checkedAt": "2026-10-17",
    "fixtureFiles": len(manifest["files"]),
    "passed": len(RESULTS),
    "failed": 0,
    "runtime": {
        "python": sys.version.split()[0],
        "lxml": etree.LXML_VERSION,
        "libxml": etree.LIBXML_VERSION,
        "sevenZip": "21.07 x64 from existing repository 7zip-bin@5.2.0; probe only",
        "platform": sys.platform,
    },
    "evidenceLimits": [
        "No real user Data or official backup was available.",
        "No LaunchBox application or game was executed.",
        "No Kisaki importer, profile acquisition, database write or native task was exercised.",
        "Mapping-model checks validate proposed choices, not undocumented source behavior.",
        "The JSONL fixture only exercises presence detection, not a source row schema.",
        "The 7-Zip listing probe accepts only its own known names and is not a production archive adapter.",
        "No proof of aggregate/version playtime overlap, arbitrary artwork matching or shell command equivalence.",
    ],
    "checks": RESULTS,
}
(HERE / "synthetic-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": len(RESULTS), "failed": 0, "fixtureFiles": len(manifest["files"]),
                  "sourceHashesUnchanged": True}))

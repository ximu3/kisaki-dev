"""Build synthetic LaunchBox inputs; never read or launch a user's game files."""
from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
REPOSITORY = HERE.parents[3]
SEVEN_ZIP = REPOSITORY / "node_modules/.pnpm/7zip-bin@5.2.0/node_modules/7zip-bin/win/x64/7za.exe"
WRITTEN: list[Path] = []
A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
C = "33333333-3333-4333-8333-333333333333"
D = "44444444-4444-4444-8444-444444444444"
E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"


def put(relative: str, data: bytes | str) -> Path:
    target = (FIXTURES / relative).resolve()
    target.relative_to(FIXTURES.resolve())
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data.encode("utf-8") if isinstance(data, str) else data)
    os.utime(target, (1704067200, 1704067200))
    WRITTEN.append(target)
    return target


def document(rows: list[tuple[str, dict[str, str]]], encoding: str = "utf-8") -> bytes:
    root = ET.Element("LaunchBox")
    for kind, fields in rows:
        node = ET.SubElement(root, kind)
        for key, value in fields.items():
            ET.SubElement(node, key).text = value
    ET.indent(root)
    return ET.tostring(root, encoding=encoding, xml_declaration=True)


windows = [
    ("Game", {
        "ID": A, "DatabaseID": "700001", "Title": "Aster: Memory", "SortTitle": "Aster Memory",
        "Platform": "Windows", "ApplicationPath": r"Games\Aster\play.exe",
        "RootFolder": r"Games\Aster", "CommandLine": '--language "zh CN" --literal "a&b"',
        "Notes": "Source description.\nLiteral <placeholder> & personal edits are possible.",
        "StarRatingFloat": "3.75", "StarRating": "3", "CommunityStarRating": "4.9",
        "Favorite": "true", "Completed": "true", "PlayCount": "17", "PlayTime": "3661",
        "LastPlayedDate": "2026-10-01T22:30:00+08:00", "DateAdded": "2020-01-02T23:30:00-05:00",
        "ReleaseDate": "2008-08-28T00:00:00+09:00", "Genre": "Visual Novel; Adventure",
        "PlayMode": "Single Player", "Series": "Aster", "Developer": "Example Studio",
        "Rating": "Not Rated", "Status": "Imported from a local folder", "Hide": "false",
    }),
    ("Game", {
        "ID": B, "DatabaseID": "700002", "Title": "Aster Return", "Platform": "Windows",
        "ApplicationPath": "steam://rungameid/123456", "StarRatingFloat": "0",
        "StarRating": "5", "CommunityStarRating": "4.8", "Favorite": "false",
        "Completed": "true", "Progress": "Done / Dropped", "PlayTime": "0", "PlayCount": "9",
    }),
    ("Game", {
        "ID": C, "Title": "Quiet 星", "Platform": "Windows", "ApplicationPath": "",
        "Progress": "My shelf / Replay someday", "PlayTime": "9007199254740992",
        "UnknownFutureField": "Do not infer a native field",
    }),
    ("AdditionalApplication", {
        "Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "GameID": A,
        "Name": "Primary version", "ApplicationPath": r"Games\Aster\play.exe",
        "CommandLine": '--language "zh CN" --literal "a&b"',
        "AutoRunBefore": "false", "AutoRunAfter": "false", "UseEmulator": "false",
        "PlayTime": "3661", "PlayCount": "17", "Version": "Main",
    }),
    ("AdditionalApplication", {
        "Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", "GameID": A,
        "Name": "Second playable version", "ApplicationPath": r"Games\Aster\other.exe",
        "AutoRunBefore": "false", "AutoRunAfter": "false", "UseEmulator": "false",
        "PlayTime": "600", "Version": "Alternate", "Region": "Japan",
    }),
    ("AdditionalApplication", {
        "Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", "GameID": A,
        "Name": "Setup helper", "ApplicationPath": r"Tools\helper.cmd",
        "AutoRunBefore": "true", "AutoRunAfter": "false", "UseEmulator": "false",
        "PlayTime": "20", "WaitForExit": "true",
    }),
    ("CustomField", {"GameID": A, "Name": "Personal memo", "Value": "Two lines\nwith <literal> text."}),
    ("CustomField", {"GameID": B, "Name": "Shelf", "Value": "Wishlist; maybe"}),
]
roms = [("Game", {
    "ID": D, "DatabaseID": "700003", "Title": "Aster: Memory", "Platform": "Disc System",
    "ApplicationPath": r"Games\ROMs\aster (Disc 1).iso", "Emulator": E,
    "CommandLine": "", "StarRatingFloat": "4.25", "Favorite": "true",
    "Progress": "Active / In Progress", "PlayTime": "120", "PlayCount": "2",
})]
put("installation/Data/Platforms/Windows.xml", document(windows))
put("installation/Data/Platforms/Disc System.xml", document(roms))
put("installation/Data/Platforms.xml", document([
    ("Platform", {"Name": "Windows", "Folder": r"Games\Windows"}),
    ("Platform", {"Name": "Disc System", "Folder": r"Games\ROMs"}),
    ("PlatformFolder", {"Platform": "Windows", "MediaType": "Box - Front",
                        "FolderPath": r"Images\Windows\Box - Front"}),
]))
put("installation/Data/Emulators.xml", document([
    ("Emulator", {"ID": E, "Title": "Fixture Emulator", "ApplicationPath": r"Emulators\fixture.exe",
                  "CommandLine": "--default", "NoQuotes": "false", "NoSpace": "false",
                  "FileNameWithoutExtensionAndPath": "false", "AutoExtract": "false"}),
    ("EmulatorPlatform", {"Emulator": E, "Platform": "Disc System",
                          "CommandLine": '--core "cores\\disc.dll" %romfile%', "Default": "true"}),
]))
put("installation/Data/Playlists/Manual.xml", document([
    ("Playlist", {"PlaylistId": "55555555-5555-4555-8555-555555555555", "Name": "This winter",
                  "NestedName": "Winter", "SortBy": "Manual", "AutoPopulate": "false",
                  "Notes": "A deliberately ordered list."}),
    ("PlaylistGame", {"GameId": A, "ManualOrder": "2", "GameTitle": "Not an identity"}),
    ("PlaylistGame", {"GameId": B, "ManualOrder": "0"}),
    ("PlaylistGame", {"GameId": D, "ManualOrder": "-1"}),
    ("PlaylistGame", {"GameId": A, "ManualOrder": "2"}),
    ("PlaylistGame", {"GameId": "99999999-9999-4999-8999-999999999999",
                      "GameTitle": "Aster: Memory", "LaunchBoxDbId": "700001", "ManualOrder": "3"}),
]))
put("installation/Data/Playlists/Dynamic.xml", document([
    ("Playlist", {"PlaylistId": "66666666-6666-4666-8666-666666666666", "Name": "Rule controlled",
                  "SortBy": "Title", "AutoPopulate": "true"}),
    ("PlaylistFilter", {"Field": "Progress", "Comparison": "Contains", "Value": "Done"}),
    ("PlaylistGame", {"GameId": A, "ManualOrder": "-1"}),
]))
put("utf16-platform.xml", document([("Game", {"ID": C, "Title": "静かな星 & café", "Platform": "Windows"})], "utf-16"))
put("reordered-platform.xml", document([("Game", dict(reversed(list(windows[0][1].items()))))]))
put("duplicate-scalar.xml", f"<LaunchBox><Game><ID>{A}</ID><Title>First</Title><Title>Second</Title></Game></LaunchBox>")
put("duplicate-game.xml", document([
    ("Game", {"ID": A, "Title": "One", "Platform": "Windows"}),
    ("Game", {"ID": A.upper(), "Title": "Different", "Platform": "Other"}),
]))
put("doctype.xml", '<!DOCTYPE LaunchBox [<!ENTITY x SYSTEM "file:///not-a-real-fixture-secret">]><LaunchBox><Game><Title>&x;</Title></Game></LaunchBox>')
put("wrong-root.xml", "<Metadata><Game><Title>Not a library</Title></Game></Metadata>")
put("wrong-namespace.xml", '<LaunchBox xmlns="urn:other"><Game/></LaunchBox>')
put("broken.xml", "<LaunchBox><Game></LaunchBox>")
put("case-distinction.xml", "<LaunchBox><Game><Id>not-the-Game-ID-field</Id><Title>Wrong case</Title></Game></LaunchBox>")
put("newer-unmapped/PlaySessions/2026.jsonl",
    '{"fixturePurpose":"presence detection only; not a LaunchBox PlaySessions schema"}\n')

# These are inert bytes used for path validation, not real executables or game content.
for relative in ["Games/Aster/play.exe", "Games/Aster/other.exe",
                 "Games/ROMs/aster (Disc 1).iso", "Emulators/fixture.exe", "Tools/helper.cmd"]:
    put("installation/" + relative, "SYNTHETIC PATH FIXTURE. DO NOT EXECUTE.\n")
pixel = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
put("installation/Images/Windows/Box - Front/Aster_ Memory-01.png", pixel)
put("installation/Images/Windows/Box - Front/Aster_ Memory-02.png", pixel)
put("installation/Images/Disc System/Box - Front/aster (Disc 1).png", pixel)

if not SEVEN_ZIP.is_file():
    raise RuntimeError("The existing repository 7-Zip probe dependency is unavailable.")
for name, cwd, member in [
    ("data-root.7z", FIXTURES / "installation/Data", "."),
    ("wrapped-data.7z", FIXTURES / "installation", "Data"),
]:
    destination = (FIXTURES / name).resolve()
    destination.relative_to(FIXTURES.resolve())
    if destination.exists():
        destination.unlink()
    subprocess.run(
        [str(SEVEN_ZIP), "a", "-t7z", "-mx=1", "-bd", "-bb0",
         "-mtc=off", "-mta=off", "-mtm=off", str(destination), member],
        cwd=cwd, check=True, capture_output=True, timeout=30,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    WRITTEN.append(destination)
manifest = {
    "schemaVersion": 1,
    "kind": "synthetic-only",
    "sourceApplicationExecuted": False,
    "nativeImporterExecuted": False,
    "playSessionsFixture": "Unsupported-format presence only; no invented source row schema.",
    "inertPathFixtures": "Text bytes with executable/ROM-like names; never launched.",
    "files": [
        {"path": str(p.relative_to(HERE)).replace("\\", "/"), "bytes": p.stat().st_size,
         "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        for p in sorted(WRITTEN)
    ],
}
(HERE / "fixture-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"fixtureFiles": len(WRITTEN), "sevenZip": "Existing repository 7zip-bin 5.2.0 / 7-Zip 21.07; probe only"}))

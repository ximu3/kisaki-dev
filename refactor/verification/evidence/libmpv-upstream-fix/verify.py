"""Check provenance, float16 regressions, and independent ASS color/alpha oracles."""

import hashlib
import json
import math
from pathlib import Path
import shlex
import struct


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / "node_modules/.cache/libmpv-design/engine-build"


def digest(file):
    with Path(file).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(file):
    return json.loads(Path(file).read_text(encoding="utf-8"))


def checked_bytes(record):
    file = Path(record["path"])
    assert digest(file) == record["sha256"], f"Changed input: {file.name}"
    return file.read_bytes()


def order(bits):
    return -(bits & 0x7FFF) if bits & 0x8000 else bits


def ulps(actual, expected):
    a = struct.unpack("<H", struct.pack("<e", actual))[0]
    b = struct.unpack("<H", struct.pack("<e", expected))[0]
    return abs(order(a) - order(b))


def pixels(sample):
    data = checked_bytes(sample["raw"])
    assert len(data) == sample["width"] * sample["height"] * 8
    return [item[0] for item in struct.iter_unpack("<e", data)]


def half_spacing(value):
    return 2 ** max(-24, math.floor(math.log2(abs(value))) - 10) if value else 2 ** -24


def half_toward_zero(value):
    rounded = struct.unpack("<e", struct.pack("<e", value))[0]
    bits = struct.unpack("<H", struct.pack("<e", rounded))[0]
    if abs(rounded) > abs(value):
        bits -= 1
    return struct.unpack("<e", struct.pack("<H", bits))[0]


def expand(interval, allowance):
    delta = allowance * max(half_spacing(value) for value in interval)
    return interval[0] - delta, interval[1] + delta


def blend_interval(foreground, background, opacity):
    # D3D11 permits blend precision from float16 through float32, conversions
    # toward zero, and fused arithmetic. Propagate those errors per operation.
    # See Functional Specification sections 3.1.5, 3.2.2, and 17.5.
    source = (0, 0) if foreground == 0 else expand((foreground, foreground), 1)
    float32_error = 2 ** (math.floor(math.log2(opacity)) - 23)
    alpha = (max(0, half_toward_zero(opacity) - float32_error),
             min(1, opacity + float32_error))
    inverse = expand((1 - alpha[1], 1 - alpha[0]), 0.6)
    source_term = expand((source[0] * alpha[0], source[1] * alpha[1]), 0.6)
    destination_term = expand((background * inverse[0], background * inverse[1]), 0.6)
    return expand((source_term[0] + destination_term[0],
                   source_term[1] + destination_term[1]), 1.6)


def main():
    contracts = {variant: read(HERE / f"{variant}-contract.json") for variant in ["baseline", "patched"]}
    builds = {variant: read(HERE / f"{variant}-build.json") for variant in contracts}
    dependencies = read(HERE / "dependencies.json")
    for variant, build in builds.items():
        contract = contracts[variant]
        assert build["sourceCommit"] == "01e2533f3143b8940857ca419b0b367f583e05ca"
        assert build["dependenciesSha256"] == digest(HERE / "dependencies.json")
        assert build["buildScriptSha256"] == digest(HERE / "build.py")
        assert build["testWrapperSha256"] == digest(HERE / "test-wrapper.py")
        assert build["dll"] == contract["dll"]
        checked_bytes(build["dll"])
        checked_bytes(contract["addon"])
        assert contract["captureSha256"] == digest(HERE / "capture.cjs")
        assert contract["probeFloatingAllocationMode"] == "pq"
        assert contract["captureIsolation"] == "one-native-library-load-per-node-process"
        assert contract["allReturnedFramesReleased"]
        for name in ["displaySettingsChanged", "hardwareDecodeEnabled", "hostPresentationVerified"]:
            assert not contract[name]
        assert not build["productionEngineModified"]
        for file, expected in build["artifacts"].items():
            assert digest(CACHE / file) == expected
        for file, expected in contract["references"].items():
            assert digest(HERE.parent / file) == expected
        for file, expected in contract["inputs"].items():
            assert digest(file) == expected
        checked_bytes(contract["edges"])
        for file, item in dependencies["runtimeDlls"].items():
            assert digest(CACHE / "runtime" / variant / file) == item["sha256"]
        for item in contract["cases"]:
            child = read(CACHE / "captures" / variant / f"{item['name']}.result.json")
            for field in ["dll", "addon", "captureSha256", "references", "inputs", "edges", "variant", "node"]:
                assert child[field] == contract[field]
            assert child["cases"] == [item]
            assert digest(CACHE / "captures" / variant / f"{item['name']}.lua") == item["scriptSha256"]
        tests = [json.loads(line) for line in (CACHE / f"build-{variant}/meson-logs/testlog-python.json").read_text(encoding="utf-8").splitlines()]
        assert len(tests) == 41 and all(item["result"] == "OK" for item in tests)
    assert builds["baseline"]["sourceStatus"] == ""
    assert builds["baseline"]["sourceDiff"] == ""
    assert builds["patched"]["sourceStatus"].strip() == "M video/out/gpu/video_shaders.c"
    assert builds["patched"]["patchSha256"] == digest(HERE.parent / "libmpv-composition/upstream-black-guard.patch")
    assert builds["baseline"]["options"] == builds["patched"]["options"]
    config = {}
    graph = {}
    options = {}
    for variant in contracts:
        build = CACHE / f"build-{variant}"
        lines = (build / "config.h").read_text(encoding="utf-8").splitlines()
        arguments = next(line for line in lines if line.startswith("#define CONFIGURATION "))
        config[variant] = ([line for line in lines if not line.startswith("#define CONFIGURATION ")],
                           sorted(shlex.split(arguments.split('"')[1])))
        graph[variant] = sorted(read(build / "meson-info/intro-dependencies.json"), key=lambda item: item["name"])
        options[variant] = {item["name"]: item["value"] for item in read(build / "meson-info/intro-buildoptions.json")}
    assert config["baseline"] == config["patched"]
    assert graph["baseline"] == graph["patched"]
    assert options["baseline"] == options["patched"]
    assert builds["baseline"]["dll"]["sha256"] != builds["patched"]["dll"]["sha256"]
    assert contracts["baseline"]["edges"] == contracts["patched"]["edges"]
    assert contracts["baseline"]["inputs"] == contracts["patched"]["inputs"]

    baseline = contracts["baseline"]["cases"]
    patched = contracts["patched"]["cases"]
    assert len(baseline) == len(patched) == 49
    case_results = []
    finite_components = 0
    changed_finite_components = 0
    max_ulp = 0
    repaired_components = 0
    raw = {}
    for before, after in zip(baseline, patched):
        for field in ["name", "group", "source", "subtitle", "osd", "transfer", "primaries", "peakNits", "toneMapping", "options"]:
            assert before[field] == after[field]
        observed = before["observations"].copy()
        changed = after["observations"].copy()
        observed.pop("mpvVersion")
        changed.pop("mpvVersion")
        assert observed == changed
        assert len(before["samples"]) == len(after["samples"]) == 2
        samples = []
        for index, (a, b) in enumerate(zip(before["samples"], after["samples"])):
            assert (a["width"], a["height"], a["device"]) == (b["width"], b["height"], b["device"])
            original, fixed = pixels(a), pixels(b)
            raw[before["name"], index] = (original, fixed)
            nan_count = infinity_count = sample_max_ulp = 0
            for position, (old, new) in enumerate(zip(original, fixed)):
                assert math.isfinite(new), (before["name"], position, new)
                if position % 4 == 3:
                    assert old == new == 1.0
                    continue
                if not math.isfinite(old):
                    nan_count += math.isnan(old)
                    infinity_count += math.isinf(old)
                    repaired_components += 1
                    continue
                difference = ulps(old, new)
                assert difference <= 1, (before["name"], position, old, new, difference)
                finite_components += 1
                changed_finite_components += difference != 0
                max_ulp = max(max_ulp, difference)
                sample_max_ulp = max(sample_max_ulp, difference)
            assert nan_count + infinity_count == a["nonFinite"]
            assert b["nonFinite"] == b["nonOpaque"] == a["nonOpaque"] == 0
            samples.append({"width": a["width"], "height": a["height"], "baselineNaNComponents": nan_count,
                            "baselineInfiniteComponents": infinity_count, "patchedNonFinite": 0,
                            "maxFiniteDifferenceUlps": sample_max_ulp})
        case_results.append({"name": before["name"], "samples": samples})
    failures = [item for item in baseline
                if item["group"] == "previous-diagnostic" and item["subtitle"]
                and item["transfer"] == "linear" and item["peakNits"] == 100
                and item["toneMapping"] == "auto"]
    assert len(failures) == 6
    assert all(all(sample["nonFinite"] > 0 for sample in item["samples"]) for item in failures)

    # Interior points avoid geometric antialiasing. ASS alpha is transparency.
    # All test colors are neutral, so changing primaries preserves their value.
    oracle_results = []
    zero_substitution_negative_controls = 0
    maximum_ideal_blend_difference = 0
    for item in patched:
        if item["group"] != "edge-colors" or not item["subtitle"]:
            continue
        base_name = item["name"].removesuffix("subtitles") + "base"
        for index, sample in enumerate(item["samples"]):
            original, actual = raw[item["name"], index]
            _, background = raw[base_name, index]
            checks = []
            for tile in contracts["patched"]["edges"]["tiles"]:
                x = int((tile["x"] + tile["width"] / 2) * sample["width"] / 63)
                y = int((tile["y"] + tile["height"] / 2) * sample["height"] / 47)
                position = (y * sample["width"] + x) * 4
                level = tile["level"]
                foreground = 1.0 if level == 255 else level / 255 / 12.92 * 203 / min(item["peakNits"], 203)
                transparency = tile["alpha"] / 255
                expected = [foreground * (1 - transparency) + background[position + channel] * transparency
                            for channel in range(3)]
                values = actual[position:position + 3]
                distances = [ulps(value, reference) for value, reference in zip(values, expected)]
                maximum_ideal_blend_difference = max(maximum_ideal_blend_difference, *distances)
                if tile["alpha"] == 0:
                    bounds = [expand((foreground, foreground), 1) for _ in range(3)]
                    assert max(distances) <= 1
                elif tile["alpha"] == 255:
                    bounds = [(value, value) for value in background[position:position + 3]]
                    assert values == background[position:position + 3]
                else:
                    bounds = [blend_interval(foreground, background[position + channel], 1 - transparency)
                              for channel in range(3)]
                assert all(low <= value <= high for value, (low, high) in zip(values, bounds)), (item["name"], index, tile, values, bounds)
                if level == 0 and tile["alpha"] == 0:
                    assert values == [0, 0, 0]
                if level == 0 and tile["alpha"] in [64, 128] and not math.isfinite(original[position]):
                    assert all(low > 0 for low, high in bounds)
                    zero_substitution_negative_controls += 1
                checks.append({"level": level, "assAlpha": tile["alpha"], "pixel": [x, y],
                               "actual": values, "idealBlend": expected, "idealBlendDifferenceUlps": distances,
                               "allowedBlendIntervals": bounds})
            oracle_results.append({"name": item["name"], "width": sample["width"], "height": sample["height"], "checks": checks})
    assert len(oracle_results) == 18
    assert zero_substitution_negative_controls == 12
    summary = {
        "casesPerBuild": len(baseline),
        "framesPerBuild": 98,
        "finiteRgbComponentsCompared": finite_components,
        "finiteRgbComponentsChanged": changed_finite_components,
        "maxFiniteDifferenceUlps": max_ulp,
        "baselineNonFiniteComponentsRepaired": repaired_components,
        "patchedNonFiniteComponents": 0,
        "colorAlphaOraclePixels": sum(len(item["checks"]) for item in oracle_results),
        "maximumIdealBlendDifferenceUlps": maximum_ideal_blend_difference,
        "zeroSubstitutionNegativeControlPixels": zero_substitution_negative_controls,
        "upstreamCandidateVerifiedOnThisConfiguration": True,
        "productionEngineModified": False,
        "fullColorPipelineValidated": False,
        "otherPlatformsVerified": False,
        "physicalHdrPresentationVerified": False,
    }
    result = {"summary": summary, "verifierSha256": digest(__file__),
              "records": {file.name: digest(file) for file in [HERE / "dependencies.json", *[HERE / f"{variant}-{kind}.json" for variant in contracts for kind in ["build", "contract"]]]},
              "cases": case_results, "colorAlphaOracles": oracle_results}
    (HERE / "analysis.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()

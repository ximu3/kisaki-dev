"""Check cumulative-time adoption models against existing synthetic reader data."""

import copy
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAX_SAFE = 2**53 - 1
HOUR = 3_600_000
checks = []
inputs = [
    ROOT / "fixtures/library/config/config.json",
    ROOT.parent / "mihon-importer/fixture-data.json",
    ROOT.parent / "mihon-importer/source-fields.json",
]
before = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in inputs}


def check(name, condition):
    checks.append({"name": name, "passed": bool(condition)})


def safe_ms(value):
    if type(value) is not int or not 0 <= value <= MAX_SAFE:
        raise ValueError("Invalid duration.")
    return value


def seconds_to_ms(value):
    return safe_ms(safe_ms(value) * 1000)


def protobuf_ms(value):
    if not isinstance(value, str) or not re.fullmatch(r"0|[1-9][0-9]*", value):
        raise ValueError("Invalid source integer.")
    return safe_ms(int(value))


def rejects(name, operation):
    try:
        operation()
    except ValueError:
        check(name, True)
    else:
        check(name, False)


def aggregate(rows):
    source_rows = {}
    for source_key, work, duration in rows:
        value = (work, safe_ms(duration))
        if source_key in source_rows and source_rows[source_key] != value:
            raise ValueError("Conflicting source duration.")
        source_rows[source_key] = value
    totals = {}
    for work, duration in source_rows.values():
        totals[work] = safe_ms(totals.get(work, 0) + duration)
    return totals


def adopt(record, source_total, activity_baseline, selected=False, expected=None):
    output = copy.deepcopy(record)
    if not selected or source_total is None:
        return output
    safe_ms(source_total)
    safe_ms(activity_baseline)
    if source_total < activity_baseline:
        return output
    if expected is not None and record.get("additionalDurationMs", 0) != expected:
        raise ValueError("Additional duration changed.")
    output["additionalDurationMs"] = source_total - activity_baseline
    return output


outer = json.loads(inputs[0].read_text(encoding="utf-8"))
reading_time = json.loads(outer["readingTime"])
check("Koodo recorded seconds convert exactly to milliseconds", seconds_to_ms(reading_time["12"]) == 150_000)
check("Explicit zero remains an adoptable duration", seconds_to_ms(0) == 0)
rejects("Fractional source seconds are rejected", lambda: seconds_to_ms(1.5))
rejects("Negative source seconds are rejected", lambda: seconds_to_ms(-1))
rejects("Boolean is not coerced into a duration", lambda: seconds_to_ms(True))
rejects("Unit conversion must remain a safe integer", lambda: seconds_to_ms(MAX_SAFE // 1000 + 1))
check("Missing source bucket remains unknown", reading_time.get("missing-book") is None)
daily = json.loads(outer["readingStats"])
daily_seconds = sum(int(item.rsplit("-", 1)[1]) for rows in daily.values() for item in rows if item.rsplit("-", 1)[0] == "12")
check("Overlapping daily view is not added to the cumulative value", seconds_to_ms(reading_time["12"]) == daily_seconds * 1000 == 150_000)
rows = [(key, "novel" if key in ("12", "pdf-book") else "comic", seconds_to_ms(value)) for key, value in reading_time.items()]
check("Selected books mapped to one Work are aggregated before adoption", aggregate(rows) == {"novel": 210_000, "comic": 45_000})
check("Repeated identical source key contributes only once", aggregate(rows + rows) == aggregate(rows))
rejects("Conflicting duplicate source key blocks the duration", lambda: aggregate(rows + [("12", "novel", 151_000)]))
rejects("Conflicting target for one source key is not silently chosen", lambda: aggregate(rows + [("12", "other-work", 150_000)]))
rejects("Aggregation overflow is rejected", lambda: aggregate([("a", "work", MAX_SAFE), ("b", "work", 1)]))

record = {"additionalDurationMs": 9 * HOUR, "status": "active", "completionCount": 2, "position": "existing-position"}
check("Existing additional duration is preserved by default", adopt(record, 10 * HOUR, 3 * HOUR) == record)
adopted = adopt(record, 10 * HOUR, 3 * HOUR, selected=True, expected=9 * HOUR)
check("Source ten hours minus three hours of activity sets seven hours", adopted["additionalDurationMs"] == 7 * HOUR)
check("Old additional value is replaced rather than incremented", adopted["additionalDurationMs"] != record["additionalDurationMs"] + 10 * HOUR)
check("Repeated explicit adoption does not add another source total", adopt(adopted, 10 * HOUR, 3 * HOUR, selected=True, expected=7 * HOUR) == adopted)
check("New activity after adoption remains independently counted", 4 * HOUR + adopted["additionalDurationMs"] == 11 * HOUR)
check("New explicit adoption uses its new activity baseline", adopt(adopted, 10 * HOUR, 4 * HOUR, selected=True)["additionalDurationMs"] == 6 * HOUR)
check("Smaller source total preserves records instead of clamping", adopt(record, 2 * HOUR, 3 * HOUR, selected=True) == record)
check("Explicit zero may clear an additional value when no activity exists", adopt(record, 0, 0, selected=True)["additionalDurationMs"] == 0)
check("Unknown source total cannot clear the existing value", adopt(record, None, 0, selected=True) == record)
rejects("Changed additional baseline reports conflict", lambda: adopt(record, 10 * HOUR, 3 * HOUR, selected=True, expected=0))
check("New Work adopts a total as its initial additional duration", adopt({}, 150_000, 0, selected=True, expected=0)["additionalDurationMs"] == 150_000)
check("State, completions and resume position are unaffected", all(adopted[key] == record[key] for key in ("status", "completionCount", "position")))
check("Preparing adoption does not mutate its input record", record["additionalDurationMs"] == 9 * HOUR)

mihon = json.loads(inputs[1].read_text(encoding="utf-8"))["current"]["backupManga"][0]
history_rows = [((mihon["source"], mihon["url"], item["url"]), "comic", protobuf_ms(item["readDuration"])) for item in mihon["history"]]
check("Mihon chapter totals retain their source millisecond unit", aggregate(history_rows) == {"comic": 5_401_000})
check("Cleared last-read date does not discard cumulative time", any(item["lastRead"] == "0" and protobuf_ms(item["readDuration"]) == 1000 for item in mihon["history"]))
check("Repeated chapter history is not counted twice", aggregate(history_rows + history_rows) == aggregate(history_rows))
models = json.loads(inputs[2].read_text(encoding="utf-8"))
check("Both declared Mihon and Tachiyomi models expose readDuration", all(any(field["name"] == "readDuration" and field["number"] == 3 for field in model["fields"]) for model in models if model["model"] == "BackupHistory"))
rejects("64-bit duration above the native safe range is rejected", lambda: protobuf_ms(str(MAX_SAFE + 1)))
check("Absent history supplies no inferred zero total", aggregate([]) == {})
check("All synthetic source inputs remain unchanged", all(hashlib.sha256(Path(path).read_bytes()).hexdigest() == digest for path, digest in before.items()))

result = {
    "evidenceClass": "cumulative-duration-proposal-model",
    "scope": "Shared Work additional duration, Koodo book totals and Mihon chapter totals",
    "productionApiExecuted": False,
    "passed": sum(item["passed"] for item in checks),
    "failed": sum(not item["passed"] for item in checks),
    "checks": checks,
    "sourceInputs": [{"path": str(Path(path).relative_to(ROOT.parent)).replace("\\", "/"), "sha256": digest} for path, digest in before.items()],
    "limits": ["These are explicit adoption models, not production database operations.", "Existing SQLite, protobuf and PDF probes remain separate evidence.", "UI, concurrent persistence and all four native Work branches require implementation acceptance."],
}
(ROOT / "duration-results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": result["passed"], "failed": result["failed"]}))
if result["failed"]:
    raise SystemExit(1)

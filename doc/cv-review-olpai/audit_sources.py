"""Read notebook outputs and train/validation PNG metadata; never train a model."""
from pathlib import Path
import collections
import csv
import hashlib
import io
import json
import math
import statistics
import struct
import zipfile

SOURCE = Path(r"D:\Documents\OLPAI\output\shareable\De_1_Lay_diem_chac")
DEST = Path(__file__).resolve().parent


def percentiles(values):
    values = sorted(values)
    result = []
    for percentile in [0, 10, 25, 50, 75, 90, 100]:
        position = (len(values) - 1) * percentile / 100
        low, high = math.floor(position), math.ceil(position)
        result.append(round(values[low] + (values[high] - values[low]) * (position - low), 3))
    return result


def main():
    audit, hashes = {}, {}
    with zipfile.ZipFile(SOURCE / "De_1_Task_CV_Dataset.zip") as archive:
        for split in ["train", "validation"]:
            text = archive.read(f"exam1_cv/{split}.csv").decode("utf-8-sig")
            rows = list(csv.DictReader(io.StringIO(text)))
            records = []
            split_hashes = collections.Counter()
            for row in rows:
                data = archive.read("exam1_cv/" + row["image"])
                assert data[:8] == b"\x89PNG\r\n\x1a\n"
                width, height = struct.unpack(">II", data[16:24])
                records.append((width, height, int(row["label"])))
                split_hashes[hashlib.sha256(data).hexdigest()] += 1
            hashes[split] = split_hashes
            short_sides = [min(w, h) for w, h, _ in records]
            counts = collections.Counter(label for _, _, label in records)
            audit[split] = {
                "n": len(rows),
                "percentiles_at": [0, 10, 25, 50, 75, 90, 100],
                "width_percentiles": percentiles([r[0] for r in records]),
                "height_percentiles": percentiles([r[1] for r in records]),
                **{f"short_side_lt{size}": statistics.mean(s < size for s in short_sides)
                   for size in [32, 48, 64]},
                "aspect_ratio_max": max(max(w, h) / min(w, h) for w, h, _ in records),
                "exact_file_duplicate_excess": sum(n - 1 for n in split_hashes.values()),
                "class_counts": dict(sorted(counts.items())),
                "selected_classes": {
                    str(label): {
                        "count": counts[label],
                        "median_wh": [statistics.median(r[k] for r in records if r[2] == label)
                                      for k in [0, 1]],
                        "short_side_lt32": statistics.mean(
                            min(w, h) < 32 for w, h, c in records if c == label),
                    } for label in [16, 34, 36, 38, 41]
                },
            }
    audit["train_validation_exact_file_hash_overlap"] = len(set(hashes["train"]) & set(hashes["validation"]))
    audit["limits"] = [
        "Dimensions read from original PNG IHDR, not resized arrays.",
        "Hashes compare encoded file bytes; this does not test decoded-pixel or near-duplicate equivalence.",
        "No track IDs are present in participant CSV files; group independence is documented by DATASET_CARD.md, not independently reconstructed here.",
        "Public/private test labels and answer keys are not read.",
    ]
    (DEST / "dataset_audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    notebook_path = SOURCE / "1-task-cv.ipynb"
    notebook = json.loads(notebook_path.read_text(encoding="utf-8"))
    evidence = {
        "notebook": str(notebook_path),
        "sha256": hashlib.sha256(notebook_path.read_bytes()).hexdigest(),
        "cell_numbering": "zero-based notebook JSON index",
        "outputs": {
            str(index): ["".join(output.get("text", [])) or "".join(output.get("data", {}).get("text/plain", []))
                         for output in notebook["cells"][index].get("outputs", [])
                         if output.get("text") or output.get("data", {}).get("text/plain")]
            for index in [4, 5, 13, 14, 16, 25, 27, 32, 33, 34, 35]
        },
    }
    (DEST / "notebook_evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

import sys
import os
import json
import hashlib
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from remotezip import RemoteZip

sys.stdout.reconfigure(encoding='utf-8')

HF_ZIP_URL = 'https://huggingface.co/datasets/namwu/ViSignLanguage-Video/resolve/main/dataset.zip'
SIGNS_DIR = 'public/signs'
MANIFEST_PATH = 'scripts/vsl-video-100-manifest.json'

os.makedirs(SIGNS_DIR, exist_ok=True)
os.makedirs('scripts', exist_ok=True)

print("Opening remote zip index...")
t0 = time.time()
rz = RemoteZip(HF_ZIP_URL)
all_names = rz.namelist()
print(f"Loaded remote zip index in {time.time() - t0:.2f}s ({len(all_names)} files)")

# Group train files by class
train_files_by_class = {}
for p in all_names:
    if p.startswith('dataset/train/') and p.endswith('.mp4'):
        parts = p.split('/')
        if len(parts) >= 4:
            cls_name = parts[2]
            if cls_name not in train_files_by_class:
                train_files_by_class[cls_name] = []
            train_files_by_class[cls_name].append(p)

sorted_classes = sorted(list(train_files_by_class.keys()))
print(f"Found {len(sorted_classes)} distinct sign classes.")

# Pick one best video per class
selected_by_class = {}
for cls_name in sorted_classes:
    files = train_files_by_class[cls_name]
    # Pick the first file or one with standard length
    selected_by_class[cls_name] = files[0]

print(f"Selected {len(selected_by_class)} target video files.")

# Download function
def download_single(item):
    idx, cls_name, zip_path = item
    id_str = f"SENT{idx:03d}"
    out_name = f"{id_str}.mp4"
    out_path = os.path.join(SIGNS_DIR, out_name)
    
    # Download using fresh remotezip connection per thread to avoid socket conflicts
    loc_rz = RemoteZip(HF_ZIP_URL)
    data = loc_rz.read(zip_path)
    
    sha256 = hashlib.sha256(data).hexdigest()
    with open(out_path, 'wb') as f:
        f.write(data)
        
    return {
        "index": idx,
        "id": id_str,
        "class_name": cls_name,
        "zip_path": zip_path,
        "filename": out_name,
        "size_bytes": len(data),
        "sha256": sha256
    }

print("Downloading 100 video files with 8 worker threads...")
t_start = time.time()
results = []
tasks = [(i + 1, cls, selected_by_class[cls]) for i, cls in enumerate(sorted_classes)]

with ThreadPoolExecutor(max_workers=8) as executor:
    futures = {executor.submit(download_single, task): task for task in tasks}
    completed = 0
    for future in as_completed(futures):
        res = future.result()
        results.append(res)
        completed += 1
        if completed % 10 == 0 or completed == len(tasks):
            print(f"Downloaded {completed}/{len(tasks)} videos ({time.time() - t_start:.1f}s)...")

results.sort(key=lambda x: x["index"])

# Save manifest
with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
    json.dump({
        "dataset": "namwu/ViSignLanguage-Video",
        "license": "CC-BY-4.0",
        "total": len(results),
        "generated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "items": results
    }, f, ensure_ascii=False, indent=2)

total_kb = sum(r["size_bytes"] for r in results) / 1024
print(f"All done! 100 videos saved in {time.time() - t_start:.2f}s.")
print(f"Total size: {total_kb:.1f} KB ({total_kb / 1024:.2f} MB). Manifest: {MANIFEST_PATH}")

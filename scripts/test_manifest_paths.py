import os
import json

path = os.path.expandvars(r'%APPDATA%\MMT Sync\index.json')
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

manifest = data.get('manifest', [])
files = data.get('files', [])
file_map = {f['id']: f for f in files}

print(f"Total manifest setups: {len(manifest)}")
print(f"Total indexed local files: {len(files)}")

# Check path issues
bad_paths = []
root = r"C:\Users\Alberto\Documents\iRacing\setups"

# Check how many files actually exist on disk from files list
existing_count = 0
missing_count = 0
missing_samples = []

for f in files:
    rel = f.get('relative_path', '').replace('/', '\\')
    full = os.path.join(root, rel)
    if os.path.isfile(full):
        existing_count += 1
    else:
        missing_count += 1
        if len(missing_samples) < 10:
            missing_samples.append((f['id'], rel))

print(f"Existing files on disk: {existing_count}")
print(f"Missing files on disk: {missing_count}")
if missing_samples:
    print("Sample missing files:")
    for mid, mrel in missing_samples:
        print(f"  ID {mid}: {mrel}")

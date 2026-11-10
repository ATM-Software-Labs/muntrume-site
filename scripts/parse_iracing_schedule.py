import pypdf
import re
import json
import os

pdf_path = r"C:\Users\Alberto\Descargas\Documentos\SeasonSchedule.pdf"

if not os.path.exists(pdf_path):
    print(f"Error: {pdf_path} not found.")
    exit(1)

reader = pypdf.PdfReader(pdf_path)
print(f"Loaded PDF: {len(reader.pages)} pages")

categories = ["OVAL", "SPORTS CAR", "FORMULA CAR", "DIRT OVAL", "DIRT ROAD"]
class_patterns = ["R Class", "D Class", "C Class", "B Class", "A Class"]

current_cat = "OVAL"
current_class = "R Class"

pages_annotated = []
for p_idx in range(5, len(reader.pages)):
    p_num = p_idx + 1
    raw = reader.pages[p_idx].extract_text()
    
    # Check category change
    for cat in categories:
        if f"\n{cat}\n" in raw or raw.startswith(f"{cat}\n") or f"Class Series ({cat})" in raw:
            current_cat = cat
            
    # Check class change
    for cls in class_patterns:
        if f"{cls} Series" in raw:
            current_class = cls
            
    pages_annotated.append((p_num, current_cat, current_class, raw))

# Combine full text with delimiters
full_text = ""
for p_num, cat, cls, text in pages_annotated:
    full_text += f"\n<<<PAGE_{p_num}_{cat}_{cls.replace(' ', '')}>>>\n" + text

# Find all Week 1 occurrences
w1_matches = list(re.finditer(r'Week\s+1\s*\((20\d{2}-\d{2}-\d{2})\)', full_text))
print(f"Found {len(w1_matches)} Week 1 entries")

all_series = []

for idx, w1 in enumerate(w1_matches):
    w1_start = w1.start()
    next_w1_start = w1_matches[idx + 1].start() if idx + 1 < len(w1_matches) else len(full_text)
    
    # Chunk between prev Week 1 and current Week 1
    prev_w1_start = w1_matches[idx - 1].start() if idx > 0 else 0
    meta_chunk = full_text[prev_w1_start:w1_start]
    
    # Category and license tier
    cat_match = list(re.finditer(r'<<<PAGE_\d+_([A-Z\s]+)_([A-Za-z]+)>>>', meta_chunk))
    category = cat_match[-1].group(1).strip() if cat_match else "SPORTS CAR"
    license_tier = cat_match[-1].group(2).strip() if cat_match else "RClass"
    
    # Lines in meta_chunk
    lines = [l.strip() for l in meta_chunk.split("\n") if l.strip()]
    
    # Find license line (the last '-->' or 'Pro/WC' line in chunk)
    lic_idx = -1
    for li in range(len(lines) - 1, -1, -1):
        if "-->" in lines[li] or "Pro/WC" in lines[li]:
            lic_idx = li
            break
            
    title = None
    car_lines = []
    lic_text = lines[lic_idx] if lic_idx != -1 else "Open"
    
    if lic_idx != -1:
        for back in range(lic_idx - 1, max(-1, lic_idx - 40), -1):
            line = lines[back]
            if line.startswith("<<<") or line.isdigit():
                continue
            if ("Season 4" in line) or ("2026 Season" in line) or ("Open Qualifiers" in line) or ("Festival" in line and "2026" in line):
                title = line
                car_lines = [lines[k] for k in range(back + 1, lic_idx) if not lines[k].startswith("<<<") and not lines[k].isdigit()]
                break
                
    if not title:
        title = f"Series {idx + 1}"
        cars_raw = "Open"
    else:
        cars_raw = ", ".join(car_lines) if car_lines else "Open"
        
    # Extract weeks in series_chunk
    series_chunk = full_text[w1_start:next_w1_start]
    week_pattern = re.compile(r'Week\s+(\d+)\s*\((20\d{2}-\d{2}-\d{2})\)\s+([^\n\r]+)')
    week_matches = list(week_pattern.finditer(series_chunk))
    weeks = []
    
    for wi, wm in enumerate(week_matches):
        w_num = int(wm.group(1))
        w_date = wm.group(2)
        track_initial = wm.group(3).strip()
        
        w_start = wm.end()
        w_end = week_matches[wi + 1].start() if wi + 1 < len(week_matches) else len(series_chunk)
        w_block = series_chunk[w_start:w_end]
        
        # Check if track wrapped to subsequent line before the (YYYY-MM-DD...) line
        w_lines = [wl.strip() for wl in w_block.split("\n") if wl.strip() and not wl.startswith("<<<") and not wl.isdigit()]
        
        track_full = track_initial
        if w_lines and not w_lines[0].startswith("(") and not "laps" in w_lines[0].lower() and not "mins" in w_lines[0].lower():
            # First line is a track name wrap continuation!
            track_full += " " + w_lines[0]
            
        if " - " in track_full:
            parts = track_full.split(" - ", 1)
            t_name = parts[0].strip()
            t_config = parts[1].strip()
        else:
            t_name = track_full
            t_config = "Full Course"
            
        weather = "Dry"
        duration = ""
        sim_time = ""
        for wl in w_lines:
            if re.match(r'^\(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}', wl):
                sim_time = wl.strip("()")
            elif any(k in wl.lower() for k in ["rain", "dry", "°f", "°c"]):
                weather = wl
            elif "laps" in wl.lower() or "mins" in wl.lower():
                duration = wl
                
        weeks.append({
            "week_num": w_num,
            "start_date": w_date,
            "track_name": t_name,
            "config": t_config,
            "weather": weather,
            "duration": duration,
            "sim_time": sim_time
        })
        
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    
    # Clean car list
    parsed_cars = []
    # Split by comma
    for c in re.split(r'[,;]', cars_raw):
        c_clean = c.strip()
        if c_clean and not c_clean.startswith("<<<") and not c_clean.isdigit():
            parsed_cars.append(c_clean)
            
    all_series.append({
        "id": slug,
        "name": title,
        "category": category,
        "tier": license_tier,
        "license": lic_text,
        "cars": parsed_cars,
        "weeks": weeks
    })

print(f"Total processed series: {len(all_series)}")

# Write to desktop and public
target_paths = [
    r"C:\Users\Alberto\muntrume-site\desktop\src\season_schedule_2026_s4.json",
    r"C:\Users\Alberto\muntrume-site\public\assets\data\season_schedule_2026_s4.json"
]

payload = {
    "season": "2026 Season 4",
    "pdf_source": "C:\\Users\\Alberto\\Descargas\\Documentos\\SeasonSchedule.pdf",
    "total_series": len(all_series),
    "current_week": 9,
    "series": all_series
}

for tp in target_paths:
    os.makedirs(os.path.dirname(tp), exist_ok=True)
    with open(tp, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Saved: {tp} ({os.path.getsize(tp)} bytes)")

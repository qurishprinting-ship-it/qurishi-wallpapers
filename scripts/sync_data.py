#!/usr/bin/env python3
"""Scan images/{wall,ceiling,flat}, then MERGE into data.json without losing anything.

* Keeps every existing record (IDs, titles, order, any extra fields).
* Adds records for new image files (e.g. dropped in manually through GitHub).
* Fills missing metadata: image, thumbnail, width, height, aspectRatio, fileSize, format, createdAt.
* Generates missing thumbnails in thumbs/<category>/<id>.webp (width 480).
* Drops records whose image file no longer exists (same behaviour as the old workflow).
Safe to run repeatedly. Requires Pillow.   usage: python3 scripts/sync_data.py [--root .]
"""
import argparse, json, os, subprocess, sys
from PIL import Image, ImageOps

CATS = ("wall", "ceiling", "flat")
EXTS = (".webp", ".jpg", ".jpeg", ".png")
THUMB_W = 480


def git_added_date(root, path):
    try:
        out = subprocess.run(["git", "log", "--diff-filter=A", "--follow", "--format=%aI", "-1", "--", path],
                             cwd=root, capture_output=True, text=True, timeout=20).stdout.strip()
        return out or None
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--root", default="."); ap.add_argument("--allow-drop", action="store_true"); a = ap.parse_args()
    root = a.root
    data_path = os.path.join(root, "data.json")
    try:
        with open(data_path, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        data = []

    files = {}  # (cat, id) -> relative path
    for cat in CATS:
        d = os.path.join(root, "images", cat)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d), reverse=True):
            stem, ext = os.path.splitext(name)
            if ext.lower() in EXTS:
                files[(cat, stem)] = f"images/{cat}/{name}"

    by_key = {(r.get("category"), str(r.get("id"))): r for r in data}
    out, seen = [], set()
    for r in data:  # preserve existing order
        k = (r.get("category"), str(r.get("id")))
        if k in files and k not in seen:
            out.append(r); seen.add(k)
    new = [k for k in files if k not in seen]
    # new files first (newest numbers first), like the old workflow's reverse sort
    for k in sorted(new, key=lambda k: (int(k[1]) if k[1].isdigit() else -1), reverse=True):
        cat, id_ = k
        out.insert(0, {"id": id_, "title": f"{cat.capitalize()} {id_}", "category": cat}); seen.add(k)

    # SAFETY: never silently wipe the catalogue (e.g. images/ missing in a partial checkout).
    dropped = [r for r in data if (r.get("category"), str(r.get("id"))) not in seen]
    if dropped and not a.allow_drop and (not files or len(dropped) > max(5, len(data) // 5)):
        print(f"ABORT: {len(dropped)} of {len(data)} records have no image file on disk "
              f"(found {len(files)} image files). data.json was NOT changed. "
              f"If this is intentional, re-run with --allow-drop.", file=sys.stderr)
        sys.exit(1)

    changed = 0
    for r in out:
        cat, id_ = r["category"], str(r["id"]); r["id"] = id_
        rel = files[(cat, id_)]
        full = os.path.join(root, rel)
        thumb_rel = f"thumbs/{cat}/{id_}.webp"
        thumb = os.path.join(root, thumb_rel)
        before = json.dumps(r, sort_keys=True)
        try:
            with Image.open(full) as im:
                im = ImageOps.exif_transpose(im)
                w, h = im.size
                fmt = (Image.open(full).format or "").lower()
                if not os.path.exists(thumb) and w > 0:
                    os.makedirs(os.path.dirname(thumb), exist_ok=True)
                    t = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
                    t.thumbnail((THUMB_W, THUMB_W * 2), Image.LANCZOS)
                    t.save(thumb, "WEBP", quality=62, method=4)
        except Exception as e:  # corrupt/unreadable image: keep the record, skip metadata
            print(f"WARN cannot read {rel}: {e}", file=sys.stderr); continue
        r.setdefault("image", rel)
        r["thumbnail"] = thumb_rel if os.path.exists(thumb) else r.get("thumbnail", thumb_rel)
        r.setdefault("width", w); r.setdefault("height", h)
        r.setdefault("aspectRatio", round(w / h, 4) if h else None)
        r.setdefault("fileSize", os.path.getsize(full)); r.setdefault("format", "jpeg" if fmt == "jpeg" else fmt)
        if "createdAt" not in r:
            d = git_added_date(root, rel)
            if d: r["createdAt"] = d
        if json.dumps(r, sort_keys=True) != before: changed += 1

    text = json.dumps(out, indent=2, ensure_ascii=False) + "\n"
    old = open(data_path, encoding="utf-8").read() if os.path.exists(data_path) else ""
    if text != old:
        with open(data_path, "w", encoding="utf-8", newline="\n") as f: f.write(text)
    print(f"records={len(out)} new={len(new)} updated={changed} dropped={len(dropped)}")


if __name__ == "__main__":
    main()

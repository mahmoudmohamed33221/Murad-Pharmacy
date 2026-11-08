"""تحويل sheet-template/products.csv (أو أي CSV اتصدّر من الشيت) إلى data/products.json
الاستخدام:  python3 tools/csv_to_json.py [ملف.csv]
"""
import csv, json, sys
src = sys.argv[1] if len(sys.argv) > 1 else "sheet-template/products.csv"
with open(src, encoding="utf-8-sig", newline="") as f:
    rows = [{(k or "").strip().lower(): (v or "").strip() for k, v in r.items()} for r in csv.DictReader(f)]
with open("data/products.json", "w", encoding="utf-8") as f:
    json.dump({"products": rows}, f, ensure_ascii=False, indent=1)
print(f"تم تحويل {len(rows)} منتج إلى data/products.json")

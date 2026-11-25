"""بيولّد أيقونات تطبيق الأندرويد من android-app/icon-source.png (بيشتغل جوه GitHub Actions)."""
import os, sys
from PIL import Image, ImageDraw
res = sys.argv[1]                      # android-app/android/app/src/main/res
src = Image.open("android-app/icon-source.png").convert("RGBA")
dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}

def circle(im):
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).ellipse((0, 0) + im.size, fill=255)
    o = im.copy(); o.putalpha(m); return o

for d, k in dens.items():
    folder = os.path.join(res, f"mipmap-{d}")
    if not os.path.isdir(folder): continue
    legacy = int(48 * k); fg = int(108 * k)
    sq = src.resize((legacy, legacy), Image.LANCZOS)
    sq.save(os.path.join(folder, "ic_launcher.png"))
    circle(sq).save(os.path.join(folder, "ic_launcher_round.png"))
    canvas = Image.new("RGBA", (fg, fg), (0, 0, 0, 0))
    inner = int(fg * 0.667)   # الدايرة بتملا القناع الدائري بالظبط
    t = src.resize((inner, inner), Image.LANCZOS)
    canvas.paste(t, ((fg - inner) // 2, (fg - inner) // 2), t)
    canvas.save(os.path.join(folder, "ic_launcher_foreground.png"))

# خلفية الأيقونة المتكيّفة = شفافة: الأيقونة دايرة كاملة من غير مربع
vals = os.path.join(res, "values"); os.makedirs(vals, exist_ok=True)
with open(os.path.join(vals, "ic_launcher_background.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#00000000</color>\n</resources>\n')
# ===== أيقونة الإشعارات الصغيرة (لازم أبيض على شفاف علشان مايبقاش مربع أسود) + لون الإشعار =====
stat = os.path.join(os.path.dirname(os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else "android-app/icon-source.png")), "ic_stat_ouf.png")
if os.path.exists(stat):
    st = Image.open(stat).convert("RGBA")
    for d, px in (("mdpi", 24), ("hdpi", 36), ("xhdpi", 48), ("xxhdpi", 72), ("xxxhdpi", 96)):
        dd = os.path.join(res, "drawable-" + d); os.makedirs(dd, exist_ok=True)
        st.resize((px, px), Image.LANCZOS).save(os.path.join(dd, "ic_stat_ouf.png"))
with open(os.path.join(vals, "ouf_notif.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ouf_notif">#E30613</color>\n</resources>\n')
print("icons done")

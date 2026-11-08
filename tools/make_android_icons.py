"""بيولّد أيقونات تطبيق الأندرويد من android-app/icon-source.png (بيشتغل جوه GitHub Actions)."""
import os, sys
from PIL import Image
res = sys.argv[1]                      # android-app/android/app/src/main/res
src = Image.open("android-app/icon-source.png").convert("RGBA")
dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for d, k in dens.items():
    folder = os.path.join(res, f"mipmap-{d}")
    if not os.path.isdir(folder): continue
    legacy = int(48 * k); fg = int(108 * k)
    for name in ("ic_launcher.png", "ic_launcher_round.png"):
        src.resize((legacy, legacy), Image.LANCZOS).save(os.path.join(folder, name))
    canvas = Image.new("RGBA", (fg, fg), (0, 0, 0, 0))
    inner = int(fg * 0.62)
    t = src.resize((inner, inner), Image.LANCZOS)
    canvas.paste(t, ((fg - inner) // 2, (fg - inner) // 2), t)
    canvas.save(os.path.join(folder, "ic_launcher_foreground.png"))
print("icons done")

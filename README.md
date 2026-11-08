# Murad Pharmacy — صيدليات د/ مراد صادق

متجر صيدلية يشتغل على الموبايل (PWA) ويتثبت كتطبيق، وممكن يتحول لـ APK أندرويد.
المنتجات في ملف منفصل أو Google Sheet، والتعرف على الروشتات بالذكاء الاصطناعي عن طريق سيرفر صغير منفصل.

## 1) هيكل المشروع

```
murad-pharmacy/
├─ index.html                  الصفحة (هيكل فقط)
├─ config.js                   إعدادات الصيدلية (الرقم، مصدر المنتجات، رابط الذكاء الاصطناعي)
├─ sw.js                       التشغيل أوفلاين + إدارة التحديثات
├─ manifest.webmanifest        بيانات التثبيت كتطبيق (الاسم، الأيقونات)
├─ assets/
│  ├─ style.css                الشكل
│  ├─ app.js                   المنطق (البحث، السلة، التصوير)
│  ├─ logo.png                 اللوجو
│  ├─ icons/                   أيقونات التطبيق
│  └─ products/                صور المنتجات (اختياري)
├─ data/products.json          قائمة المنتجات (لو مش هتستخدم Google Sheet)
├─ sheet-template/products.csv  نفس القائمة بصيغة CSV تفتحها في الشيت
├─ tools/                      csv_to_json.py + سكربت أيقونات الأندرويد
├─ backend/                    سيرفر الذكاء الاصطناعي (Cloudflare Worker)
├─ android-app/                إعدادات تغليف التطبيق كـ APK
└─ .github/workflows/          النشر التلقائي + بناء الـ APK
```
**مهم:** الموقع نفسه (Pages) بيرفع ملفات الصفحة بس. مجلدات `backend` و`android-app` و`tools` مش بتتنشر.

## 2) إنشاء المستودع على GitHub
1. ادخل github.com ← **New repository** ← الاسم: `murad-pharmacy` ← **Public** (Pages المجاني محتاج Public) ← Create.
2. ارفع كل محتويات المجلد (مش المجلد نفسه) في جذر المستودع. من الكمبيوتر: **Add file ← Upload files** واسحب الملفات والمجلدات. تأكد إن مجلد `.github` اترفع (ملف مخفي في بعض الأجهزة).
   أو بالأوامر:
   ```
   git init && git add . && git commit -m "first version"
   git branch -M main
   git remote add origin https://github.com/USERNAME/murad-pharmacy.git
   git push -u origin main
   ```
3. **Settings ← Pages ← Source: GitHub Actions**.
4. افتح تبويب **Actions** وانتظر أول عملية نشر (دقيقة تقريبًا). رابط الموقع:
   `https://USERNAME.github.io/murad-pharmacy/`

## 3) الإعدادات (config.js)
- `PHARMACY_PHONE`: رقم واتساب الصيدلية بصيغة دولية بدون + (مثال `201012345678`). **لازم تغيره** وإلا الطلبات هتروح لرقم تجريبي.
- `PRODUCTS_SOURCE`: `"json"` (الافتراضي) أو `"sheet"`.
- باقي القيم شرحها جوه الملف.

## 4) إدارة المنتجات
### الطريقة أ: ملف (بدون شيت)
عدّل `data/products.json` مباشرة على GitHub (أيقونة القلم)، أو افتح `sheet-template/products.csv` في Excel/Sheets، عدّل، وبعدين شغّل `python3 tools/csv_to_json.py` وارفع `products.json`. أي تعديل بيتنشر تلقائي.

### الطريقة ب: Google Sheet (الأسهل للتعديل اليومي)
1. في Google Sheets: **File ← Import ← Upload** وارفع `sheet-template/products.csv`. سمّي الورقة **Products**.
2. **Share ← Anyone with the link ← Viewer**.
3. خد رقم الشيت من الرابط (الجزء بين `/d/` و`/edit`).
4. اعمل مفتاح: console.cloud.google.com ← مشروع جديد ← **APIs & Services ← Library ← Google Sheets API ← Enable** ← **Credentials ← Create credentials ← API key**. بعدين **Restrict key**:
   - *Application restrictions*: Websites ← `https://USERNAME.github.io/*`
   - *API restrictions*: Google Sheets API فقط
5. في `config.js`: `PRODUCTS_SOURCE: "sheet"` وحط `ID` و`API_KEY`.

> المفتاح ظاهر لأي حد يفتح الصفحة، علشان كده التقييد في الخطوة 4 ضروري. هو للقراءة فقط ومحدود برابط موقعك. لو الشيت فشل التطبيق بيستخدم آخر نسخة محفوظة أو `products.json`.

### أعمدة الشيت (الصف الأول بالإنجليزي بالظبط)
| العمود | المعنى |
|---|---|
| `id` | رقم ثابت لكل منتج (مثلاً p001). **ما يتغيرش** بعد كده ومايتكررش، لأن السلة بتعتمد عليه |
| `name` | الاسم بالعربي (مطلوب) |
| `name_en` | الاسم الإنجليزي (بيساعد البحث والتصوير) |
| `category` | القسم. أي اسم جديد بيظهر كقسم تلقائي |
| `price` | سعر العلبة |
| `strips` | عدد الشرايط في العلبة. سيبه فاضي لو مفيش خيار شريط |
| `strip_price` | سعر الشريط (اختياري، لو فاضي = سعر العلبة ÷ عدد الشرايط) |
| `image` | رابط الصورة أو مسار زي `assets/products/p001.jpg`. فاضي = أيقونة القسم |
| `keywords` | كلمات بحث إضافية (المادة الفعالة، أسماء بديلة) |
| `stock` | `in` متوفر، أو `out` / `نفذ` لإظهاره "غير متوفر" |
| `active` | `TRUE` يظهر، `FALSE` يتخفى (من غير مسحه) |

لإضافة منتج: صف جديد. لحذفه: `active = FALSE` أو امسح الصف. التعديل بيظهر عند العميل في أول فتح (الأسعار دايمًا بتتحمل من الإنترنت لو متاح).

## 5) التحديثات (مفتاح التثبيت)
- كل نشر على GitHub بيطلّع رقم بناء جديد تلقائي (تاريخ + رقم التعديل) بيتحط في `sw.js` و`config.js`.
- العميل اللي فاتح التطبيق بتظهر له رسالة **"في نسخة جديدة — حدّث الآن"**، وبضغطة واحدة بيتحدث من غير ما يمسح حاجة. وفي الإعدادات زرار "تحقق الآن".
- التحديث بيحصل فوق النسخة القديمة، وسلة العميل وبياناته (محفوظة في المتصفح) بتفضل زي ما هي.
- **ماتحتاجش تغير أي رقم بإيدك.** لو عايز تغير رقم "الإصدار" الظاهر، عدّل `APP_VERSION` في `config.js`.

## 6) تثبيته كتطبيق
### أ) من غير APK (الأسهل، وبيتحدث لوحده)
أندرويد/كروم: افتح الرابط ← قائمة ⋮ ← **Install app / Add to Home screen**. آيفون/سفاري: Share ← **Add to Home Screen**.

### ب) APK (للتوزيع أو الرفع على Google Play)
المفتاح (Keystore) هو "توقيع" تطبيقك. **أي تحديث لازم يتوقع بنفس المفتاح** وإلا أندرويد يرفض التثبيت فوق القديم. ورقم النسخة (`versionCode`) بيزيد لوحده مع كل بناء.

1. **اعمل المفتاح مرة واحدة** (على كمبيوتر فيه Java):
   ```
   keytool -genkeypair -v -keystore murad-release.jks -alias murad -keyalg RSA -keysize 2048 -validity 10000
   ```
   اكتب كلمة سر قوية. **احفظ الملف وكلمة السر في مكانين آمنين (مش على GitHub). لو ضاعوا مش هتقدر تحدث التطبيق أبدًا.**
2. حوّل الملف لنص: Linux/Mac `base64 -w0 murad-release.jks`، وويندوز PowerShell:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("murad-release.jks"))`
3. في المستودع: **Settings ← Secrets and variables ← Actions ← New repository secret** وأضف 4 أسرار:
   `ANDROID_KEYSTORE_BASE64` (النص من الخطوة 2) · `ANDROID_KEYSTORE_PASSWORD` · `ANDROID_KEY_ALIAS` (= `murad`) · `ANDROID_KEY_PASSWORD`
4. **Actions ← Build Android APK ← Run workflow**. بعد حوالي 5 دقايق حمّل الملف من **Artifacts**.
5. لكل تحديث: شغّل نفس الـ Workflow تاني وثبّت الـ APK الجديد فوق القديم. بيتحدث ويحتفظ ببيانات العميل.

> ملحوظة: التطبيق بيحمّل المنتجات من الإنترنت، فتعديل الأسعار مش محتاج APK جديد، ومحتاج بس لو غيرت الكود أو التصميم.

## 7) صور المنتجات
ارفع الصورة في `assets/products/` (يفضل JPG بعرض 600 بكسل تقريبًا ≤ 80KB) واكتب مسارها في عمود `image`. أو حط رابط مباشر من أي موقع صور (روابط Google Drive العادية **مش** بتشتغل كصور).

## 8) الذكاء الاصطناعي لقراءة الروشتات (اختياري)
من غيره التطبيق بيقرأ **العلب المطبوعة** بالقارئ المدمج، لكن **الخط اليدوي** محتاج السيرفر ده.
GitHub Pages ما بيقدرش يخبي مفتاح، فالسيرفر بيتعمل منفصل (Cloudflare Workers مجاني للاستخدام الخفيف).
1. اعمل حساب على cloudflare.com، وخد مفتاح API من console.anthropic.com (حدد حد صرف شهري من إعدادات الحساب).
2. عدّل `backend/wrangler.toml`: غيّر `USERNAME` لاسم حسابك.
3. على كمبيوتر فيه Node:
   ```
   cd backend
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY     # الصق المفتاح هنا
   npx wrangler deploy
   ```
4. هتاخد رابط زي `https://murad-pharmacy-ai.xxx.workers.dev`. حطه في `config.js` في `RECOGNIZE_URL`.
5. السيرفر بيقبل طلبات من موقعك وتطبيقك بس (`ALLOWED_ORIGINS`). النموذج قابل للتغيير من `MODEL` في نفس الملف.

الذكاء الاصطناعي بيستخرج **أسماء الأدوية بس**، والتطابق مع قائمتك بيتم داخل التطبيق، والعميل بيراجع القائمة ويختار الكمية قبل الإضافة للسلة.

## 9) قبل الإطلاق
- [ ] غيّرت `PHARMACY_PHONE` ودخلت جربت طلب واتساب.
- [ ] راجعت الأسعار والأقسام والـ `strips`.
- [ ] جربت الموقع من موبايل حقيقي (الكاميرا + إضافة للشاشة الرئيسية).
- [ ] حفظت المفتاح (keystore) في مكانين لو هتعمل APK.

## مشاكل شائعة
- **صفحة فاضية بعد النشر:** تأكد إن Pages على "GitHub Actions" وإن الـ Workflow اشتغل (علامة ✓ خضرا).
- **المنتجات مش بتتحدث:** افتح الإعدادات ← "تحقق الآن"، أو اقفل التطبيق وافتحه. وتأكد إن الشيت Viewer لأي حد معاه الرابط وإن المفتاح مقيّد بالرابط الصح.
- **الكاميرا مش بتفتح في الـ APK:** تأكد إنك بنيت بالـ Workflow (بيضيف صلاحية الكاميرا).

/**
 * نظام الطلبات والطيارين - صيدلية عوف (النسخة 2: مع تطبيق الطيار Ouf-Farmacy-Rider)
 * ده مشروع Apps Script لوحده (مشروع "اوردارس"). الصقه كله في ملف الكود ثم Deploy كـ Web app.
 * نفس الملف بيخدّم تطبيق العميل (newOrder / myOrders) وتطبيق الطيار (باقي الإجراءات تحت).
 *
 * بيعمل:
 *  - setupSheets(): تشغّلها مرة واحدة، بتجهّز ورقة "الطلبات" و"الطيارين" و"الطلبات المكتملة".
 *  - استقبال أوردر جديد من التطبيق (newOrder) وبعتله إشعار Firebase لكل الطيارين الشغالين.
 *  - إرجاع حالة طلبات العميل لصفحة "مشترياتي" (myOrders).
 *  - تطبيق الطيار: تسجيل دخول / تسجيل جديد (بموافقتك من الشيت) / قبول (أسرع طيار) / تحريك المراحل / وصول متوقع.
 *  - onEdit: تلوين الصف حسب الحالة، وأرشفة الأوردر أول ما تعلّم "تم التوصيل".
 *
 * إعدادات الإشعارات (مرة واحدة): Project Settings ← Script properties، ضيف:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY  (من ملف Service Account)
 *   RIDER_WEB_URL (اختياري): رابط موقع الطيار على GitHub Pages، بيتفتح لما الطيار يدوس على إشعار المتصفح.
 * وبعدها شغّل testFirebase() من المحرر للتأكد.
 */

var SPREADSHEET_ID = "199-5mWgHEsepqmA8b5CmONGD8sBGctxKyoKBeFN-Otk";   // نفس شيت الصيدلية
var ORD_TAB = "الطلبات";
var ARC_TAB = "الطلبات المكتملة";
var PIL_TAB = "الطيارين";
var TZ = "Africa/Cairo";
var STORE_LOCATION = "https://maps.app.goo.gl/DFB78syKW2qDACz8A";   // لوكيشن الصيدلية: بيتكتب في عمود "لوكيشن المحل" لكل أوردر جديد (وتقدر تعدّله في أي صف)
var STORE_COORDS = { lat: 30.121208, lng: 31.2491106 };              // نفس مكان الصيدلية بالإحداثيات (احتياطي لو فك اللينك فشل)
var KM_RATE = 10;                   // تسعيرة الكيلو الافتراضية (بتتكتب في عمود "تسعيرة الكيلو" لكل أوردر، وتقدر تعدّلها هناك)
var ARRIVE_M = 25;                  // المندوب "وصل" لما يفضل عليه حوالي كده متر (على الطريق مش خط مستقيم)

var SCRIPT_VERSION = "murad-rider-2026-11-13";
var MAX_ACTIVE = 3;                 // أقصى عدد طلبات ممكن الطيار الواحد يكون شايلها في نفس الوقت (غيّره لو عايز)
var FCM_CHANNEL = "ouf_orders_v2"; // لازم يطابق قناة الإشعارات في تطبيق الطيار
var LOGIN_MAX_FAILS = 8;            // محاولات دخول غلط قبل القفل المؤقت (10 دقايق)
var VEHICLES = ["موتوسيكل", "عجلة كهربائية", "عجلة عادية", "سكوتر"];

// ترتيب أعمدة "الطلبات" (بالظبط زي ما طلبته)
var HDR_RATE = "تسعيرة الكيلو", HDR_P1N = "اسم الطيار السابق المستلم 1", HDR_P1P = "رقم الطيار السابق المستلم 1", HDR_P2N = "اسم الطيار السابق المستلم 2", HDR_P2P = "رقم الطيار السابق المستلم 2";
var ORD_HEADERS = ["رقم", "رقم البون", "التاريخ واليوم", "الوقت", "اسم العميل", "رقم التليفون", "اسم العزبة / المنطقة", "الشارع / شارع كام",
  "علامة مميزة بجوار البيت", "لوكيشن العميل", "تفاصيل الأوردر", "لوكيشن المحل", "ملحوظة", "اجمالي حساب العميل", HDR_RATE, "تم قبول الاوردر",
  HDR_P1N, HDR_P1P, HDR_P2N, HDR_P2P, "اسم الطيار المستلم", "رقم الطيار المستلم", "الوصول الي المحل خلال", "جاري التجهيز", "جاري التوصيل", "الوصول الي العميل خلال",
  "تم التوصيل", "نتيجة الإشعار", "خطوات التنفيذ"];
var O = { NUM: 1, BON: 2, DATE: 3, TIME: 4, NAME: 5, PHONE: 6, AREA: 7, STREET: 8, LANDMARK: 9, CLOC: 10, DETAILS: 11, SLOC: 12, NOTE: 13, TOTAL: 14, RATE: 15,
  ACCEPT: 16, P1N: 17, P1P: 18, P2N: 19, P2P: 20, PNAME: 21, PPHONE: 22, SHOP_ETA: 23, PREP: 24, DELIV: 25, CUST_ETA: 26, DONE: 27, NOTIF: 28, STEPS: 29 };
var O_CID = 30;    // عمود مخفي: معرّف الطلب (بيربط الطلب بالجهاز اللي عمله، ومنه بيتمنع التكرار وبيتحمي خصوصية العميل)
// أعمدة مساعدة بعد معرّف الطلب (أرقام فعلية بيقراها البرنامجين، وعمود "اجمالي حساب العميل" بيتكتب نص: ح 1150 + ت 100 = ا 1250)
var O_KM = 31, O_FEE = 32, O_GOODS = 33, O_SIG = 34, O_ARR = 35;
var HELPER_HEADERS = ["معرّف الطلب (لا تلمسه)", "المسافة (كم)", "قيمة التوصيل", "حساب البضاعة", "بصمة التسعير (لا تلمسها)", "وصول المندوب"];
var A_AT = 36;     // في ورقة المكتملة: وقت الأرشفة

// ترتيب أعمدة "الطيارين"
var PIL_HEADERS = ["رقم", "اسم الطيار", "رقم الهاتف", "الباسورد", "العنوان", "رقم البطاقه", "تاريخ الميلاد", "السن الحالي", "المركبه",
  "حالة الطلب", "وقت وتارخ قبول الطلب", "حالة الطيار", "شيفت الطيار", "المحفظه", "توكن الإشعارات"];
var P = { NUM: 1, NAME: 2, PHONE: 3, PASS: 4, ADDR: 5, ID: 6, BIRTH: 7, AGE: 8, VEH: 9, REQ: 10, REQ_AT: 11, STATE: 12, SHIFT: 13, WALLET: 14, TOKEN: 15 };
var PIL_AVAIL_FORMULA = '=IFERROR(ARRAYFORMULA(FILTER(TRIM(B2:B)&IF(TRIM(I2:I)<>""," - "&TRIM(I2:I),""), TRIM(J2:J)="مقبول", TRIM(L2:L)="يعمل", TRIM(M2:M)="يعمل الان")),"")';   // الاسم كما هو مكتوب - المركبة، بس لو الـ3 شروط متحققين: حالة الطلب مقبول + حالة الطيار يعمل + الشيفت يعمل الان
var PIL_LIST_AVAIL = 21;   // عمود تلقائي: الطيارين المتاحين دلوقتي بالشكل "الاسم - المركبة" (مقبول + مش موقوف + يعمل الان)
var PIL_LIST_REQ = 18, PIL_LIST_STATE = 19;   // عمودين القوائم المنسدلة (جنب الجدول بعد عمودين فاضيين)

// ===== تجهيز الورق (شغّلها مرة واحدة من Apps Script: اختار setupSheets واضغط Run) =====
function setupSheets() {
  var ss = ssOpen_();
  setupOrders_(ss);
  setupArchive_(ss);
  setupPilots_(ss);
  SpreadsheetApp.flush();
  return "تم تجهيز: " + ORD_TAB + " + " + ARC_TAB + " + " + PIL_TAB;
}

function headerStyle_(rng) {
  rng.setFontWeight("bold").setBackground("#111827").setFontColor("#E6C36A").setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true)
    .setBorder(true, true, true, true, true, true, "#4B5563", SpreadsheetApp.BorderStyle.SOLID);
}

// ===== ترحيل الأعمدة الجديدة تلقائياً للشيت القديم (بيتنفذ مرة واحدة، من غير ما تلمس حاجة) =====
var SCHEMA_DONE_ = false;
function ensureSchema_(ss) {
  if (SCHEMA_DONE_) return;
  var cache = CacheService.getScriptCache();
  if (cache.get("schema_v3")) { SCHEMA_DONE_ = true; return; }
  var lk = LockService.getScriptLock(), mine = false;
  if (!lk.hasLock()) { lk.waitLock(25000); mine = true; }
  try {
    [ORD_TAB, ARC_TAB].forEach(function (tab) {
      var sh = ss.getSheetByName(tab); if (!sh || sh.getLastColumn() < 3) return;
      var archived = tab === ARC_TAB, hd = function () { return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String); }, h = hd(), last = sh.getLastRow();
      // 1) تسعيرة الكيلو بعد "اجمالي حساب العميل"
      if (h[O.TOTAL - 1] === ORD_HEADERS[O.TOTAL - 1] && h[O.RATE - 1] !== HDR_RATE) {
        sh.insertColumnAfter(O.TOTAL); sh.getRange(1, O.RATE).setValue(HDR_RATE);
        if (last >= 2) sh.getRange(2, O.RATE, last - 1, 1).setValue(KM_RATE);
        h = hd();
      }
      // 2) السابق 1 و 2 (اسم + رقم) بين "تم قبول الاوردر" و "اسم الطيار المستلم"
      if (h[O.ACCEPT - 1] === ORD_HEADERS[O.ACCEPT - 1] && h[O.P1N - 1] !== HDR_P1N) {
        sh.insertColumnsAfter(O.ACCEPT, 4); sh.getRange(1, O.P1N, 1, 4).setValues([[HDR_P1N, HDR_P1P, HDR_P2N, HDR_P2P]]);
        h = hd();
      }
      // 3) الأعمدة المساعدة بعد معرّف الطلب
      ensureCols_(sh, A_AT);
      if (h[O_KM - 1] !== HELPER_HEADERS[1]) {
        if (archived && h.length >= O_CID + 1 && h[O_CID] !== HELPER_HEADERS[1]) sh.insertColumnsAfter(O_CID, 5);
        sh.getRange(1, O_CID, 1, HELPER_HEADERS.length).setValues([HELPER_HEADERS]);
        if (archived && sh.getLastColumn() >= A_AT) sh.getRange(1, A_AT).setValue("وقت الأرشفة");
      }
    });
    cache.put("schema_v3", "1", 21600); SCHEMA_DONE_ = true;
  } finally { if (mine) { try { lk.releaseLock(); } catch (e) {} } }
}

function styleHelperHeaders_(sh, from) {
  var rg = sh.getRange(1, from, 1, HELPER_HEADERS.length);
  rg.setFontWeight("bold").setBackground("#1F2937").setFontColor("#9CA3AF").setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
}
var ORD_WIDTHS_ = [50, 80, 130, 80, 150, 120, 150, 170, 170, 150, 320, 150, 160, 150, 90, 90, 150, 130, 150, 130, 220, 130, 130, 90, 90, 130, 90, 170, 200, 100, 90, 90, 100, 90, 120];

function setupOrders_(ss) {
  var sh = ss.getSheetByName(ORD_TAB);
  if (sh) ensureSchema_(ss); else sh = ss.insertSheet(ORD_TAB);
  ensureCols_(sh, A_AT);
  sh.setRightToLeft(true);
  sh.getRange(1, 1, 1, ORD_HEADERS.length).setValues([ORD_HEADERS]);
  headerStyle_(sh.getRange(1, 1, 1, ORD_HEADERS.length));
  sh.getRange(1, O_CID, 1, HELPER_HEADERS.length).setValues([HELPER_HEADERS]);
  styleHelperHeaders_(sh, O_CID);
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 44);
  sh.hideColumns(O_CID); sh.hideColumns(O_SIG);
  ORD_WIDTHS_.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  var rows = Math.max(sh.getMaxRows() - 1, 1);
  [O.ACCEPT, O.PREP, O.DELIV, O.DONE].forEach(function (c) { sh.getRange(2, c, rows, 1).insertCheckboxes(); });
  sh.getRange(2, O.PHONE, rows, 1).setNumberFormat("@");
  [O.P1P, O.P2P, O.PPHONE].forEach(function (c) { sh.getRange(2, c, rows, 1).setNumberFormat("@"); });
  sh.getRange(2, O.DETAILS, rows, 1).setWrap(true);
  // قائمة منسدلة لاسم الطيار: بس الطيارين المقبولين + حسابهم مفعل + شيفتهم "يعمل الان" (بالشكل: الاسم - المركبة)
  var pil = ss.getSheetByName(PIL_TAB);
  if (pil) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInRange(pil.getRange(2, PIL_LIST_AVAIL, Math.max(pil.getMaxRows() - 1, 1), 1), true).setAllowInvalid(false).build();
    sh.getRange(2, O.PNAME, rows, 1).setDataValidation(rule);
  }
}

function setupArchive_(ss) {
  var sh = ss.getSheetByName(ARC_TAB);
  if (sh) ensureSchema_(ss); else sh = ss.insertSheet(ARC_TAB);
  ensureCols_(sh, A_AT);
  sh.setRightToLeft(true);
  var h = ORD_HEADERS.concat(HELPER_HEADERS).concat(["وقت الأرشفة"]);
  sh.getRange(1, 1, 1, h.length).setValues([h]);
  headerStyle_(sh.getRange(1, 1, 1, ORD_HEADERS.length));
  styleHelperHeaders_(sh, O_CID);
  headerStyle_(sh.getRange(1, A_AT));
  sh.setFrozenRows(1);
  sh.hideColumns(O_CID); sh.hideColumns(O_SIG);
  ORD_WIDTHS_.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function setupPilots_(ss) {
  var sh = ss.getSheetByName(PIL_TAB) || ss.insertSheet(PIL_TAB);
  sh.setRightToLeft(true);
  sh.getRange(1, 1, 1, PIL_HEADERS.length).setValues([PIL_HEADERS]);
  headerStyle_(sh.getRange(1, 1, 1, PIL_HEADERS.length));
  // جدولين القوائم (جنب الجدول بعد عمودين فاضيين)
  sh.getRange(1, PIL_LIST_REQ, 1, 2).setValues([["حالة الطلب", "حالة الطيار"]]);
  headerStyle_(sh.getRange(1, PIL_LIST_REQ, 1, 2));
  sh.getRange(2, PIL_LIST_REQ, 3, 1).setValues([["منتظر"], ["مقبول"], ["مرفوض"]]);
  sh.getRange(2, PIL_LIST_STATE, 3, 1).setValues([["يعمل"], ["موقوف مؤقتاً"], ["موقوف نهائي"]]);
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 44);
  var rows = Math.max(sh.getMaxRows() - 1, 1);
  sh.getRange(2, P.REQ, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(sh.getRange(2, PIL_LIST_REQ, 3, 1), true).setAllowInvalid(false).build());
  sh.getRange(2, P.STATE, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(sh.getRange(2, PIL_LIST_STATE, 3, 1), true).setAllowInvalid(false).build());
  [P.PHONE, P.PASS, P.ID, P.BIRTH, P.TOKEN].forEach(function (c) { sh.getRange(2, c, rows, 1).setNumberFormat("@"); });
  sh.getRange(2, P.WALLET, rows, 1).setNumberFormat("0.00");
  var widths = [50, 160, 130, 110, 200, 150, 110, 90, 110, 110, 160, 120, 120, 100, 220];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setColumnWidth(16, 30); sh.setColumnWidth(17, 30);
  // قائمة تلقائية بالطيارين المتاحين (مقبول + مش موقوف + "يعمل الان") بالشكل: الاسم - المركبة. بتتحدث لوحدها لما حالتهم تتغير
  sh.getRange(1, PIL_LIST_AVAIL).setValue("الطيارين المتاحين دلوقتي (تلقائي - لا تلمسه)");
  headerStyle_(sh.getRange(1, PIL_LIST_AVAIL));
  sh.getRange(2, PIL_LIST_AVAIL).setFormula(PIL_AVAIL_FORMULA);
  sh.setColumnWidth(PIL_LIST_AVAIL, 260);
}

// ===== أدوات =====
var AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
function nowParts_() {
  var d = new Date();
  var day = AR_DAYS[Number(Utilities.formatDate(d, TZ, "u")) % 7];   // u: 1=الإثنين ... 7=الأحد
  var ap = Utilities.formatDate(d, TZ, "a") === "AM" ? "ص" : "م";
  return { date: day + " " + Utilities.formatDate(d, TZ, "dd/MM/yyyy"), time: Utilities.formatDate(d, TZ, "hh:mm") + " " + ap };
}
function ordersSheet_(ss) { return ss.getSheetByName(ORD_TAB) || (setupOrders_(ss), ss.getSheetByName(ORD_TAB)); }
function isTrue_(v) { return v === true || String(v).toUpperCase() === "TRUE"; }
function cleanCid_(v) { return String(v == null ? "" : v).replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 40); }
function txt_(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max || 500); }
function normPhone_(v) {
  var s = String(v == null ? "" : v).replace(/[٠-٩]/g, function (x) { return "٠١٢٣٤٥٦٧٨٩".indexOf(x); }).replace(/\D/g, "");
  if (s.indexOf("20") === 0 && s.length === 12) s = "0" + s.slice(2);
  if (/^1[0125]\d{8}$/.test(s)) s = "0" + s;      // الشيت بيشيل الصفر من الأرقام المخزنة كأرقام
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === "myOrders") return out_(myOrders_(p.ids));
    return out_({ ok: true, service: "orders", version: SCRIPT_VERSION });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}
// الإجراءات اللي بتقرا بس (من غير قفل) علشان تطبيق الطيار بيسأل كل كام ثانية ومينفعش يتزاحم على القفل
var RIDER_READ = { pilotLogin: 1, riderOrders: 1 };
var RIDER_WRITE = { pilotRegister: 1, riderAccept: 1, riderStage: 1, riderRelease: 1, riderEta: 1, riderShift: 1, riderToken: 1, riderNear: 1, riderNotify: 1 };
var LATER_ = [], INPOST_ = false;
function later_(fn) { if (INPOST_) LATER_.push(fn); else { try { fn(); } catch (x) {} } }      // شغل بيتنفّذ بعد ما القفل يتفك (زي إرسال الإشعارات) علشان ميأخرش باقي الطلبات
function withLock_(fn) { var lock = LockService.getScriptLock(); lock.waitLock(20000); try { return fn(); } finally { try { lock.releaseLock(); } catch (x) {} } }
function doPost(e) {
  LATER_ = []; INPOST_ = true;
  var res = doPost_(e);
  INPOST_ = false; var q = LATER_; LATER_ = [];
  q.forEach(function (fn) { try { fn(); } catch (x) {} });
  return res;
}
function doPost_(e) {
  try {
    var d = JSON.parse(e.postData.contents), a = d.action;
    if (a === "pilotLogin") return out_(pilotLogin_(d));
    if (a === "riderOrders") return out_(riderOrders_(d));
    if (a !== "newOrder" && a !== "custToken" && !RIDER_WRITE[a]) return out_({ ok: false, error: "action" });
    // اللي مش محتاج قفل (كتابة خلية واحدة / إشعار / حساب مسافة): بيتنفّذ فوراً من غير ما يستنّى حد
    if (a === "riderShift") return out_(riderShift_(d));
    if (a === "riderToken") return out_(riderToken_(d));
    if (a === "riderNear") return out_(riderNear_(d));
    if (a === "riderEta") return out_(riderEta_(d));
    if (a === "riderNotify") return out_(riderNotify_(d));
    if (a === "custToken") return out_({ ok: withLock_(function () { return saveCustToken_(ssOpen_(), d.cids, d.token, d.phone, d.device); }) });
    // قبول/مراحل/تنازل/طلب جديد/تسجيل: لازم يتنفّذوا واحد ورا التاني
    return withLock_(function () {
      if (a === "newOrder") return out_(newOrder_(d));
      if (a === "pilotRegister") return out_(pilotRegister_(d));
      if (a === "riderAccept") return out_(riderAccept_(d));
      if (a === "riderStage") return out_(riderStage_(d));
      if (a === "riderRelease") return out_(riderRelease_(d));
      return out_({ ok: false, error: "action" });
    });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}
function ssOpen_() { var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); ensureSchema_(ss); return ss; }
function ensureCols_(sh, n) { var m = sh.getMaxColumns(); if (m < n) sh.insertColumnsAfter(m, n - m); }

// آخر صف فيه أوردر فعلاً (بنعدّ على عمود رقم البون، لأن مربعات الاختيار بتخلّي getLastRow يرجّع آخر الورقة)
function dataLast_(sh) {
  var n = sh.getMaxRows();
  if (n < 2) return 1;
  var v = sh.getRange(2, O.BON, n - 1, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (v[i][0] !== "" && v[i][0] !== null) return i + 2;
  return 1;
}

function findByCid_(sh, cid) {
  var n = sh.getLastRow();
  if (n < 2 || !cid) return 0;
  var v = sh.getRange(2, O_CID, n - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]) === cid) return i + 2;
  return 0;
}

// ===== استقبال أوردر جديد من التطبيق =====
function newOrder_(d) {
  var cid = cleanCid_(d.cid), phone = normPhone_(d.phone);
  var name = txt_(d.name, 80), items = txt_(d.items, 3000);
  var total = Number(d.total) || 0;
  if (!cid || !/^01[0125]\d{8}$/.test(phone) || !name || !items || total < 0) return { ok: false, error: "invalid" };
  var ss = ssOpen_();

  var sh = ordersSheet_(ss), arc = ss.getSheetByName(ARC_TAB);
  var row = findByCid_(sh, cid);                       // نفس الطلب وصل قبل كده (إعادة محاولة): نرجّع نفس البون
  if (row) return { ok: true, bon: Number(sh.getRange(row, O.BON).getValue()), dup: true };
  if (arc) { var ar = findByCid_(arc, cid); if (ar) return { ok: true, bon: Number(arc.getRange(ar, O.BON).getValue()), dup: true }; }

  var last = dataLast_(sh), bon = 1001;
  if (last >= 2) { var lb = Number(sh.getRange(last, O.BON).getValue()); if (lb > 0) bon = lb + 1; }
  if (arc && arc.getLastRow() >= 2) {                  // البون يكمّل بعد آخر بون اتأرشف كمان
    var ab = Number(arc.getRange(arc.getLastRow(), O.BON).getValue()); if (ab >= bon) bon = ab + 1;
  }
  var t = nowParts_();
  var vals = []; for (var k = 0; k < O_ARR; k++) vals[k] = "";
  vals[O.NUM - 1] = Math.max(last, 1);
  vals[O.BON - 1] = bon; vals[O.DATE - 1] = t.date; vals[O.TIME - 1] = t.time;
  vals[O.NAME - 1] = name; vals[O.PHONE - 1] = phone;
  vals[O.AREA - 1] = txt_(d.gov, 40); vals[O.STREET - 1] = txt_(d.addr, 250); vals[O.LANDMARK - 1] = txt_(d.landmark, 120);
  vals[O.CLOC - 1] = normLoc_(d.location); vals[O.DETAILS - 1] = items; vals[O.SLOC - 1] = STORE_LOCATION;
  vals[O.NOTE - 1] = txt_(d.notes, 300); vals[O.TOTAL - 1] = totalText_(total, 0); vals[O.RATE - 1] = KM_RATE; vals[O_GOODS - 1] = total; vals[O_FEE - 1] = 0;
  vals[O.ACCEPT - 1] = false; vals[O.PNAME - 1] = ""; vals[O.PPHONE - 1] = ""; vals[O.SHOP_ETA - 1] = "";
  vals[O.PREP - 1] = false; vals[O.DELIV - 1] = false; vals[O.CUST_ETA - 1] = ""; vals[O.DONE - 1] = false;
  vals[O.NOTIF - 1] = ""; vals[O.STEPS - 1] = ""; vals[O_CID - 1] = cid;
  var r = last + 1;
  if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 100);
  sh.getRange(r, 1, 1, vals.length).setValues([vals]);
  sh.getRange(r, O.PHONE).setNumberFormat("@").setValue(phone);
  [O.ACCEPT, O.PREP, O.DELIV, O.DONE].forEach(function (c) { sh.getRange(r, c).insertCheckboxes().setValue(false); });
  try { styleOrderRow_(sh, r); } catch (e) {}
  later_(function () { try { sh.getRange(r, O.NOTIF).setValue(broadcastToRiders_("\u200Fطلب جديد \u200E#" + bon + "\u200E 🧾⚠️", "في طلب جديد، افتح التطبيق واقبله قبل غيرك", "new_order_" + bon, { type: "new_order", bon: bon })); } catch (e) {} });
  try { var lc = String(vals[O.CLOC - 1] || ""); if (lc) afterLocation_(ss, sh, r, phone, lc); } catch (e) {}   // فهم اللوكيشن (لينك مختصر ← إحداثيات) + حفظه في ورقة العملاء
  try { priceOrder_(sh, r); } catch (e) {}                                                                  // حساب التوصيل (مسافة الطريق × التسعيرة)
  return { ok: true, bon: bon };
}

// ===== حالة طلبات العميل (صفحة مشترياتي) =====
// التطبيق بيبعت معرّفات طلباته هو بس (ids)، فمحدش يقدر يشوف طلبات غيره حتى لو عرف رقمه.
function myOrders_(idsParam) {
  var ids = String(idsParam || "").split(",").map(cleanCid_).filter(Boolean).slice(0, 40);
  var want = {}; ids.forEach(function (i) { want[i] = 1; });
  var ss = ssOpen_(), out = [];
  var sh = ss.getSheetByName(ORD_TAB), arc = ss.getSheetByName(ARC_TAB);
  function pull(s, archived) {
    if (!s || s.getLastRow() < 2) return;
    var n = (archived ? s.getLastRow() : dataLast_(s)) - 1, w = archived ? A_AT : O_ARR;
    if (n < 1) return;
    var v = s.getRange(2, 1, n, w).getValues();
    for (var i = 0; i < v.length; i++) {
      var r = v[i], cid = String(r[O_CID - 1]);
      if (!want[cid]) continue;
      if (!archived) r = pricedRow_(s, i + 2, r);      // التوصيل يتحدّث لوحده لو اللوكيشن/التسعيرة اتغيرت
      var st = "pending";
      if (archived || isTrue_(r[O.DONE - 1])) st = "completed";
      else if (isTrue_(r[O.DELIV - 1])) st = "delivering";
      else if (isTrue_(r[O.PREP - 1])) st = "preparing";
      else if (isTrue_(r[O.ACCEPT - 1])) st = "accepted";
      var at = archived && r[A_AT - 1] ? Utilities.formatDate(new Date(r[A_AT - 1]), TZ, "dd/MM/yyyy hh:mm a") : "", cl = String(r[O.CLOC - 1] || "").trim();
      var goods = goodsOf_(r), fee = feeOf_(r);
      out.push({ cid: cid, bon: Number(r[O.BON - 1]) || 0, date: String(r[O.DATE - 1]), time: String(r[O.TIME - 1]), items: String(r[O.DETAILS - 1]),
        total: goods, fee: fee, km: Number(r[O_KM - 1]) || 0, hasLoc: !!cl, priced: !cl || !needsPrice_(r), arrived: !archived && !!r[O_ARR - 1],
        status: st, pilotName: bareName_(r[O.PNAME - 1]), pilotPhone: String(r[O.PPHONE - 1] || "").replace(/'/g, ""),
        shopEta: String(r[O.SHOP_ETA - 1] || ""), custEta: String(r[O.CUST_ETA - 1] || ""), doneAt: at });
    }
  }
  pull(sh, false); pull(arc, true);
  return { ok: true, orders: out };
}

// ===== تلوين صف الأوردر حسب حالته =====
function styleOrderRow_(sh, r) {
  var v = sh.getRange(r, 1, 1, O.DONE).getValues()[0];
  var bg = "#0B0F19", fg = "#F3F4F6";
  if (isTrue_(v[O.DONE - 1])) { bg = "#1F2937"; fg = "#9CA3AF"; }
  else if (isTrue_(v[O.DELIV - 1])) { bg = "#ADFF2F"; fg = "#111827"; }
  else if (isTrue_(v[O.PREP - 1])) { bg = "#E0F2FE"; fg = "#111827"; }
  else if (isTrue_(v[O.ACCEPT - 1])) { bg = "#064E3B"; fg = "#F3F4F6"; }
  var rng = sh.getRange(r, 1, 1, ORD_HEADERS.length);
  rng.setBackground(bg).setFontColor(fg).setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true, "#4B5563", SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(r, O.DETAILS).setWrap(true);
}

// بيسجّل الطيار اللي اتشال من الأوردر (السابق 1 ثم السابق 2): الاسم - المركبة + رقمه
function pushPrev_(sh, r, name, phone) {
  name = String(name || "").trim(); if (!name) return;
  var rg = sh.getRange(r, O.P1N, 1, 4), v = rg.getValues()[0];
  if (!String(v[0]).trim() || String(v[0]).trim() === "--") { v[0] = name; v[1] = phone; }
  else if (!String(v[2]).trim() || String(v[2]).trim() === "--") { v[2] = name; v[3] = phone; }
  else { v[0] = v[2]; v[1] = v[3]; v[2] = name; v[3] = phone; }          // أكتر من تبديلتين: بنحتفظ بآخر اتنين
  rg.setNumberFormat("@"); rg.setValues([[String(v[0]), String(v[1]), String(v[2]), String(v[3])]]);
}
function findPilotByLabel_(pil, label) {
  var nm = bareName_(label).toLowerCase(); if (!nm || !pil || pil.getLastRow() < 2) return null;
  var pv = pil.getRange(2, 1, pil.getLastRow() - 1, P.VEH).getValues();
  for (var i = 0; i < pv.length; i++) if (String(pv[i][P.NAME - 1]).trim().toLowerCase() === nm) return { name: String(pv[i][P.NAME - 1]).trim(), veh: String(pv[i][P.VEH - 1] || "").trim(), phone: normPhone_(pv[i][P.PHONE - 1]) };
  return null;
}
var pilotLabel_ = function (name, veh) { return String(name) + (veh ? " - " + veh : ""); };
function archiveOrder_(sh, r, atMs) {
  var ss = sh.getParent(), arc = ss.getSheetByName(ARC_TAB);
  if (!arc) { setupArchive_(ss); arc = ss.getSheetByName(ARC_TAB); }
  var row = sh.getRange(r, 1, 1, O_ARR).getValues()[0];
  [O.P1N, O.P1P, O.P2N, O.P2P].forEach(function (c) { if (!String(row[c - 1]).trim()) row[c - 1] = "--"; });   // مفيش طيار سابق = "--" (يعني نفس الطيار هو اللي وصّل)
  var now = Date.now(), at = Number(atMs);
  row.push(new Date(at > now - 3 * 864e5 && at <= now ? at : now));   // وقت التسليم الحقيقي عند الطيار (لو اتبعت متأخر بسبب النت)
  arc.appendRow(row);
  var ar = arc.getLastRow();
  [O.PHONE, O.PPHONE, O.P1P, O.P2P].forEach(function (c) { arc.getRange(ar, c).setNumberFormat("@").setValue(normPhone_(row[c - 1]) || String(row[c - 1])); });
  sh.deleteRow(r);
}

// ===== تعديلات الشيت اليدوية (trigger تلقائي، مش محتاج تركيب) =====
function onEdit(e) {
  try {
    var rg = e.range, sh = rg.getSheet(), r = rg.getRow(), c = rg.getColumn(), nm = sh.getName();
    if (r < 2) return;
    if (nm === ORD_TAB) {
      if (c === O.DONE && isTrue_(rg.getValue())) { stageNotify_(sh, r, "done"); archiveOrder_(sh, r); return; }       // تم التوصيل: يتنقل لـ "الطلبات المكتملة"
      if (c === O.PNAME) {                                                                // اختيار الطيار: رقمه يتكتب لوحده + الطيار اللي اتشال يتسجل "سابق"
        var nv = String(rg.getValue() == null ? "" : rg.getValue()).trim(), ov = String(e.oldValue == null ? "" : e.oldValue).trim();
        var dk = "ed_" + r + "_" + hash_(ov + "|" + nv), cc = CacheService.getScriptCache();
        if (cc.get(dk)) return; cc.put(dk, "1", 6);                                              // نفس التعديل متسجلش مرتين
        var oldPhone = String(sh.getRange(r, O.PPHONE).getValue() || "").replace(/'/g, "");
        var fp = nv ? findPilotByLabel_(sh.getParent().getSheetByName(PIL_TAB), nv) : null;
        if (ov && ov !== nv && !(fp && pilotLabel_(fp.name, fp.veh) === ov)) pushPrev_(sh, r, ov, oldPhone);
        if (fp) {
          sh.getRange(r, O.PNAME).setValue(pilotLabel_(fp.name, fp.veh)); sh.getRange(r, O.PPHONE).setNumberFormat("@").setValue(fp.phone);
          if (ov !== nv) notifyRiderByPhone_(fp.phone, "\u200Fطلب اتعيّن لك \u200E#" + sh.getRange(r, O.BON).getValue() + "\u200E 🧾⚠️", "الإدارة عيّنتلك طلب، افتح التطبيق وشوف التفاصيل", "assign_" + sh.getRange(r, O.BON).getValue(), { type: "assigned", bon: sh.getRange(r, O.BON).getValue() });
        }
        else sh.getRange(r, O.PPHONE).setNumberFormat("@").setValue("");
      }
      if (c === O.CLOC || c === O.SLOC || c === O.RATE) sh.getRange(r, O_SIG).clearContent();   // اللوكيشن/الصيدلية/التسعيرة اتغيروا: التوصيل يتحسب تاني لوحده
      if (c === O.ACCEPT || c === O.PREP || c === O.DELIV) {
        styleOrderRow_(sh, r);
        if (isTrue_(rg.getValue())) stageNotify_(sh, r, c === O.ACCEPT ? "accepted" : (c === O.PREP ? "prep" : "deliv"));   // تعليم يدوي من الشيت برضه بيوصّل للعميل
      }
    } else if (OFFER_TABS.indexOf(nm) >= 0) {
      priceEdit_(sh, r, c);
      offerEdit_(e, sh, r, c);
    } else if (nm === PIL_TAB) {
      if (c === P.REQ && String(rg.getValue()).trim() === "مقبول" && !sh.getRange(r, P.REQ_AT).getValue()) {
        sh.getRange(r, P.REQ_AT).setValue(Utilities.formatDate(new Date(), TZ, "dd/MM/yyyy hh:mm a"));
      }
      if (c === P.REQ || c === P.STATE) stylePilotRow_(sh, r);
    }
  } catch (err) {}
}

// ===== أسعار العلبة والشريط: الفاصلة العشرية تبقى نقطة بالشكل 00.00 (بتتحوّل لوحدها لما تكتب/تعدّل في الخلية، ودالة fixPriceDots بتصلّح اللي موجود) =====
function priceText_(v) {
  if (v === "" || v == null) return null;
  if (typeof v === "number") return isFinite(v) ? v.toFixed(2) : null;
  var s = String(v).replace(/[٠-٩]/g, function (x) { return "٠١٢٣٤٥٦٧٨٩".indexOf(x); }).replace(/[۰-۹]/g, function (x) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(x); }).replace(/٫/g, ".").replace(/٬/g, ",").replace(/\s+/g, "").replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  var d = s.lastIndexOf("."), c = s.lastIndexOf(",");
  if (d > -1 && c > -1) { var dec = d > c ? "." : ","; s = s.split(dec === "." ? "," : ".").join("").replace(dec, "."); }
  else if (c > -1) { var p = s.split(","); s = (p.length === 2 && p[1].length <= 2) ? p[0] + "." + p[1] : p.join(""); }
  else if (d > -1) { var q = s.split("."); if (q.length > 2) s = q.slice(0, -1).join("") + "." + q[q.length - 1]; }
  var n = parseFloat(s); return isFinite(n) ? n.toFixed(2) : null;
}
function isPriceHeader_(h) { var n = arNorm_(h); return /سعر/.test(n) && !/عرض|اوفر|offer|لينك|رابط|صور/.test(n); }
function priceHeaderRow_(sh) {
  var lc = sh.getLastColumn(), ln = Math.min(6, sh.getLastRow());
  for (var r = 1; r <= ln; r++) { var v = sh.getRange(r, 1, 1, lc).getDisplayValues()[0]; if (v.filter(function (x) { return offKey_(x); }).length >= 2) return { hr: r, hdr: v }; }
  return null;
}
function fixPriceDots() {
  var ss = ssOpen_();
  OFFER_TABS.forEach(function (tab) {
    var sh = ss.getSheetByName(tab); if (!sh) { Logger.log("⚠️ مفيش ورقة اسمها " + tab); return; }
    var f = priceHeaderRow_(sh); if (!f) { Logger.log("⚠️ " + tab + ": ملقيتش صف العناوين"); return; }
    var n = sh.getLastRow() - f.hr; if (n < 1) return;
    f.hdr.forEach(function (h, i) {
      if (!isPriceHeader_(h)) return;
      var rg = sh.getRange(f.hr + 1, i + 1, n, 1), vals = rg.getValues(), out = [], ch = 0;
      for (var k = 0; k < n; k++) { var t = priceText_(vals[k][0]); if (t == null) out.push([vals[k][0]]); else { out.push([t]); if (String(vals[k][0]) !== t) ch++; } }
      rg.setNumberFormat("@").setValues(out);
      Logger.log("✅ " + tab + " / " + h + ": اتصلّح " + ch + " سعر");
    });
  });
}
function priceEdit_(sh, r, c) {
  try {
    var f = priceHeaderRow_(sh); if (!f || r <= f.hr || !isPriceHeader_(f.hdr[c - 1])) return;
    var cell = sh.getRange(r, c), t = priceText_(cell.getValue());
    if (t != null && String(cell.getDisplayValue()) !== t) cell.setNumberFormat("@").setValue(t);
  } catch (e) {}
}

// بصمة العرض + تسجيله في ورقة "العروض المُرسلة" (علشان فحص الـ 5 دقايق ماكررش نفس الإشعار)
function offSig_(p) { return [p.disc, p.bx, p.bxn, p.min, p.inc, p.op, p.text].join("~"); }
function noffUpsert_(key, sig) {
  var sh = noffSheet_(ssOpen_()), n = sh.getLastRow(), v = n >= 2 ? sh.getRange(2, 1, n - 1, 1).getDisplayValues() : [], at = 0;
  for (var i = 0; i < v.length; i++) if (String(v[i][0]) === key) { at = i + 2; break; }
  sh.getRange(at || (Math.max(n, 1) + 1), 1, 1, 2).setNumberFormat("@").setValues([[key, sig]]);
}
function noffRemove_(key) {
  try {
    var sh = noffSheet_(ssOpen_()), n = sh.getLastRow(); if (n < 2) return;
    var v = sh.getRange(2, 1, n - 1, 1).getDisplayValues();
    for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === key) sh.deleteRow(i + 2);
  } catch (e) {}
}
// بيبعت العرض ده لكل العملاء دلوقتي (حتى لو اتبعت قبل كده)
function sendOfferNow_(key) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  var p = null;
  try {
    var offers = readOffers_();
    for (var i = 0; i < offers.length; i++) if (offKeyOf_(offers[i]) === key) { p = offers[i]; break; }
    if (p) noffUpsert_(key, offSig_(p));
  } finally { try { lock.releaseLock(); } catch (x) {} }
  if (!p) { nlog_("كل العملاء", "offer_" + key, "عرض", "⚠️ اتحوّل لتشغيل بس مفيش عليه عرض (خصم / سعر عرض / قطعة إضافية / نص عرض) فمفيش إشعار"); return; }
  sendToAllCustomers_(OFFER_TITLE_, offerBody_(p), "offer_" + key, { type: "offer", id: p.id || "" }, p.imgs);
  rotMark_([key]);
}
// تعديل في ورقة منتجات: عمود "حالة العرض" اتغيّر لـ "تشغيل" => الصف يطلع لأول الشيت (اختياري) والعرض يتبعت لكل العملاء فورًا بتفاصيله، وفي كل مرة تحوّله من إيقاف لتشغيل بيتبعت تاني. تحويله لإيقاف بيشيله من الدوران
function offerEdit_(e, sh, r, c) {
  var lc = sh.getLastColumn(), hr = 0;
  for (var i = 1; i <= Math.min(6, sh.getLastRow()); i++) { if (offKey_(sh.getRange(i, c).getDisplayValue()) === "ostate") { hr = i; break; } }
  if (!hr || r <= hr) return;
  var keys = sh.getRange(hr, 1, 1, lc).getDisplayValues()[0].map(offKey_), rv = sh.getRange(r, 1, 1, lc).getDisplayValues()[0];
  var id = keys.indexOf("id") >= 0 ? String(rv[keys.indexOf("id")] || "").trim() : "", nm = keys.indexOf("name") >= 0 ? String(rv[keys.indexOf("name")] || "").trim() : "";
  var key = id || ("n:" + arNorm_(nm)); if (key === "n:") return;
  var wasOn = offerIsOn_(e && e.oldValue != null ? e.oldValue : ""), isOn = offerIsOn_(sh.getRange(r, c).getValue());
  if (wasOn && !isOn) { noffRemove_(key); return; }
  if (!isOn || wasOn) return;                                              // مش تحويل من إيقاف لتشغيل
  if (OFFER_MOVE_TO_TOP && r > hr + 1) { try { sh.moveRows(sh.getRange(r, 1, 1, 1), hr + 1); } catch (x) {} }
  SpreadsheetApp.flush();
  sendOfferNow_(key);                                                      // إشعار فوري لكل العملاء
}

// شغّلها مرة واحدة من المحرر: بتضيف عمود "حالة العرض" بعد "لينك العرض" في ورقتي الأدوية والعناية، وتخلّي كل المنتجات "ايقاف" (مع قائمة اختيار تشغيل/ايقاف)
function addOfferStateColumn() {
  var ss = ssOpen_();
  OFFER_TABS.forEach(function (tab) {
    var sh = ss.getSheetByName(tab); if (!sh) { Logger.log("⚠️ مفيش ورقة اسمها " + tab); return; }
    var lc = sh.getLastColumn(), hr = 0, hdr = [];
    for (var r = 1; r <= Math.min(6, sh.getLastRow()); r++) { var v = sh.getRange(r, 1, 1, lc).getDisplayValues()[0]; if (v.filter(function (x) { return offKey_(x); }).length >= 2) { hr = r; hdr = v; break; } }
    if (!hr) { Logger.log("⚠️ " + tab + ": ملقيتش صف العناوين"); return; }
    var keys = hdr.map(offKey_), col = keys.indexOf("ostate") + 1, created = false;
    if (!col) {
      var at = keys.indexOf("offerimg");
      if (at < 0) { Logger.log("⚠️ " + tab + ": ملقيتش عمود لينك العرض"); return; }
      sh.insertColumnAfter(at + 1); col = at + 2; created = true;
      sh.getRange(hr, col).setValue(OFFER_STATE_HEADER);
      try { sh.getRange(hr, at + 1).copyTo(sh.getRange(hr, col), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false); } catch (e) {}
    }
    var last = Math.max(sh.getMaxRows(), hr + 1), n = last - hr;
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(["تشغيل", "ايقاف"], true).setAllowInvalid(true).build();
    sh.getRange(hr + 1, col, n, 1).setDataValidation(rule).setHorizontalAlignment("center");
    var names = sh.getRange(hr + 1, keys.indexOf("name") + 1, n, 1).getDisplayValues(), cur = sh.getRange(hr + 1, col, n, 1).getDisplayValues(), out = [];
    for (var i = 0; i < n; i++) out.push([String(names[i][0]).trim() ? (created || !String(cur[i][0]).trim() ? "ايقاف" : cur[i][0]) : cur[i][0]]);
    sh.getRange(hr + 1, col, n, 1).setNumberFormat("@").setValues(out);
    Logger.log((created ? "✅ اتضاف" : "✔ موجود") + " عمود " + OFFER_STATE_HEADER + " في " + tab + " (العمود " + col + ") وكل المنتجات ايقاف لحد ما تغيّرها لتشغيل");
  });
}

// =====================================================================
// ===== نظام الطيارين (تطبيق Ouf-Farmacy-Rider) =====================
// =====================================================================

var MSG_ = {
  bad_input: "البيانات ناقصة أو غلط",
  no_sheet: "ورقة الطيارين مش موجودة، شغّل setupSheets",
  not_found: "الرقم ده مش مسجل عندنا، سجّل كطيار جديد الأول",
  wrong_password: "كلمة المرور غلط",
  too_many: "محاولات كتير غلط، جرّب كمان 10 دقايق",
  pending_approval: "حسابك قيد المراجعة من الإدارة",
  rejected: "تم رفض طلب انضمامك",
  suspended_temp: "أنت موقوف مؤقتاً، كلّم الإدارة",
  suspended_permanent: "تم إيقاف حسابك نهائياً"
};

// =====================================================================
// ===== لوكيشن العميل ================================================
// =====================================================================
var CUST_TAB_ = "العملاء", C_PHONE_ = 3, C_LOC_ = 5;   // ورقة العملاء: عمود 3 رقم الهاتف، عمود 5 لوكيشن العميل
var UA_ = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
var PRICE_BUDGET_ = 2;   // أقصى عدد طلبات بنعيد تسعيرها في الطلب الواحد (علشان الرد يفضل سريع)
function inEgypt_(la, lo) { return isFinite(la) && isFinite(lo) && la >= 21 && la <= 33 && lo >= 24 && lo <= 37.5; }
function hash_(t) { var h = 5381; t = String(t); for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + "_" + t.length; }
// بيفهم كل صيغ لينكات جوجل مابس: !3d..!4d.. (دبوس المكان) ← q= / ll= / destination= ← /place/lat,lng ← @lat,lng (مركز الشاشة) ← geo: ← "lat,lng" لوحدها
function parseCoords_(t) {
  t = String(t || "");
  var vs = [t]; try { var d = decodeURIComponent(t); if (d !== t) vs.push(d); } catch (e) {}
  var pats = [
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|query|destination|daddr|saddr|sll|center)=(?:loc:|geo:)?\s*(-?\d{1,3}\.\d+)\s*[,،]\s*(-?\d{1,3}\.\d+)/,
    /geo:(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /\/(?:place|search|dir)\/(?:[^\/@?]*\/)?(-?\d{1,3}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/,
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,3}\.\d{3,})\s*[,،;\s]\s*(-?\d{1,3}\.\d{3,})\s*$/
  ];
  for (var v = 0; v < vs.length; v++) for (var i = 0; i < pats.length; i++) {
    var m = vs[v].match(pats[i]);
    if (m && inEgypt_(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] };
  }
  return null;
}
function bodyCoords_(b) {          // إحداثيات من صفحة جوجل نفسها (لو اللينك مرجعش تحويل)
  var m = String(b).match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/) || String(b).match(/"latitude"\s*:\s*(-?\d{1,3}\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d{1,3}\.\d+)/) ||
    String(b).match(/itemprop="latitude"\s+content="(-?\d{1,3}\.\d+)"[^>]*itemprop="longitude"\s+content="(-?\d{1,3}\.\d+)"/) || String(b).match(/center=(-?\d{1,3}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/);
  return m && inEgypt_(+m[1], +m[2]) ? { lat: +m[1], lng: +m[2] } : null;
}
function normLoc_(raw) {
  var s = txt_(raw, 700), u = s.match(/https?:\/\/[^\s]+/i);
  if (u) return u[0].replace(/[)\].,،;]+$/, "");
  var c = parseCoords_(s);
  return c ? "https://www.google.com/maps?q=" + c.lat + "," + c.lng : s;
}
// لينك مختصر (maps.app.goo.gl / goo.gl/maps) ← بنمشي ورا التحويلات لحد ما نلاقي الإحداثيات
function resolveMapsLink_(url) {
  var cache = CacheService.getScriptCache(), key = "loc_" + hash_(url), c = cache.get(key);
  if (c) { var p = c.split(","); return { lat: +p[0], lng: +p[1] }; }
  var cur = url, res = null;
  for (var i = 0; i < 6 && cur; i++) {
    var pc = parseCoords_(cur); if (pc) { res = pc; break; }
    var r = UrlFetchApp.fetch(cur, { followRedirects: false, muteHttpExceptions: true, headers: { "User-Agent": UA_, "Accept-Language": "ar,en;q=0.8" } });
    var code = r.getResponseCode(), h = r.getHeaders() || {}, loc = h["Location"] || h["location"];
    if (code >= 300 && code < 400 && loc) { cur = /^https?:/i.test(loc) ? loc : (/^\//.test(loc) ? "https://www.google.com" + loc : loc); continue; }
    var body = String(r.getContentText() || "").slice(0, 400000), bc = bodyCoords_(body);
    if (bc) { res = bc; break; }
    var mm = body.match(/https?:\/\/(?:www\.)?google\.[a-z.]+\/maps[^"'<>\s\\]*/i), nx = mm ? mm[0].replace(/&amp;/g, "&") : "";
    if (nx && nx !== cur) { cur = nx; continue; }
    break;
  }
  if (res) cache.put(key, res.lat + "," + res.lng, 21600);
  return res;
}
function coordsOfLink_(link) {
  link = String(link || "").trim(); if (!link) return null;
  var c = parseCoords_(link); if (c) return c;
  if (/^https?:/i.test(link)) { try { return resolveMapsLink_(link); } catch (e) {} }
  return null;
}
function storeCoords_(sloc) {
  sloc = String(sloc || "").trim();
  if (!sloc || sloc === STORE_LOCATION) return STORE_COORDS;
  return coordsOfLink_(sloc) || (sloc === STORE_LOCATION ? STORE_COORDS : null);
}
// مسافة الطريق بالمتر (عربية/موتوسيكل على الطرق مش خط مستقيم). longest=true: لو في أكتر من طريق ناخد الأطول زي ما طلبت
function routeMeters_(a, b, longest) {
  var cache = CacheService.getScriptCache(), key = "rt_" + [a.lat.toFixed(5), a.lng.toFixed(5), b.lat.toFixed(5), b.lng.toFixed(5), longest ? 1 : 0].join("_"), c = cache.get(key);
  if (c) return Number(c);
  var best = -1, pick = function (m) { if (best < 0 || (longest ? m > best : m < best)) best = m; };
  try {
    var f = Maps.newDirectionFinder().setOrigin(a.lat, a.lng).setDestination(b.lat, b.lng).setMode(Maps.DirectionFinder.Mode.DRIVING).setRegion("eg").setLanguage("ar");
    if (longest) f.setAlternatives(true);
    var res = f.getDirections();
    if (res && res.status === "OK" && res.routes && res.routes.length) {
      var rs = longest ? res.routes : [res.routes[0]];
      rs.forEach(function (rt) { var m = 0; (rt.legs || []).forEach(function (l) { m += (l.distance && l.distance.value) || 0; }); pick(m); });
    }
  } catch (e) {}
  if (best < 0) {                                        // احتياطي: OSRM (طرق حقيقية برضه) لو خدمة الخرائط مش متاحة
    try {
      var rr = UrlFetchApp.fetch("https://router.project-osrm.org/route/v1/driving/" + a.lng + "," + a.lat + ";" + b.lng + "," + b.lat + "?overview=false&alternatives=" + (longest ? "true" : "false") + "&steps=false", { muteHttpExceptions: true });
      if (rr.getResponseCode() === 200) { var j = JSON.parse(rr.getContentText()); if (j && j.routes && j.routes.length) (longest ? j.routes : [j.routes[0]]).forEach(function (rt) { pick(Number(rt.distance) || 0); }); }
    } catch (e2) {}
  }
  if (best >= 0) cache.put(key, String(best), longest ? 1800 : 15);
  return best;
}
function fmtNum_(n) { n = Math.round((Number(n) || 0) * 100) / 100; return String(n); }
function totalText_(goods, fee) { return "ح " + fmtNum_(goods) + " + ت " + fmtNum_(fee) + " = ا " + fmtNum_((Number(goods) || 0) + (Number(fee) || 0)); }
function goodsOf_(rv) {
  var g = rv[O_GOODS - 1];
  if (g !== "" && g != null && isFinite(Number(g)) && Number(g) >= 0) return Number(g);
  var t = rv[O.TOTAL - 1]; if (typeof t === "number") return t;
  var m = String(t || "").match(/ح\s*([\d.]+)/); return m ? Number(m[1]) : (Number(t) || 0);
}
function feeOf_(rv) { var f = Number(rv[O_FEE - 1]); return isFinite(f) && f >= 0 ? f : 0; }
function rateOf_(rv) { var r = Number(rv[O.RATE - 1]); return rv[O.RATE - 1] === "" || !isFinite(r) || r < 0 ? KM_RATE : r; }
function sigOf_(rv) { return String(rv[O.CLOC - 1] || "").trim() + "|" + String(rv[O.SLOC - 1] || "").trim() + "|" + rateOf_(rv); }
function needsPrice_(rv) { return String(rv[O_SIG - 1]) !== sigOf_(rv); }
function bareName_(v) { var t = String(v == null ? "" : v).trim(), i = t.lastIndexOf(" - "); return i > 0 ? t.slice(0, i).trim() : t; }
// بيحسب التوصيل = مسافة الطريق (كم) × تسعيرة الكيلو، ويكتبهم في الشيت. بيتنفذ لوحده لما اللوكيشن أو الصيدلية أو التسعيرة تتغير
function priceOrder_(sh, r) {
  var rv = sh.getRange(r, 1, 1, O_ARR).getValues()[0], bon = Number(rv[O.BON - 1]) || 0;
  if (!needsPrice_(rv)) return false;
  var cache = CacheService.getScriptCache(); if (cache.get("pf_" + bon)) return false;
  var cloc = String(rv[O.CLOC - 1] || "").trim(), rate = rateOf_(rv), goods = goodsOf_(rv), km = 0, fee = 0, ok = true;
  if (cloc) {
    var a = storeCoords_(rv[O.SLOC - 1]), b = coordsOfLink_(cloc);
    if (a && b) { var m = routeMeters_(a, b, true); if (m >= 0) { km = Math.round(m) / 1000; fee = Math.round(km * rate); } else ok = false; } else ok = false;
  }
  if (!ok) { cache.put("pf_" + bon, "1", 40); return false; }      // فشل: نستنى شوية ونجرب تاني (من غير ما نبطّأ الباقي)
  sh.getRange(r, O_KM, 1, 3).setValues([[km, fee, goods]]);
  sh.getRange(r, O_SIG).setValue(sigOf_(rv));
  sh.getRange(r, O.TOTAL).setValue(totalText_(goods, fee));
  return true;
}
// بيرجّع بيانات الصف بعد التسعيرة (لو محتاج)، من غير ما نتأخر: بحد أقصى طلبين في المرة وبقفل سريع
function pricedRow_(sh, rowIdx, rv) {
  if (PRICE_BUDGET_ <= 0 || !(Number(rv[O.BON - 1]) > 0) || isTrue_(rv[O.DONE - 1]) || !needsPrice_(rv)) return rv;
  var lk = LockService.getScriptLock(), had = lk.hasLock(), got = had;
  if (!had) { try { got = lk.tryLock(1500); } catch (e) { got = false; } }
  if (!got) return rv;
  try {
    PRICE_BUDGET_--;
    var ri = findByCid_(sh, String(rv[O_CID - 1])) || rowIdx;
    if (priceOrder_(sh, ri)) return sh.getRange(ri, 1, 1, O_ARR).getValues()[0];
  } catch (e) {} finally { if (!had) { try { lk.releaseLock(); } catch (x) {} } }
  return rv;
}
function updateCustomerLoc_(ss, phone, link) {
  var sh = ss.getSheetByName(CUST_TAB_); if (!sh) return;
  var n = sh.getLastRow(); if (n < 2) return;
  var v = sh.getRange(2, C_PHONE_, n - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) if (normPhone_(v[i][0]) === phone) { sh.getRange(i + 2, C_LOC_).setValue(link); return; }
}
function afterLocation_(ss, sh, r, phone, loc) {
  var link = loc, c = coordsOfLink_(loc);
  if (c) { link = "https://www.google.com/maps?q=" + c.lat + "," + c.lng; sh.getRange(r, O.CLOC).setValue(link); }   // لينك بإحداثيات دقيقة (التطبيق بيحسب منه المسافة والوصول)
  updateCustomerLoc_(ss, phone, link);
}

// ---- الطيارين: قراءة وبحث (آخر صف حقيقي بنعدّه على عمود التليفون لأن القوائم المنسدلة جنب الجدول بتبوّظ getLastRow) ----
function pilotLast_(sh) {
  var n = sh.getMaxRows();
  if (n < 2) return 1;
  var v = sh.getRange(2, P.PHONE, n - 1, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]).trim() !== "") return i + 2;
  return 1;
}
function readPilots_(sh) {
  var last = pilotLast_(sh);
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, PIL_HEADERS.length).getValues();
}
function findPilot_(sh, phone) {
  var rows = readPilots_(sh);
  for (var i = 0; i < rows.length; i++) if (normPhone_(rows[i][P.PHONE - 1]) === phone) return { row: i + 2, v: rows[i] };
  return null;
}
function isWorking_(v) { return String(v[P.SHIFT - 1]).trim() === "يعمل الان"; }

// ---- التحقق من الطيار (تليفون + باسورد) في كل طلب، من غير ما نثق في أي حاجة جاية من الجهاز ----
function authPilot_(d) {
  var phone = normPhone_(d.phone), pass = String(d.password == null ? "" : d.password).trim();
  if (!/^01[0125]\d{8}$/.test(phone) || !pass) return { code: "bad_input" };
  var cache = CacheService.getScriptCache(), fk = "pf_" + phone;
  if (Number(cache.get(fk) || 0) >= LOGIN_MAX_FAILS) return { code: "too_many" };
  var sh = ssOpen_().getSheetByName(PIL_TAB);
  if (!sh) return { code: "no_sheet" };
  var p = findPilot_(sh, phone);
  if (!p) return { code: "not_found" };
  if (String(p.v[P.PASS - 1]).trim() !== pass) { cache.put(fk, String(Number(cache.get(fk) || 0) + 1), 600); return { code: "wrong_password" }; }
  cache.remove(fk);
  var req = String(p.v[P.REQ - 1]).trim(), st = String(p.v[P.STATE - 1]).trim();
  var a = { code: "ok", authed: true, sh: sh, row: p.row, phone: phone, v: p.v };
  if (st === "موقوف نهائي" || st === "موقوف دائم") a.code = "suspended_permanent";
  else if (st === "موقوف مؤقتاً" || st === "موقوف مؤقتا") a.code = "suspended_temp";
  else if (req === "مرفوض") a.code = "rejected";
  else if (req !== "مقبول") a.code = "pending_approval";
  return a;
}
function authFail_(a) { return { ok: false, status: a.code, message: MSG_[a.code] || "خطأ" }; }
function pilotInfo_(a) {
  var v = a.v, bd = v[P.BIRTH - 1];
  if (bd instanceof Date) bd = Utilities.formatDate(bd, TZ, "dd/MM/yyyy");
  return { name: String(v[P.NAME - 1]), phone: a.phone, vehicle: String(v[P.VEH - 1] || ""), wallet: Number(v[P.WALLET - 1]) || 0, working: isWorking_(v),
    address: String(v[P.ADDR - 1] || ""), idCard: String(v[P.ID - 1] || ""), birthDate: String(bd || ""), age: String(v[P.AGE - 1] || "") };
}

// ---- توكن الإشعارات (توكن واحد لكل جهاز: لو الجهاز اتسجل بحساب طيار تاني بنشيله من القديم) ----
function saveToken_(sh, row, token) {
  token = String(token || "").trim();
  if (!/^[A-Za-z0-9_:\-\.]{20,600}$/.test(token)) return false;
  var last = pilotLast_(sh);
  if (last >= 2) {
    var t = sh.getRange(2, P.TOKEN, last - 1, 1).getValues();
    for (var i = 0; i < t.length; i++) if (String(t[i][0]) === token && i + 2 !== row) sh.getRange(i + 2, P.TOKEN).setValue("");
  }
  sh.getRange(row, P.TOKEN).setNumberFormat("@").setValue(token);
  return true;
}

function stylePilotRow_(sh, r) {
  var rq = String(sh.getRange(r, P.REQ).getValue()).trim(), stt = String(sh.getRange(r, P.STATE).getValue()).trim();
  var bg = "#111827", fg = "#F3F4F6";
  if (stt === "موقوف نهائي") { bg = "#FF1744"; fg = "#000000"; }
  else if (rq === "منتظر") { bg = "#FFEB3B"; fg = "#000000"; }
  else if (rq === "مرفوض") { bg = "#7A1212"; fg = "#FFFFFF"; }
  else if (rq) { bg = "#FFFFFF"; fg = "#000000"; }
  sh.getRange(r, 1, 1, PIL_HEADERS.length).setBackground(bg).setFontColor(fg);
}

// ---- تسجيل الدخول ----
function pilotLogin_(d) {
  var a = authPilot_(d);
  if (a.authed && d.token) { try { saveToken_(a.sh, a.row, d.token); } catch (e) {} }
  if (a.code !== "ok") return authFail_(a);
  return { ok: true, status: "success", pilot: pilotInfo_(a) };
}

// ---- تسجيل طيار جديد (بيدخل "منتظر" وانت بتوافق من الشيت) ----
function pilotRegister_(d) {
  var name = txt_(d.name, 80).replace(/\s+/g, " "), phone = normPhone_(d.phone), pass = String(d.password == null ? "" : d.password).trim();
  var addr = txt_(d.address, 200), idc = String(d.idCard || "").replace(/[٠-٩]/g, function (x) { return "٠١٢٣٤٥٦٧٨٩".indexOf(x); }).replace(/\D/g, "");
  var veh = txt_(d.vehicle, 30), bd = String(d.birthDate || "").trim();
  if (name.split(" ").length < 3 || name.length < 8) return { ok: false, status: "invalid", message: "اكتب الاسم ثلاثي أو رباعي" };
  if (!/^01[0125]\d{8}$/.test(phone)) return { ok: false, status: "invalid", message: "رقم الموبايل لازم يكون مصري من 11 رقم" };
  if (pass.length < 6) return { ok: false, status: "invalid", message: "كلمة المرور 6 حروف أو أرقام على الأقل" };
  if (addr.length < 6) return { ok: false, status: "invalid", message: "اكتب العنوان بالتفصيل" };
  if (!/^\d{14}$/.test(idc)) return { ok: false, status: "invalid", message: "الرقم القومي 14 رقم" };
  var m = bd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ok: false, status: "invalid", message: "اختار تاريخ الميلاد" };
  var born = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), now = new Date();
  var age = now.getFullYear() - born.getFullYear() - ((now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) ? 1 : 0);
  if (isNaN(age) || age < 16 || age > 70) return { ok: false, status: "invalid", message: "السن لازم يكون من 16 لـ 70 سنة" };
  if (VEHICLES.indexOf(veh) < 0) veh = VEHICLES[0];
  var ss = ssOpen_(), sh = ss.getSheetByName(PIL_TAB) || (setupPilots_(ss), ss.getSheetByName(PIL_TAB));
  if (findPilot_(sh, phone)) return { ok: false, status: "exists", message: "الرقم ده مسجل قبل كده كطيار" };
  var last = pilotLast_(sh), r = last + 1;
  if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
  var vals = [];
  vals[P.NUM - 1] = Math.max(last, 1); vals[P.NAME - 1] = name; vals[P.PHONE - 1] = phone; vals[P.PASS - 1] = pass; vals[P.ADDR - 1] = addr;
  vals[P.ID - 1] = idc; vals[P.BIRTH - 1] = Utilities.formatDate(born, TZ, "dd/MM/yyyy"); vals[P.AGE - 1] = age; vals[P.VEH - 1] = veh;
  vals[P.REQ - 1] = "منتظر"; vals[P.REQ_AT - 1] = ""; vals[P.STATE - 1] = "يعمل"; vals[P.SHIFT - 1] = "لا يعمل"; vals[P.WALLET - 1] = 0; vals[P.TOKEN - 1] = "";
  [P.PHONE, P.PASS, P.ID, P.BIRTH, P.TOKEN].forEach(function (c) { sh.getRange(r, c).setNumberFormat("@"); });
  sh.getRange(r, 1, 1, vals.length).setValues([vals]);
  try { stylePilotRow_(sh, r); } catch (e) {}
  if (d.token) { try { saveToken_(sh, r, d.token); } catch (e) {} }
  return { ok: true, status: "success", message: "تم إرسال طلب الانضمام، استنى موافقة الإدارة" };
}

// ---- الطلبات: بحث وعرض ----
function rowByBon_(sh, bon) {
  var last = dataLast_(sh);
  if (last < 2 || !bon) return 0;
  var v = sh.getRange(2, O.BON, last - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) if (Number(v[i][0]) === Number(bon)) return i + 2;
  return 0;
}
function rowVals_(sh, r) { return sh.getRange(r, 1, 1, O_ARR).getValues()[0]; }
function isMine_(rv, phone) { return isTrue_(rv[O.ACCEPT - 1]) && normPhone_(rv[O.PPHONE - 1]) === phone; }
function activeCount_(sh, phone) {
  var last = dataLast_(sh), n = 0;
  if (last < 2) return 0;
  var v = sh.getRange(2, 1, last - 1, O_CID).getValues();
  for (var i = 0; i < v.length; i++) if (Number(v[i][O.BON - 1]) > 0 && isMine_(v[i], phone) && !isTrue_(v[i][O.DONE - 1])) n++;
  return n;
}
// تاريخ ووقت الطلب: الشيت بيحوّل وقت "08:38 ص" لقيمة وقت (1899...) فبنقراه من النص المعروض في الخلية (آمن من فروق التوقيت)
function orderTime_(dispD, dispT, rawD, rawT) {
  var y = 0, mo = 0, da = 0, h = -1, mi = 0, m;
  if ((m = String(dispD || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/))) { da = +m[1]; mo = +m[2]; y = +m[3]; }
  else if ((m = String(dispD || "").match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; da = +m[3]; }
  else if (rawD instanceof Date) { var p = Utilities.formatDate(rawD, TZ, "yyyy-MM-dd").split("-"); y = +p[0]; mo = +p[1]; da = +p[2]; }
  var ts = String(dispT || "");
  if ((m = ts.match(/(\d{1,2}):(\d{2})/))) {
    h = +m[1]; mi = +m[2];
    var pm = /م|PM/i.test(ts), am = /ص|AM/i.test(ts);
    if (pm && h < 12) h += 12; if (am && h === 12) h = 0;
  } else if (rawT instanceof Date) { var q = Utilities.formatDate(rawT, TZ, "HH:mm").split(":"); h = +q[0]; mi = +q[1]; }
  if (!y || h < 0) return { day: "", dateTxt: String(dispD || ""), timeTxt: String(dispT || ""), dt: "", ageMin: -1 };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var dt = y + "-" + pad(mo) + "-" + pad(da) + " " + pad(h) + ":" + pad(mi), age = -1;
  try { age = Math.max(0, Math.floor((Date.now() - Utilities.parseDate(dt, TZ, "yyyy-MM-dd HH:mm").getTime()) / 60000)); } catch (e) {}
  return { day: AR_DAYS[new Date(y, mo - 1, da).getDay()], dateTxt: pad(da) + "/" + pad(mo) + "/" + y, timeTxt: pad(h % 12 || 12) + ":" + pad(mi) + " " + (h < 12 ? "ص" : "م"), dt: dt, ageMin: age };
}
function orderView_(r, mine, dv) {
  var tm = orderTime_(dv ? dv[O.DATE - 1] : r[O.DATE - 1], dv ? dv[O.TIME - 1] : r[O.TIME - 1], r[O.DATE - 1], r[O.TIME - 1]);
  var o = { bon: Number(r[O.BON - 1]) || 0, day: tm.day, dateTxt: tm.dateTxt, timeTxt: tm.timeTxt, ageMin: tm.ageMin, area: String(r[O.AREA - 1]), items: String(r[O.DETAILS - 1]),
    total: goodsOf_(r), fee: feeOf_(r), km: Number(r[O_KM - 1]) || 0, note: String(r[O.NOTE - 1] || "") };
  if (mine) {
    o.name = String(r[O.NAME - 1]); o.phone = normPhone_(r[O.PHONE - 1]); o.street = String(r[O.STREET - 1] || ""); o.landmark = String(r[O.LANDMARK - 1] || "");
    o.cloc = String(r[O.CLOC - 1] || ""); o.sloc = String(r[O.SLOC - 1] || ""); o.shopEta = String(r[O.SHOP_ETA - 1] || ""); o.custEta = String(r[O.CUST_ETA - 1] || "");
    o.stage = isTrue_(r[O.DELIV - 1]) ? "delivering" : (isTrue_(r[O.PREP - 1]) ? "preparing" : "accepted"); o.arrived = !!r[O_ARR - 1];
  }
  return o;
}

// ---- القايمة اللي بتظهر في تطبيق الطيار (قراءة بس) ----
function riderOrders_(d) {
  var a = authPilot_(d);
  if (a.authed && d.token) { try { saveToken_(a.sh, a.row, d.token); } catch (e) {} }
  if (a.code !== "ok") return authFail_(a);
  var ss = ssOpen_(), sh = ordersSheet_(ss), last = dataLast_(sh), working = isWorking_(a.v), pool = [], mine = [], hist = [];
  if (last >= 2) {
    var rg = sh.getRange(2, 1, last - 1, O_ARR), v = rg.getValues(), dvs;
    for (var q = 0; q < v.length; q++) v[q] = pricedRow_(sh, q + 2, v[q]);       // التوصيل يتحدّث لوحده لو اتغير اللوكيشن/الصيدلية/التسعيرة
    dvs = rg.getDisplayValues();
    for (var i = 0; i < v.length; i++) {
      var r = v[i];
      if (!(Number(r[O.BON - 1]) > 0)) continue;
      if (!isTrue_(r[O.ACCEPT - 1])) { if (working) pool.push(orderView_(r, false, dvs[i])); }
      else if (isMine_(r, a.phone) && !isTrue_(r[O.DONE - 1])) mine.push(orderView_(r, true, dvs[i]));
    }
  }
  var arc = ss.getSheetByName(ARC_TAB);
  if (arc && arc.getLastRow() >= 2) {
    var from = Math.max(2, arc.getLastRow() - 400), rg2 = arc.getRange(from, 1, arc.getLastRow() - from + 1, A_AT), av = rg2.getValues(), adv = rg2.getDisplayValues(), myName = String(a.v[P.NAME - 1]).trim();
    for (var k = av.length - 1; k >= 0 && hist.length < 150; k--) {
      var q = av[k], pp = normPhone_(q[O.PPHONE - 1]);
      if (pp ? pp !== a.phone : bareName_(q[O.PNAME - 1]) !== myName) continue;
      var h = orderView_(q, true, adv[k]);
      h.name = String(q[O.NAME - 1]);
      h.doneAt = q[A_AT - 1] ? Utilities.formatDate(new Date(q[A_AT - 1]), TZ, "yyyy-MM-dd HH:mm") : "";
      hist.push(h);
    }
  }
  return { ok: true, status: "success", pilot: pilotInfo_(a), pool: pool, mine: mine, history: hist, store: STORE_LOCATION, serverTime: new Date().getTime() };
}

// ---- قبول طلب: الأسرع ياخده (بيتنفذ جوه القفل فمحدش يقدر يقبل نفس الطلب مرتين) ----
// إشعار العميل بمرحلة الطلب (تم القبول / جاري التجهيز / في الطريق / تم التوصيل).
// تعديلات السكربت على الشيت مبتشغّلش onEdit، فلازم نبعت الإشعار بإيدينا من خطوات الطيار. بنمنع التكرار 10 دقايق لنفس الطلب والمرحلة.
function notifyStageOnce_(bon, kind, phone, who) {
  try {
    var cache = CacheService.getScriptCache(), ck = "ntf_" + bon + "_" + kind + "_" + phone;
    if (cache.get(ck)) return;
    cache.put(ck, "1", 600);
    var ss = ssOpen_(), sh = ordersSheet_(ss), r = rowByBon_(sh, bon);
    if (!r) { var arc = ss.getSheetByName(ARC_TAB); if (arc) { sh = arc; r = rowByBon_(sh, bon); } }
    if (r) stageNotify_(sh, r, kind, who);
  } catch (e) {}
}

function riderAccept_(d) {
  var a = authPilot_(d); if (a.code !== "ok") return authFail_(a);
  if (!isWorking_(a.v)) return { ok: false, status: "not_working", message: "شغّل حالتك (يعمل) الأول" };
  var sh = ordersSheet_(ssOpen_()), r = rowByBon_(sh, d.bon);
  if (!r) return { ok: false, status: "gone", message: "الطلب مش موجود (اتلغى أو اتسلّم)" };
  var rv = rowVals_(sh, r);
  if (isTrue_(rv[O.ACCEPT - 1])) {
    if (normPhone_(rv[O.PPHONE - 1]) === a.phone) return { ok: true, already: true, order: orderView_(rv, true, sh.getRange(r, 1, 1, O_CID).getDisplayValues()[0]) };
    return { ok: false, status: "taken", message: "طيار تاني سبقك وقبل الطلب ده" };
  }
  if (activeCount_(sh, a.phone) >= MAX_ACTIVE) return { ok: false, status: "limit", message: "معاك " + MAX_ACTIVE + " طلبات شغالة، خلّصهم الأول" };
  sh.getRange(r, O.ACCEPT).setValue(true);
  sh.getRange(r, O.PNAME).setValue(pilotLabel_(String(a.v[P.NAME - 1]), String(a.v[P.VEH - 1] || "")));
  sh.getRange(r, O.PPHONE).setNumberFormat("@").setValue(a.phone);
  try { styleOrderRow_(sh, r); } catch (e) {}
  var nv = rowVals_(sh, r), bonA = Number(d.bon), phA = a.phone, whoA = String(a.v[P.NAME - 1]);
  later_(function () { notifyStageOnce_(bonA, "accepted", phA, whoA); });          // إشعار "تم قبول طلبك" للعميل
  return { ok: true, bon: Number(d.bon), order: orderView_(nv, true, sh.getRange(r, 1, 1, O_CID).getDisplayValues()[0]) };
}

// ---- مراحل الطلب: الطيار هو اللي بيحركها (تجهيز ← توصيل ← تم التوصيل) ----
function riderStage_(d) {
  var a = authPilot_(d); if (a.code !== "ok") return authFail_(a);
  var stage = String(d.stage || ""), sh = ordersSheet_(ssOpen_()), r = rowByBon_(sh, d.bon);
  if (["prepare", "deliver", "complete"].indexOf(stage) < 0) return { ok: false, status: "invalid", message: "مرحلة غير معروفة" };
  if (!r) return { ok: false, status: "gone", message: "الطلب مش موجود (يمكن اتسلّم أو اتلغى)" };
  var rv = rowVals_(sh, r);
  if (!isMine_(rv, a.phone)) return { ok: false, status: "not_yours", message: "الطلب ده مش بتاعك" };
  if (isTrue_(rv[O.DONE - 1])) return { ok: true, already: true };
  var kind = "", kinds = [], bonS = Number(d.bon), phS = a.phone, whoS = String(a.v[P.NAME - 1]);
  if (stage === "prepare") { if (!isTrue_(rv[O.PREP - 1])) { sh.getRange(r, O.PREP).setValue(true); kind = "prep"; kinds.push("prep"); } }
  else if (stage === "deliver") { if (!isTrue_(rv[O.PREP - 1])) { sh.getRange(r, O.PREP).setValue(true); kinds.push("prep"); } if (!isTrue_(rv[O.DELIV - 1])) { sh.getRange(r, O.DELIV).setValue(true); kind = "deliv"; kinds.push("deliv"); } }
  else {
    if (!isTrue_(rv[O.PREP - 1])) { sh.getRange(r, O.PREP).setValue(true); notifyStageOnce_(bonS, "prep", phS, whoS); }
    if (!isTrue_(rv[O.DELIV - 1])) { sh.getRange(r, O.DELIV).setValue(true); notifyStageOnce_(bonS, "deliv", phS, whoS); }
    sh.getRange(r, O.DONE).setValue(true);
    notifyStageOnce_(bonS, "done", phS, whoS);                       // "تم التوصيل" لازم يتبعت قبل ما الطلب يتنقل للأرشيف
    archiveOrder_(sh, r, d.at);                 // بيتنقل لـ "الطلبات المكتملة" (التعديل من السكربت مبيشغّلش onEdit، فبنؤرشف هنا بإيدينا)
    return { ok: true, stage: "complete" };
  }
  try { styleOrderRow_(sh, r); } catch (e) {}
  if (kinds.length) later_(function () { kinds.forEach(function (k) { notifyStageOnce_(bonS, k, phS, whoS); }); });   // إشعار العميل بالمرحلة
  return { ok: true, stage: stage };
}

// ---- الطيار يتنازل عن طلب لسه ما بدأش فيه (بيرجع للقايمة وبيتبعت إشعار للباقي) ----
function riderRelease_(d) {
  var a = authPilot_(d); if (a.code !== "ok") return authFail_(a);
  var sh = ordersSheet_(ssOpen_()), r = rowByBon_(sh, d.bon);
  if (!r) return { ok: false, status: "gone", message: "الطلب مش موجود" };
  var rv = rowVals_(sh, r);
  if (!isMine_(rv, a.phone)) return { ok: false, status: "not_yours", message: "الطلب ده مش بتاعك" };
  if (isTrue_(rv[O.PREP - 1]) || isTrue_(rv[O.DELIV - 1])) return { ok: false, status: "started", message: "مينفعش تتنازل بعد ما بدأت التجهيز" };
  stageNotify_(sh, r, "released");
  pushPrev_(sh, r, rv[O.PNAME - 1], normPhone_(rv[O.PPHONE - 1]));      // الطيار اللي اتنازل يتسجل "سابق"
  sh.getRange(r, O.ACCEPT).setValue(false);
  sh.getRange(r, O.PNAME).setValue("");
  sh.getRange(r, O.PPHONE).setValue("");
  sh.getRange(r, O.SHOP_ETA).setValue("");
  sh.getRange(r, O.CUST_ETA).setValue("");
  try { styleOrderRow_(sh, r); } catch (e) {}
  try { sh.getRange(r, O.NOTIF).setValue(broadcastToRiders_("\u200Fطلب رجع للقايمة \u200E#" + d.bon + "\u200E 🧾⚠️", "طيار اتنازل عن الطلب، اقبله لو فاضي", "new_order_" + d.bon, { type: "new_order", bon: d.bon }, a.phone)); } catch (e) {}
  return { ok: true };
}

// ---- الوصول المتوقع (بيظهر للعميل في مشترياتي) ----
function riderEta_(d) {
  var a = authPilot_(d); if (a.code !== "ok") return authFail_(a);
  var sh = ordersSheet_(ssOpen_()), r = rowByBon_(sh, d.bon);
  if (!r) return { ok: false, status: "gone" };
  if (!isMine_(rowVals_(sh, r), a.phone)) return { ok: false, status: "not_yours" };
  var t = txt_(d.etaText, 40);
  sh.getRange(r, d.stage === "cust" ? O.CUST_ETA : O.SHOP_ETA).setValue(t);
  return { ok: true };
}

// ---- يعمل / لا يعمل ----
function riderShift_(d) {
  var a = authPilot_(d); if (a.code !== "ok") return authFail_(a);
  var want = (d.working === true || d.working === "true");
  if (!want && activeCount_(ordersSheet_(ssOpen_()), a.phone) > 0) return { ok: false, status: "busy", message: "معاك طلب شغال، خلّصه الأول وبعدين وقّف الشغل" };
  a.sh.getRange(a.row, P.SHIFT).setValue(want ? "يعمل الان" : "لا يعمل");
  return { ok: true, working: want };
}

// المندوب قرّب من العميل؟ بنحسب مسافة الطريق (مش خط مستقيم) من مكانه لموقع العميل. لو ≤ 25 متر نسجّل "وصل" والعميل يشوفها
function riderNear_(d) {
  var a = authPilot_(d); if (a.code !== "ok") return authFail_(a);
  var sh = ordersSheet_(ssOpen_()), r = rowByBon_(sh, d.bon);
  if (!r) return { ok: false, status: "gone" };
  var rv = rowVals_(sh, r);
  if (!isMine_(rv, a.phone)) return { ok: false, status: "not_yours" };
  var lat = Number(d.lat), lng = Number(d.lng);
  if (!inEgypt_(lat, lng)) return { ok: false, status: "invalid" };
  var cache = CacheService.getScriptCache(); if (cache.get("near_" + d.bon)) return { ok: true, throttled: true, arrived: !!rv[O_ARR - 1] };
  cache.put("near_" + d.bon, "1", 8);
  var cust = coordsOfLink_(rv[O.CLOC - 1]); if (!cust) return { ok: true, status: "noloc" };
  var m = routeMeters_({ lat: lat, lng: lng }, cust, false); if (m < 0) return { ok: true, status: "noroute" };
  var was = !!rv[O_ARR - 1];
  if (m <= ARRIVE_M) { if (!was) { sh.getRange(r, O_ARR).setValue(Utilities.formatDate(new Date(), TZ, "hh:mm:ss a")); stageNotify_(sh, r, "arrived"); } return { ok: true, arrived: true, m: Math.round(m) }; }
  if (was && m > ARRIVE_M * 2.5) sh.getRange(r, O_ARR).clearContent();
  return { ok: true, arrived: false, m: Math.round(m) };
}


// الإشعار للعميل بيتبعت من طلب منفصل (من التطبيق بعد نجاح الخطوة) علشان قبول الطلب والمراحل متستناش FCM
function riderNotify_(d) {
  var a = authPilot_(d); if (a.code !== "ok") return authFail_(a);
  var kind = String(d.kind || ""), need = { accepted: O.ACCEPT, prep: O.PREP, deliv: O.DELIV, done: O.DONE }[kind];
  if (!need || !(Number(d.bon) > 0)) return { ok: false, status: "invalid" };
  var cache = CacheService.getScriptCache(), ck = "ntf_" + d.bon + "_" + kind + "_" + a.phone;
  if (cache.get(ck)) return { ok: true, dup: true };
  var ss = ssOpen_(), sh = ordersSheet_(ss), r = rowByBon_(sh, d.bon);
  if (!r) { var arc = ss.getSheetByName(ARC_TAB); if (arc) { sh = arc; r = rowByBon_(sh, d.bon); } }
  if (!r) return { ok: false, status: "gone" };
  if (normPhone_(sh.getRange(r, O.PPHONE).getDisplayValue()) !== a.phone) return { ok: false, status: "not_yours" };
  if (!isTrue_(sh.getRange(r, need).getValue())) return { ok: false, status: "not_set" };
  cache.put(ck, "1", 600);
  stageNotify_(sh, r, kind, String(a.v[P.NAME - 1]));
  return { ok: true };
}

function riderToken_(d) {
  var a = authPilot_(d); if (a.code !== "ok") return authFail_(a);
  return { ok: saveToken_(a.sh, a.row, d.token) };
}

// =====================================================================
// ===== إشعارات Firebase (FCM HTTP v1) ================================
// =====================================================================

var FCM_ERR_ = "";   // سبب آخر فشل في Firebase (بيظهر في نتيجة الإشعار بالشيت)
function fcmAccessToken_() {
  FCM_ERR_ = "";
  var cache = CacheService.getScriptCache(), c = cache.get("fcm_access_token");
  if (c) return c;
  var props = PropertiesService.getScriptProperties(), email = props.getProperty("FIREBASE_CLIENT_EMAIL"), key = props.getProperty("FIREBASE_PRIVATE_KEY");
  if (!email) { FCM_ERR_ = "FIREBASE_CLIENT_EMAIL ناقص في Script properties"; return null; }
  if (!key) { FCM_ERR_ = "FIREBASE_PRIVATE_KEY ناقص في Script properties"; return null; }
  email = String(email).trim();
  key = String(key).trim().replace(/^["']+|["',]+$/g, "").replace(/\\n/g, "\n");   // بيشيل علامات التنصيص/الفاصلة لو اتنسخت مع القيمة
  if (key.indexOf("BEGIN PRIVATE KEY") < 0) { FCM_ERR_ = "FIREBASE_PRIVATE_KEY مش صحيح (لازم يبدأ بـ -----BEGIN PRIVATE KEY-----)"; return null; }
  var b64 = function (bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ""); };
  var now = Math.floor(Date.now() / 1000);
  var head = b64(Utilities.newBlob(JSON.stringify({ alg: "RS256", typ: "JWT" })).getBytes());
  var claim = b64(Utilities.newBlob(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now })).getBytes());
  var sig; try { sig = b64(Utilities.computeRsaSha256Signature(head + "." + claim, key)); } catch (e) { FCM_ERR_ = "FIREBASE_PRIVATE_KEY غير صالح (انسخه كامل من BEGIN لحد END)"; return null; }
  var resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", { method: "post", contentType: "application/x-www-form-urlencoded", muteHttpExceptions: true,
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claim + "." + sig } });
  var j = {}; try { j = JSON.parse(resp.getContentText()); } catch (e) {}
  if (!j.access_token) { Logger.log("FCM auth error: " + resp.getContentText()); FCM_ERR_ = "فشل المصادقة مع Google: " + String(j.error_description || j.error || resp.getResponseCode()).slice(0, 120); return null; }
  cache.put("fcm_access_token", j.access_token, 3300);
  return j.access_token;
}

function fcmBody_(token, title, body, tag, data, image, channel) {
  var web = PropertiesService.getScriptProperties().getProperty("RIDER_WEB_URL") || "";
  var dd = {}; for (var k in (data || {})) dd[k] = String(data[k]);
  var m = { token: token, notification: { title: title, body: body }, data: dd,
    android: { priority: "HIGH", ttl: "300s", notification: { channelId: channel || FCM_CHANNEL, sound: "default", defaultSound: true, defaultVibrateTimings: true, notificationPriority: "PRIORITY_MAX", visibility: "PUBLIC", tag: tag || "" } },
    webpush: { headers: { Urgency: "high", TTL: "300" }, notification: { tag: tag || "", requireInteraction: true } } };
  if (/^https:\/\//.test(image || "")) { m.notification.image = image; m.webpush.notification.image = image; }   // صورة كبيرة في الإشعار (بتظهر لما يتفرد)
  if (/^https:\/\//.test(web)) { m.webpush.fcm_options = { link: web }; m.webpush.notification.icon = web.replace(/\/?$/, "/") + "assets/icons/icon-192.png"; }
  return { message: m };
}

// بيبعت لمجموعة طيارين بالتوازي. items: [{token,row}] ← بيرجّع {sent, failed, err}
function fcmSendMany_(items, title, body, tag, data, image, channel) {
  var pid = String(PropertiesService.getScriptProperties().getProperty("FIREBASE_PROJECT_ID") || "").trim(), at = pid ? fcmAccessToken_() : null;
  if (!pid || !at) return { sent: 0, failed: items.length, err: !pid ? "FIREBASE_PROJECT_ID ناقص في Script properties" : (FCM_ERR_ || "Firebase مش مضبوط") };
  var url = "https://fcm.googleapis.com/v1/projects/" + pid + "/messages:send";
  var reqs = items.map(function (it) {
    return { url: url, method: "post", contentType: "application/json", headers: { Authorization: "Bearer " + at }, muteHttpExceptions: true, payload: JSON.stringify(fcmBody_(it.token, title, body, tag, data, image, channel)) };
  });
  var sent = 0, failed = 0, err = "", dead = [], rs = reqs.length ? UrlFetchApp.fetchAll(reqs) : [];
  for (var i = 0; i < rs.length; i++) {
    var c = rs[i].getResponseCode();
    if (c >= 200 && c < 300) sent++;
    else {
      failed++; err = "FCM " + c + " " + String(rs[i].getContentText() || "").replace(/\s+/g, " ").slice(0, 150);
      if (c === 404) { dead.push(items[i].token); if (items[i].sh && items[i].row) { try { items[i].sh.getRange(items[i].row, P.TOKEN).setValue(""); } catch (e) {} } }   // التوكن مات (التطبيق اتمسح)
      else Logger.log("FCM error " + c + ": " + rs[i].getContentText());
    }
  }
  return { sent: sent, failed: failed, err: err, dead: dead };
}

// إشعار لكل الطيارين المقبولين + غير موقوفين + حالتهم "يعمل الان" + عندهم توكن. بيرجّع نص بيتكتب في عمود "نتيجة الإشعار"
function broadcastToRiders_(title, body, tag, data, exceptPhone) {
  var stamp = Utilities.formatDate(new Date(), TZ, "hh:mm a"), sh = ssOpen_().getSheetByName(PIL_TAB);
  if (!sh) return "ورقة الطيارين مش موجودة (" + stamp + ")";
  var rows = readPilots_(sh), items = [], working = 0;
  for (var i = 0; i < rows.length; i++) {
    var v = rows[i], st = String(v[P.STATE - 1]).trim();
    if (String(v[P.REQ - 1]).trim() !== "مقبول" || st.indexOf("موقوف") === 0 || !isWorking_(v)) continue;
    if (exceptPhone && normPhone_(v[P.PHONE - 1]) === exceptPhone) continue;
    working++;
    var t = String(v[P.TOKEN - 1] || "").trim();
    if (t) items.push({ token: t, row: i + 2, sh: sh });
  }
  if (!working) return "مفيش طيار شغال دلوقتي (" + stamp + ")";
  if (!items.length) return working + " طيار شغال بس مفيش توكن إشعارات (" + stamp + ")";
  var r = fcmSendMany_(items, title, body, tag, data);
  return "إشعار للطيارين: " + r.sent + " وصل" + (r.failed ? " / " + r.failed + " فشل" + (r.err ? " (" + r.err + ")" : "") : "") + " (" + stamp + ")";
}

// =====================================================================
// ===== إشعارات العميل (حتى لو التطبيق مقفول) =========================
// =====================================================================
var CTK_TAB = "توكنات العملاء";   // ورقة مخفية: معرّف الطلب ← توكن إشعارات جهاز العميل (التطبيق بيبعتها لوحده)
function ctkSheet_(ss) {
  var sh = ss.getSheetByName(CTK_TAB);
  if (!sh) {
    sh = ss.insertSheet(CTK_TAB);
    sh.getRange(1, 1, 1, 3).setValues([["معرّف الطلب", "توكن الإشعارات", "آخر تحديث"]]);
    try { headerStyle_(sh.getRange(1, 1, 1, 3)); } catch (e) {}
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (e2) {}
  }
  return sh;
}
function saveCustToken_(ss, cids, token, phone, device) {
  token = String(token || "").trim();
  if (!/^[A-Za-z0-9_:\-\.]{20,600}$/.test(token)) return false;
  var keys = (cids || []).slice(0, 30).map(function (c) { return cleanCid_(c); }).filter(function (c) { return !!c; });
  var dv = String(device || "").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 40); if (dv.length >= 8) keys.push("dev:" + dv);   // كل جهاز متسجّل (حتى من غير طلبات) علشان يوصله إشعار العروض
  var ph = normPhone_(phone); if (ph) keys.push("tel:" + ph);        // التوكن مربوط برقم العميل كمان: بيوصله إشعار أي طلب جديد حتى لو اتعمل قبل تسجيل التوكن
  if (!keys.length) return false;
  var sh = ctkSheet_(ss), n = sh.getLastRow(), cur = n >= 2 ? sh.getRange(2, 1, n - 1, 2).getDisplayValues() : [], idx = {};
  for (var i = 0; i < cur.length; i++) idx[String(cur[i][0])] = i + 2;
  var stamp = Utilities.formatDate(new Date(), TZ, "dd/MM/yyyy hh:mm a"), add = [];
  keys.forEach(function (c) {
    if (idx[c]) { if (String(cur[idx[c] - 2][1]) !== token) sh.getRange(idx[c], 2, 1, 2).setNumberFormat("@").setValues([[token, stamp]]); }
    else add.push([c, token, stamp]);
  });
  if (add.length) sh.getRange(n + 1, 1, add.length, 3).setNumberFormat("@").setValues(add);
  if (ph) custSheetToken_(ss, ph, token);      // نسخة في ورقة "العملاء" علشان تشوفها
  return true;
}
// ===== كود الإشعارات في ورقة "العملاء" (زي عمود "توكن الإشعارات" في ورقة الطيارين) =====
// بيدوّر على عمود عنوانه فيه "توكن" أو "اشعار" وعلى عمود رقم الهاتف، وبيكتب التوكن في صف العميل أول ما التطبيق يسجّله.
function custSheetCols_(sh) {
  var lc = sh.getLastColumn(), hdr = sh.getRange(1, 1, 1, lc).getDisplayValues()[0], tc = 0, pc = 0;
  for (var i = 0; i < hdr.length; i++) {
    var n = arNorm_(hdr[i]).replace(/\s+/g, "");
    if (!tc && /توكن|اشعار|token/.test(n)) tc = i + 1;
    if (!pc && /هاتف|تليفون|موبايل|phone/.test(n)) pc = i + 1;
  }
  return { tc: tc, pc: pc };
}
function custSheetOf_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) if (arNorm_(sheets[i].getName()).replace(/\s+/g, "") === "العملاء") return sheets[i];
  return null;
}
function custSheetToken_(ss, phone, token) {
  try {
    phone = normPhone_(phone); if (!phone || !token) return;
    var sh = custSheetOf_(ss); if (!sh || sh.getLastRow() < 2) return;
    var c = custSheetCols_(sh); if (!c.tc || !c.pc) return;
    var ph = sh.getRange(2, c.pc, sh.getLastRow() - 1, 1).getDisplayValues();
    for (var i = 0; i < ph.length; i++) {
      if (normPhone_(ph[i][0]) === phone) { var cell = sh.getRange(i + 2, c.tc); if (String(cell.getDisplayValue()) !== token) cell.setNumberFormat("@").setValue(token); return; }
    }
  } catch (e) {}
}
// شغّلها مرة واحدة من المحرر: بتملا العمود للعملاء اللي توكناتهم متسجّلة قبل كده
function fillCustomerTokens() {
  var ss = ssOpen_(), sh = ctkSheet_(ss), n = sh.getLastRow(); if (n < 2) { Logger.log("مفيش توكنات متسجّلة"); return; }
  var v = sh.getRange(2, 1, n - 1, 2).getDisplayValues(), done = 0;
  v.forEach(function (r) { if (String(r[0]).indexOf("tel:") === 0 && r[1]) { custSheetToken_(ss, String(r[0]).slice(4), String(r[1])); done++; } });
  Logger.log("✅ اتراجع " + done + " عميل");
}

function custTokenOf_(cid) {
  cid = String(cid || ""); if (!cid) return "";
  var sh = ssOpen_().getSheetByName(CTK_TAB); if (!sh || sh.getLastRow() < 2) return "";
  var f = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(cid).matchEntireCell(true).findNext();
  return f ? String(sh.getRange(f.getRow(), 2).getDisplayValue() || "").trim() : "";
}
var NLOG_TAB = "سجل الإشعارات";   // ورقة تشخيص: كل محاولة إشعار (لمين، وإيه النتيجة). بتتمسح لوحدها بعد 300 سطر
function nlog_(who, ref, what, res) {
  try {
    var ss = ssOpen_(), sh = ss.getSheetByName(NLOG_TAB);
    if (!sh) { sh = ss.insertSheet(NLOG_TAB); sh.getRange(1, 1, 1, 5).setValues([["الوقت", "إلى", "مرجع", "الإشعار", "النتيجة"]]); sh.setFrozenRows(1); }
    sh.appendRow([Utilities.formatDate(new Date(), TZ, "dd/MM hh:mm:ss a"), who, ref, what, res]);
    var n = sh.getLastRow(); if (n > 400) sh.deleteRows(2, n - 300);
  } catch (e) {}
}
function notifyCust_(cid, title, body, tag, data, phone) {
  var res = "";
  try {
    var t = custTokenOf_(cid);
    if (!t && phone) t = custTokenOf_("tel:" + normPhone_(phone));
    if (!t) res = "❌ مفيش توكن لجهاز العميل (التطبيق لسه مسجّلش، أو الإشعارات مش مسموحة، أو الـ APK من غير Firebase)";
    else { var r = fcmSendMany_([{ token: t }], title, body, tag, data || {}); res = r.sent ? "✅ اتبعت" : "❌ فشل: " + (r.err || "?"); if (r.dead && r.dead.length) ctkDropTokens_(r.dead); }
  } catch (e) { res = "❌ خطأ: " + e; }
  nlog_("عميل", tag, title, res);
}
function shortName_(n) { return String(n || "").trim().split(/\s+/).slice(0, 2).join(" "); }
// kind: accepted | prep | deliv | arrived | done | released
function stageNotify_(sh, r, kind, who) {
  try {
    var cid = String(sh.getRange(r, O_CID).getValue() || "");
    var bon = sh.getRange(r, O.BON).getValue(), nm = shortName_(bareName_(who || sh.getRange(r, O.PNAME).getValue()));
    var M = {
      accepted: ["تم قبول طلبك ✅", (nm ? "المندوب " + nm + " " : "المندوب ") + "قبل طلبك رقم " + bon + " وبدأ في تجهيزه"],
      prep: ["جاري تجهيز طلبك 💊", "طلبك رقم " + bon + " بيتجهّز دلوقتي"],
      deliv: ["طلبك في الطريق إليك 🛵", "المندوب خرج بطلبك رقم " + bon + "، استعد للاستلام"],
      arrived: ["المندوب وصل اللوكيشن عندك 📍", "يمكنك التحرك إلى مكان مقابلة المندوب لاستلام طلبك، أو يمكنك التواصل بالمندوب لمعرفة كيف يمكنك استلام طلبك"],
      done: ["تم توصيل طلبك 🎉", "شكراً لثقتك في صيدلية عوف"],
      released: ["جاري تعيين مندوب آخر 🔄", "المندوب مش هيقدر يكمل طلبك رقم " + bon + "، وجاري تعيين مندوب تاني حالاً"]
    }[kind];
    if (M) notifyCust_(cid, M[0], M[1], "order_" + bon, { type: "order_status", bon: bon, stage: kind }, sh.getRange(r, O.PHONE).getDisplayValue());
  } catch (e) {}
}
// إشعار لمندوب واحد (مثلاً لما الإدارة تعيّنله طلب من الشيت)
function notifyRiderByPhone_(phone, title, body, tag, data) {
  try {
    var sh = ssOpen_().getSheetByName(PIL_TAB), f = sh && findPilot_(sh, phone), t = f ? String(f.v[P.TOKEN - 1] || "").trim() : "";
    if (!t) nlog_("مندوب", tag, title, "❌ مفيش توكن للمندوب");
    else { var r = fcmSendMany_([{ token: t, row: f.row, sh: sh }], title, body, tag, data || {}); nlog_("مندوب", tag, title, r.sent ? "✅ اتبعت" : "❌ فشل: " + (r.err || "?")); }
  } catch (e) {}
}


// =====================================================================
// ===== إشعارات العروض الجديدة لكل العملاء =============================
// =====================================================================
// أي منتج يبقى عليه خصم أو عرض قطعة إضافية (زي ما التطبيق بيحدد العروض المتحركة) وكان مش عرض قبل كده → إشعار بتفاصيله لكل العملاء.
// بيشتغل كل 5 دقايق بمشغّل (شغّل installOfferTrigger مرة واحدة). أول تشغيل بيسجّل العروض الموجودة من غير ما يبعت.
var OFFER_TABS = ["الادويه", "العنايه"];       // نفس SHEET.TABS في config.js بتاع العميل
var NOFF_TAB = "العروض المُرسلة";               // ورقة تلقائية: العروض اللي اتبعتت قبل كده (متلمسهاش)
function arNorm_(s) { return String(s == null ? "" : s).toLowerCase().replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim(); }
var OFF_KEYS_ = null;
function offKey_(h) {
  var n = arNorm_(h); if (!n) return "";
  if (!OFF_KEYS_) {
    var M = { "الرقم": "id", "اسم المنتج": "name", "سعر العلبه": "price", "قيمه الخصم": "disc", "الخصم": "disc", "الحد الادني": "min", "الحد الادنى": "min", "العدد المشمول": "inc", "العدد المشمول بالخصم": "inc", "عدد العلب المشمول": "inc", "عدد القطع في العرض": "bxn", "عدد القطع الاضافيه": "bxn", "سعر عرض": "op", "سعر العرض": "op", "سعر الاوفر": "op", "لينك العرض": "offerimg", "رابط العرض": "offerimg", "صوره العرض": "offerimg", "بوستر العرض": "offerimg", "لينك البوستر": "offerimg", "عرض": "offer", "عرض خاص": "offer", "حاله العرض": "ostate", "تشغيل العرض": "ostate", "عرض القطعه الاضافيه": "bonus", "القطعه الاضافيه": "bonus", "العرض الاضافي": "bonus", "عرض اضافي": "bonus" };
    OFF_KEYS_ = {}; for (var k in M) OFF_KEYS_[arNorm_(k)] = M[k];
  }
  if (OFF_KEYS_[n]) return OFF_KEYS_[n];
  if (/(حاله|تشغيل|ايقاف|شغال)/.test(n) && /عرض/.test(n) && !/لينك|رابط|صور|سعر|بوستر/.test(n)) return "ostate";
  if (/عرض|offer|poster|بوستر/.test(n) && /لينك|رابط|صور|link|image|url|بوستر|poster/.test(n)) return "offerimg";
  if (/سعر/.test(n) && /عرض|اوفر|offer/.test(n) && !/شريط|شرايط|شرائط|strip/.test(n)) return "op";
  if (/^عدد.*قطع/.test(n)) return "bxn";
  if (/قطعه.*اضاف|اضاف.*قطعه/.test(n)) return "bonus";
  if (/سعر/.test(n)) return /شريط|شرايط|شرائط|strip/.test(n) ? "" : "price";
  return "";
}
function offAscii_(v) { return String(v == null ? "" : v).replace(/[٠-٩]/g, function (x) { return "٠١٢٣٤٥٦٧٨٩".indexOf(x); }).replace(/[۰-۹]/g, function (x) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(x); }).replace(/٫/g, ".").replace(/[٬,]/g, ""); }
function offNum_(v) { var m = offAscii_(v).match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : 0; }
// ===== حالة العرض (عمود "حالة العرض" بعد "لينك العرض"): تشغيل = العرض بيتبعت للعملاء ويدخل في الدوران. فاضي/ايقاف = مفيش إشعار خالص =====
var OFFER_STATE_HEADER = "حالة العرض";
var OFFER_MOVE_TO_TOP = true;        // true = أول ما تغيّر العرض لـ "تشغيل" الصف بيطلع لأول الشيت تحت العناوين مباشرة (false = يفضل مكانه)
function offerIsOn_(v) {
  var s = arNorm_(v).replace(/\s+/g, "");
  if (!s || /ايقاف|وقف|اغلاق|مقفل|^off$|^0$|^لا$|false/.test(s)) return false;
  return /تشغيل|شغال|فعال|مفعل|^on$|^1$|^نعم$|true|✓|✔/.test(s);
}
// هل في أي ورقة منتجات عمود "حالة العرض"؟ (لو مفيش خالص: كل العروض شغالة زي الأول)
function offerStatePresent_(ss) {
  for (var i = 0; i < OFFER_TABS.length; i++) {
    var sh = ss.getSheetByName(OFFER_TABS[i]); if (!sh || sh.getLastColumn() < 1) continue;
    var v = sh.getRange(1, 1, Math.min(6, Math.max(sh.getLastRow(), 1)), sh.getLastColumn()).getDisplayValues();
    for (var r = 0; r < v.length; r++) for (var c = 0; c < v[r].length; c++) if (offKey_(v[r][c]) === "ostate") return true;
  }
  return false;
}
// عرض مكتوب بنص حر في عمود "عرض" (خد واحدة والتانية مجانا / اشتري علبتين وخد علبة هدية / التانية بنص السعر / 1+1 / خصم 20%): نفس منطق التطبيق
var NUMW_ = { "وحده": 1, "واحده": 1, "واحد": 1, "علبه": 1, "اتنين": 2, "اثنين": 2, "علبتين": 2, "تلاته": 3, "ثلاثه": 3, "اربعه": 4 };
function numWord_(s) { s = offAscii_(s || ""); return /^\d+$/.test(s) ? parseInt(s, 10) : (NUMW_[s] || 0); }
function offRaw_(o) { var v = String(o.offer == null ? "" : o.offer).trim(); return (!v || /^(0|لا|no|false|-|x)$/i.test(arNorm_(v))) ? "" : v; }
function offLabel_(v) { return !v ? "" : (/^(1|نعم|yes|true|✓|✔|عرض|عرض خاص|اوفر|offer)$/i.test(arNorm_(v)) ? "عرض خاص" : v); }
function withTextOffer_(o) {
  var raw = offRaw_(o); if (!raw) return;
  if (String(o.bonus == null ? "" : o.bonus).trim() || offNum_(o.op) > 0) return;
  var tx = offAscii_(arNorm_(raw)).replace(/\s+/g, " ");
  var pl = tx.match(/(\d+)\s*\+\s*(\d+)/), half = /(نص|نصف)\s*(ال)?(سعر|تمن|ثمن)|half/.test(tx), free = /مجان|هدي|free|gift/.test(tx);
  var W = "(\\d+|وحده|واحده|واحد|علبه|اتنين|اثنين|علبتين|تلاته|ثلاثه|اربعه)";
  if (pl || half || free) {
    var a = pl ? parseInt(pl[1], 10) : 0, b = pl ? parseInt(pl[2], 10) : 0, m;
    if (!a) { m = tx.match(new RegExp("(?:اشتري|اشتر|خد|خذ|buy)\\s+" + W)); a = m ? numWord_(m[1]) : 1; }
    if (!b) { m = tx.match(new RegExp("(?:وخد|و خد|واحصل على|واخد)\\s+" + W)); b = m ? numWord_(m[1]) : 1; }
    o.bonus = half ? "نص" : "هدية";
    if (!String(o.min == null ? "" : o.min).trim()) o.min = String(a || 1);
    if (!String(o.bxn == null ? "" : o.bxn).trim()) o.bxn = String(b || 1);
    return;
  }
  var pc = tx.match(/(\d+(?:\.\d+)?)\s*(?:%|٪|بالمايه|في المايه)/);
  if (pc && !String(o.disc == null ? "" : o.disc).trim()) o.disc = pc[1] + "%";
}
function readOffers_() {
  var ss = ssOpen_(), out = [], ids = {}, ostP = offerStatePresent_(ss);
  OFFER_TABS.forEach(function (tab, ti) {
    var sh = ss.getSheetByName(tab); if (!sh) return;
    var last = sh.getLastRow(), lc = sh.getLastColumn(); if (last < 2 || lc < 1) return;
    var vals = sh.getRange(1, 1, last, lc).getDisplayValues(), hi = -1, keys = [];
    for (var r = 0; r < Math.min(6, vals.length); r++) { var ks = vals[r].map(offKey_); if (ks.filter(function (k) { return k; }).length >= 2) { hi = r; keys = ks; break; } }
    if (hi < 0) { hi = 0; keys = vals[0].map(offKey_); }
    for (var i = hi + 1; i < vals.length; i++) {
      var o = {}; keys.forEach(function (k, c) { if (k && (o[k] == null || String(o[k]).trim() === "")) o[k] = vals[i][c]; });
      var name = String(o.name || "").trim(); if (!name) continue;
      withTextOffer_(o);
      var drw = String(o.disc == null ? "" : o.disc), dv = offNum_(drw);
      if (!/[%٪]/.test(drw) && dv > 0 && dv < 1) dv = Math.round(dv * 100);
      dv = Math.min(100, dv);
      var bw = offAscii_(o.bonus).replace(/\s+/g, ""), bx = null;
      if (bw) { if (/هدي|مجان|free|gift/i.test(bw)) bx = 0; else if (/نص|نصف|half/i.test(bw)) bx = 50; else { var m = bw.match(/(\d+(?:\.\d+)?)/); if (m) { var pv = parseFloat(m[1]); if (pv > 0 && pv <= 100) bx = Math.round((100 - pv) * 100) / 100; } } }
      var price = offNum_(o.price), op = offNum_(o.op); if (!(op > 0 && price > 0 && op < price)) op = 0;      // "سعر عرض": سعر ثابت أقل من الأصلي
      if (op > 0) { bx = null; dv = 0; }
      if (bx != null) dv = 0;
      var txt = offLabel_(offRaw_(o));
      if (!(dv > 0 || bx != null || op > 0 || txt)) continue;        // مفيش أي نوع عرض على المنتج ده
      if (ostP && !offerIsOn_(o.ostate)) continue;                    // حالة العرض مش "تشغيل": مفيش إشعار ولا دوران
      var id = String(o.id == null ? "" : o.id).trim();
      if (id && ids[id]) id = id + "_" + (ti + 1); if (id) ids[id] = 1;
      out.push({ id: id, name: name, price: price, op: op, disc: dv, bx: bx, bxn: Math.max(1, Math.floor(offNum_(o.bxn)) || 1), min: Math.max(1, Math.floor(offNum_(o.min)) || 1), inc: Math.max(0, Math.floor(offNum_(o.inc)) || 0), text: txt, imgs: offImg_(o.offerimg) });
    }
  });
  return out;
}
// صورة العرض (عمود "لينك العرض"): لينك درايف بيتحوّل لصورة مباشرة كبيرة. لو مش لينك https مباشر: من غير صورة
function offImg_(u) {
  u = String(u == null ? "" : u).replace(/\s+/g, "").replace(/^["']+|["']+$/g, ""); if (!u) return [];
  var m = u.match(/\/d\/([\w-]{10,})/) || u.match(/[?&]id=([\w-]{10,})/);
  if (m && /drive\.google|docs\.google/.test(u)) return ["https://lh3.googleusercontent.com/d/" + m[1] + "=w900", "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w900", "https://drive.google.com/uc?export=view&id=" + m[1]];
  return /^https:\/\//.test(u) ? [u] : [];
}
function arD_(v) { return String(v).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".charAt(d); }); }
function offMoney_(n) { return (Math.round(n * 100) / 100) + " ج.م"; }
function offCntW_(n) { return n === 1 ? "علبة" : n === 2 ? "علبتين" : arD_(n) + " علب"; }
function offCnt_(n) { return n === 1 ? "علبة واحدة" : n === 2 ? "علبتين" : arD_(n) + " " + (n > 2 && n < 11 ? "علب" : "علبة"); }
// تفاصيل العرض كاملة (نفس منطق الكارت المتحرك في التطبيق)
function offerText_(p) {
  var L = [];
  if (p.op > 0) {
    L.push("عرض خصم: السعر بـ " + offMoney_(p.op) + " بدلاً من " + offMoney_(p.price) + " لفترة محدودة");
  } else if (p.bx != null) {
    var n = Math.max(1, p.min), ex = p.bx === 0 ? "هدية" : p.bx === 50 ? "بنص السعر" : "بخصم " + arD_(100 - p.bx) + "٪";
    L.push("اشتري " + offCntW_(n) + " وخد " + offCntW_(p.bxn) + (p.bx === 0 ? "" : " إضافية") + " " + ex + " " + (n === 1 ? "وده على كل علبة بتشتريها" : "وده بيتكرر على كل " + (n === 2 ? "علبتين" : arD_(n) + " علب") + " بتشتريها"));
    if (p.price > 0) L.push(offMoney_(p.price) + " للعلبة" + (p.bx === 0 ? "" : " والتانية بـ" + offMoney_(p.price * p.bx / 100)));
  } else if (!(p.disc > 0)) {
    L.push(p.text && p.text !== "عرض خاص" ? p.text : "عرض خاص ⭐");
    if (p.price > 0) L.push(offMoney_(p.price) + " للعلبة");
  } else {
    var dt = arD_(p.disc) + "٪";
    if (p.min <= 1 && !(p.inc > 0)) L.push("خصم " + dt + " على كل علبة");
    else if (p.min <= 1) L.push("خصم " + dt + " على أول " + offCnt_(p.inc));
    else if (p.inc > 0) L.push("اشتري " + offCnt_(p.min) + " واحصل على خصم " + dt + " على " + offCnt_(p.inc));
    else L.push("اشتري " + offCnt_(p.min) + " أو أكتر واحصل على خصم " + dt + " على كل العلب");
    if (p.price > 0) L.push("السعر بعد الخصم: " + offMoney_(p.price - Math.round(p.price * p.disc) / 100) + " للعلبة بدل " + offMoney_(p.price));
  }
  return L.join("\n") + (p.bx === 0 ? " 🎁" : "");     // أيقونة الهدية في آخر النص خالص
}
// نص الإشعار الكامل: "عرض على <المنتج>" وتحته التفاصيل (والصورة بتيجي تحتهم)
// "عرض على" مرة واحدة بس: لو اسم المنتج في الشيت "عرض كليري" بيبقى "عرض على كليري"، ولو "بنادول" بيبقى "عرض على بنادول"
function offerBody_(p) {
  var nm = String(p.name || "").replace(/^\s*عرض(\s+على)?\s+/, "").trim() || String(p.name || "");
  return "عرض على " + nm + "\n" + offerText_(p);
}
var OFFER_TITLE_ = "عرض خاص ولفترة محدودة ⭐";
function noffSheet_(ss) {
  var sh = ss.getSheetByName(NOFF_TAB);
  if (!sh) { sh = ss.insertSheet(NOFF_TAB); sh.getRange(1, 1, 1, 2).setValues([["رقم المنتج", "بصمة العرض"]]); sh.setFrozenRows(1); try { sh.hideSheet(); } catch (e) {} }
  return sh;
}
function ctkDropTokens_(tokens) {
  try {
    var sh = ssOpen_().getSheetByName(CTK_TAB), n = sh ? sh.getLastRow() : 0; if (n < 2) return;
    var set = {}; tokens.forEach(function (t) { set[t] = 1; });
    var v = sh.getRange(2, 2, n - 1, 1).getDisplayValues();
    for (var i = v.length - 1; i >= 0; i--) if (set[String(v[i][0]).trim()]) sh.deleteRow(i + 2);
  } catch (e) {}
}
// بيجرّب لينكات الصورة بالترتيب ويختار أول واحد شغّال (صورة فعلاً + أقل من 1MB + سريع). بيرجّع {url, note}
function offImgPick_(cands) {
  if (!cands || !cands.length) return { url: "", note: "❌ مفيش صورة (عمود لينك العرض فاضي أو مش لينك https مباشر)" };
  var probs = [];
  for (var i = 0; i < cands.length; i++) {
    try {
      var t0 = Date.now(), r = UrlFetchApp.fetch(cands[i], { muteHttpExceptions: true, followRedirects: true }), ms = Date.now() - t0;
      var c = r.getResponseCode(), h = r.getHeaders(), ct = String(h["Content-Type"] || h["content-type"] || ""), len = r.getBlob().getBytes().length;
      if (c !== 200) { probs.push("رجّع " + c); continue; }
      if (ct.indexOf("image") !== 0) { probs.push("مش صورة (" + ct.split(";")[0] + ") — الملف غالباً مش مشارَك للكل"); continue; }
      if (len > 1000000) { probs.push("كبيرة " + Math.round(len / 1024) + "KB (الحد 1MB)"); continue; }
      return { url: cands[i], note: "✅ الصورة سليمة (" + Math.round(len / 1024) + "KB، " + (ms / 1000).toFixed(1) + " ث)" + (ms > 3000 ? " ⚠️ بطيئة: الموبايل بيستنى 5 ثواني بس" : "") };
    } catch (e) { probs.push("تعذّر الفتح: " + String(e).slice(0, 60)); }
  }
  return { url: "", note: "❌ " + probs.join(" | ") };
}
function sendToAllCustomers_(title, body, tag, data, imgs, channel) {
  var pick = imgs === undefined ? null : offImgPick_([].concat(imgs || [])), image = pick ? pick.url : undefined;
  var sh = ctkSheet_(ssOpen_()), n = sh.getLastRow();
  if (n < 2) { nlog_("كل العملاء", tag, title, "❌ مفيش أي جهاز عميل متسجّل لسه"); return pick ? pick.note : ""; }
  var vals = sh.getRange(2, 2, n - 1, 1).getDisplayValues(), seen = {}, items = [];
  vals.forEach(function (r) { var t = String(r[0] || "").trim(); if (t && !seen[t]) { seen[t] = 1; items.push({ token: t }); } });
  var sent = 0, failed = 0, err = "", dead = [];
  for (var i = 0; i < items.length; i += 100) {
    var r = fcmSendMany_(items.slice(i, i + 100), title, body, tag, data, image, channel);
    sent += r.sent; failed += r.failed; if (r.err) err = r.err; if (r.dead) dead = dead.concat(r.dead);
  }
  if (dead.length) ctkDropTokens_(dead);
  nlog_("كل العملاء (" + items.length + " جهاز)", tag, title, (sent ? "✅ " + sent + " وصل" : "❌ ولا واحد") + (failed ? " / " + failed + " فشل" + (err ? " (" + err + ")" : "") : "") + (pick ? " | 🖼 " + pick.note : ""));
  return pick ? pick.note : "";
}
var OFFER_MAX_PER_RUN = 10;   // أقصى عدد إشعارات عروض في المرة الواحدة (الباقي بيتبعت في الفحص اللي بعده بـ 5 دقايق) علشان السكربت ميعديش وقته
function checkNewOffers() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) return;
  var toSend = [], allOffers = null;
  try {
    var ss = ssOpen_(), offers = readOffers_(), sh = noffSheet_(ss), n = sh.getLastRow(), old = {}, props = PropertiesService.getScriptProperties();
    (n >= 2 ? sh.getRange(2, 1, n - 1, 2).getDisplayValues() : []).forEach(function (r) { old[r[0]] = r[1]; });
    allOffers = offers;
    var first = !props.getProperty("OFFERS_INIT"), rows = [];
    offers.forEach(function (p) {
      var key = p.id || ("n:" + arNorm_(p.name)), sig = [p.disc, p.bx, p.bxn, p.min, p.inc, p.op, p.text].join("~");
      if (first || old[key] === sig) { rows.push([key, sig]); return; }          // مش جديد
      if (toSend.length < OFFER_MAX_PER_RUN) { toSend.push(p); rows.push([key, sig]); }      // هيتبعت دلوقتي
      else if (old[key] != null) rows.push([key, old[key]]);                      // زيادة عن الحد: يستنى الفحص الجاي (يفضل "جديد")
    });
    sh.getRange(2, 1, Math.max(n, 2), 2).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 2).setNumberFormat("@").setValues(rows);
    props.setProperty("OFFERS_INIT", "1");
    if (first) Logger.log("✅ اتسجّل " + offers.length + " عرض موجود (من غير إرسال). أي عرض جديد من دلوقتي هيتبعت.");
  } finally { try { lock.releaseLock(); } catch (x) {} }
  // كل عرض في إشعار منفصل بتفاصيله وصورته
  toSend.forEach(function (p) { sendToAllCustomers_(OFFER_TITLE_, offerBody_(p), "offer_" + (p.id || p.name), { type: "offer", id: p.id || "" }, p.imgs); });
  if (toSend.length) rotMark_(toSend.map(offKeyOf_));      // العرض الجديد اتعرض دلوقتي، فمش هيتكرر في الدوران على طول
  try { rotateOffers_(allOffers); } catch (e) { nlog_("دوران العروض", "-", "-", "❌ خطأ: " + String(e).slice(0, 120)); }
  try { brandTick_(); } catch (e2) { nlog_("رسائل الصيدلية", "-", "-", "❌ خطأ: " + String(e2).slice(0, 120)); }
}

// =====================================================================
// ===== دوران العروض: كل فترة يظهر للعملاء 1-2 عرض من العروض الموجودة =====
// =====================================================================
// كل OFFER_ROTATE_EVERY_MIN دقيقة بيتبعت OFFER_ROTATE_COUNT عروض مختلفة لكل العملاء، ومن غير تكرار لحد ما كل العروض تتعرض، وبعدها بيبدأ دورة جديدة.
// بيشتغل من نفس مشغّل installOfferTrigger (كل 5 دقايق) ومحتاج الشرط الزمني بس.
var OFFER_ROTATE_ON = true;               // false = يقفل الدوران (إشعار العرض الجديد بيفضل شغال)
var OFFER_ROTATE_EVERY_MIN = 30;          // كل كام دقيقة (نص ساعة = 30)
var OFFER_ROTATE_COUNT = 1;               // كام عرض في كل مرة (1 أو 2)
var OFFER_ROTATE_FROM_HOUR = 9;           // بتوقيت القاهرة: مفيش إشعارات قبل الساعة دي ولا بعد اللي بعدها
var OFFER_ROTATE_TO_HOUR = 23;            // (خليها 0 و 24 لو عايزها طول اليوم)
var ROT_TAB = "دوران العروض";            // ورقة تلقائية: العروض اللي اتعرضت في الدورة الحالية (متلمسهاش)
function offKeyOf_(p) { return p.id || ("n:" + arNorm_(p.name)); }
function rotSheet_(ss) {
  var sh = ss.getSheetByName(ROT_TAB);
  if (!sh) { sh = ss.insertSheet(ROT_TAB); sh.getRange(1, 1).setValue("عروض اتعرضت في الدورة الحالية"); sh.setFrozenRows(1); try { sh.hideSheet(); } catch (e) {} }
  return sh;
}
function rotMark_(keys) {
  try {
    var sh = rotSheet_(ssOpen_()), n = sh.getLastRow(), have = {};
    (n >= 2 ? sh.getRange(2, 1, n - 1, 1).getDisplayValues() : []).forEach(function (r) { have[r[0]] = 1; });
    var add = keys.filter(function (k) { return k && !have[k]; }).map(function (k) { return [k]; });
    if (add.length) sh.getRange(Math.max(n, 1) + 1, 1, add.length, 1).setNumberFormat("@").setValues(add);
  } catch (e) {}
}
function shuffle_(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function rotateOffers_(offersArg, force) {
  if (!OFFER_ROTATE_ON && !force) return;
  var props = PropertiesService.getScriptProperties(), now = Date.now();
  if (!force) {
    var h = Number(Utilities.formatDate(new Date(), TZ, "H"));
    if (h < OFFER_ROTATE_FROM_HOUR || h >= OFFER_ROTATE_TO_HOUR) return;
    if (now - Number(props.getProperty("OFFER_ROT_LAST") || 0) < OFFER_ROTATE_EVERY_MIN * 60000 - 45000) return;   // لسه مجاش الميعاد
  }
  var lock = LockService.getScriptLock(); if (!lock.tryLock(10000)) return;
  var picks = [];
  try {
    var offers = offersArg || readOffers_(); if (!offers.length) return;
    var ss = ssOpen_(), sh = rotSheet_(ss), n = sh.getLastRow(), shown = {};
    (n >= 2 ? sh.getRange(2, 1, n - 1, 1).getDisplayValues() : []).forEach(function (r) { shown[r[0]] = 1; });
    var want = Math.max(1, Math.min(OFFER_ROTATE_COUNT, offers.length));
    var pool = shuffle_(offers.filter(function (p) { return !shown[offKeyOf_(p)]; }));
    picks = pool.slice(0, want);
    if (picks.length < want) {                       // الدورة خلصت: دورة جديدة من غير تكرار اللي لسه متعرض دلوقتي
      var cur = {}; picks.forEach(function (p) { cur[offKeyOf_(p)] = 1; });
      var rest = shuffle_(offers.filter(function (p) { return !cur[offKeyOf_(p)]; }));
      picks = picks.concat(rest.slice(0, want - picks.length));
      sh.getRange(2, 1, Math.max(n, 2), 1).clearContent();
      sh.getRange(2, 1, picks.length, 1).setNumberFormat("@").setValues(picks.map(function (p) { return [offKeyOf_(p)]; }));
    } else {
      rotMark_(picks.map(offKeyOf_));
    }
    props.setProperty("OFFER_ROT_LAST", String(now));
  } finally { try { lock.releaseLock(); } catch (x) {} }
  picks.forEach(function (p) { sendToAllCustomers_(OFFER_TITLE_, offerBody_(p), "offer_" + offKeyOf_(p), { type: "offer", id: p.id || "" }, p.imgs); });
}
// =====================================================================
// ===== رسائل الصيدلية: كل 3 ساعات على مدار اليوم (5 رسائل بتدور) =======
// =====================================================================
var BRAND_ON = true;                       // false = يقفل رسائل الصيدلية
var BRAND_EVERY_HOURS = 3;                 // الساعات 12 ص، 3، 6، 9، 12، 3، 6، 9 (8 مرات في اليوم) بتوقيت القاهرة
var BRAND_QUIET_FROM_HOUR = 23;            // من 11 بالليل لحد 9 الصبح بتتبعت على قناة هادية (من غير صوت) علشان متصحّيش حد
var BRAND_QUIET_TO_HOUR = 9;
var BRAND_CH_ = "ouf_brand_v2", BRAND_CH_QUIET_ = "ouf_brand_quiet_v2";   // لازم يطابقوا القنوات اللي التطبيق بيعملها
var BRAND_MSGS_ = [
  { t: "صيدلية عوف", b: "صحتك أولويتنا. اطلب دواءك من التطبيق ويوصلك لحد بيتك." },
  { t: "اختيارك الأفضل لدوائك", b: "في صيدلية عوف بنهتم بكل طلب، وبنختار لك الأفضل بجودة تثق فيها." },
  { t: "ثقتك تهمّنا", b: "نلتزم في صيدلية عوف بالأمانة والجودة في كل طلب، ونسعد بخدمتك." },
  { t: "صحتك في أيدٍ أمينة", b: "فريق صيدلية عوف جاهز لخدمتك. اطلب دواءك ومنتجات العناية بسهولة من التطبيق." },
  { t: "نهتم بصحتك وصحة أسرتك", b: "دواؤك ومنتجات عنايتك لحد باب بيتك من صيدلية عوف، وإحنا معاك في كل خطوة." }
];
function brandSend_(force) {
  var props = PropertiesService.getScriptProperties(), idx = Number(props.getProperty("BRAND_IDX") || 0) % BRAND_MSGS_.length;
  props.setProperty("BRAND_IDX", String((idx + 1) % BRAND_MSGS_.length));
  var h = Number(Utilities.formatDate(new Date(), TZ, "H")), quiet = (h >= BRAND_QUIET_FROM_HOUR || h < BRAND_QUIET_TO_HOUR), m = BRAND_MSGS_[idx];
  sendToAllCustomers_(m.t, m.b, "brand", { type: "brand" }, undefined, quiet ? BRAND_CH_QUIET_ : BRAND_CH_);
}
function brandTick_() {
  if (!BRAND_ON) return;
  var d = new Date(), h = Number(Utilities.formatDate(d, TZ, "H")), mi = Number(Utilities.formatDate(d, TZ, "m"));
  if (h % BRAND_EVERY_HOURS !== 0 || mi < 10 || mi > 45) return;                   // أول فحص بعد الدقيقة 10 من الساعة المحددة
  var props = PropertiesService.getScriptProperties(), slot = Utilities.formatDate(d, TZ, "yyyyMMddHH");
  if (props.getProperty("BRAND_SLOT") === slot) return;                              // اتبعتت في الساعة دي
  props.setProperty("BRAND_SLOT", slot);
  brandSend_();
}
function testBrandPush() { brandSend_(true); Logger.log("اتبعتت رسالة الصيدلية (شوف سجل الإشعارات)"); }

// اختبار: يبعت دورة دلوقتي بغض النظر عن الميعاد والساعة
function testRotateOffers() { rotateOffers_(null, true); Logger.log("اتبعتت دورة عروض (شوف سجل الإشعارات)"); }
function installOfferTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "checkNewOffers") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("checkNewOffers").timeBased().everyMinutes(5).create();
  checkNewOffers();
  Logger.log("✅ مشغّل العروض اشتغل (كل 5 دقايق)");
}
// اختبار: يبعت أول عرض موجود لكل العملاء الآن (للتأكد من شكل الإشعار وفتح العرض عند الضغط)
function testOfferPush() {
  var o = readOffers_(); if (!o.length) { Logger.log("مفيش أي عرض في الشيت"); return; }
  var p = o[0], note = sendToAllCustomers_(OFFER_TITLE_, offerBody_(p), "offer_test", { type: "offer", id: p.id || "" }, p.imgs);
  Logger.log("اتبعت:\n" + offerBody_p_(p) + "\n🖼 الصورة: " + note + (p.imgs && p.imgs.length ? "\nاللينك: " + p.imgs[0] : ""));
}
function offerBody_p_(p) { return offerBody_(p); }

// شغّلها مرة واحدة: بتضيف عمود "سعر عرض" بعد "سعر الشريط" في ورقتي الأدوية والعناية (لو مش موجود). بتقرا الأعمدة بالاسم فمفيش حاجة تانية بتتأثر.
function addOfferPriceColumn() {
  var ss = ssOpen_();
  OFFER_TABS.forEach(function (tab) {
    var sh = ss.getSheetByName(tab); if (!sh) { Logger.log("⚠️ مفيش ورقة اسمها " + tab); return; }
    var lc = sh.getLastColumn(), hr = 0, hdr = [];
    for (var r = 1; r <= Math.min(6, sh.getLastRow()); r++) { var v = sh.getRange(r, 1, 1, lc).getDisplayValues()[0]; if (v.some(function (x) { return arNorm_(x) === "سعر العلبه"; })) { hr = r; hdr = v; break; } }
    if (!hr) { Logger.log("⚠️ " + tab + ": ملقيتش صف العناوين"); return; }
    var norm = hdr.map(arNorm_);
    if (norm.indexOf("سعر عرض") >= 0 || norm.indexOf("سعر العرض") >= 0) { Logger.log("✔ " + tab + ": عمود سعر عرض موجود"); return; }
    var at = norm.indexOf("سعر الشريط"); if (at < 0) at = norm.indexOf("سعر العلبه");
    sh.insertColumnAfter(at + 1);
    sh.getRange(hr, at + 2).setValue("سعر عرض");
    try { sh.getRange(hr, at + 1).copyTo(sh.getRange(hr, at + 2), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false); } catch (e) {}
    Logger.log("✅ " + tab + ": اتضاف عمود سعر عرض في العمود " + (at + 2));
  });
}

// ===== اختبارات من المحرر =====
function testFirebase() {   // شغّلها مرة بعد ما تحط الـ Script properties، وشوف Execution log
  var t = fcmAccessToken_();
  Logger.log(t ? "✅ Firebase اتربط تمام (Access token اتولّد)" : "❌ راجع FIREBASE_CLIENT_EMAIL و FIREBASE_PRIVATE_KEY و FIREBASE_PROJECT_ID في Script properties");
  return !!t;
}
function testPushToAllRiders() {   // بتبعت إشعار تجريبي لكل طيار شغال وعنده توكن
  Logger.log(broadcastToRiders_("اختبار إشعارات 🔔", "لو وصلك ده يبقى الإشعارات شغالة", "test", { type: "test" }));
}


// شغّلها مرة واحدة من المحرر (Run): بتركّب "مشغّل التعديل" علشان اختيار الطيار وأرشفة الأوردر وتتبع الطيار السابق يشتغلوا لوحدهم
function installTriggers() {
  var ss = ssOpen_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "onEdit") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("onEdit").forSpreadsheet(ss).onEdit().create();
  Logger.log("✅ تم تركيب مشغّل التعديل");
}


// شغّلها مرة واحدة من محرر Apps Script (من غير ما تعيد setupSheets): بتحدّث قائمة الطيارين المتاحين في ورقة "الطيارين"
// وبتربطها بعمود "اسم الطيار المستلم" في ورقة "الطلبات"
function refreshPilotList() {
  var ss = ssOpen_(), pil = ss.getSheetByName(PIL_TAB), sh = ss.getSheetByName(ORD_TAB);
  if (!pil || !sh) return;
  pil.getRange(1, PIL_LIST_AVAIL).setValue("الطيارين المتاحين دلوقتي (تلقائي - لا تلمسه)");
  pil.getRange(2, PIL_LIST_AVAIL, Math.max(pil.getMaxRows() - 1, 1), 1).clearContent();
  pil.getRange(2, PIL_LIST_AVAIL).setFormula(PIL_AVAIL_FORMULA);
  var rows = Math.max(sh.getMaxRows() - 1, 1);
  var rule = SpreadsheetApp.newDataValidation().requireValueInRange(pil.getRange(2, PIL_LIST_AVAIL, Math.max(pil.getMaxRows() - 1, 1), 1), true).setAllowInvalid(false).build();
  sh.getRange(2, O.PNAME, rows, 1).setDataValidation(rule);
}

/**
 * نظام الطلبات والطيارين - صيدليات د/ مراد صادق (النسخة 2: مع تطبيق الطيار Murad-Farmacy-Rider)
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
var STORE_LOCATION = "";   // 👈 حط هنا لينك لوكيشن الصيدلية (اختياري)، هيتكتب في عمود "لوكيشن المحل" لكل أوردر

var SCRIPT_VERSION = "murad-rider-2026-11-13";
var DELIVERY_FEE = 0;               // سعر التوصيل (بيظهر في الفاتورة وبيتحسب كأرباح للطيار). 0 لحد ما نحدد طريقة الحساب
var MAX_ACTIVE = 3;                 // أقصى عدد طلبات ممكن الطيار الواحد يكون شايلها في نفس الوقت (غيّره لو عايز)
var FCM_CHANNEL = "murad_orders_v1"; // لازم يطابق قناة الإشعارات في تطبيق الطيار
var LOGIN_MAX_FAILS = 8;            // محاولات دخول غلط قبل القفل المؤقت (10 دقايق)
var VEHICLES = ["موتوسيكل", "عجلة كهربائية", "عجلة عادية", "سكوتر"];

// ترتيب أعمدة "الطلبات" (بالظبط زي ما طلبته)
var ORD_HEADERS = ["رقم", "رقم البون", "التاريخ واليوم", "الوقت", "اسم العميل", "رقم التليفون", "اسم العزبة / المنطقة", "الشارع / شارع كام",
  "علامة مميزة بجوار البيت", "لوكيشن العميل", "تفاصيل الأوردر", "لوكيشن المحل", "ملحوظة", "اجمالي حساب العميل", "تم قبول الاوردر",
  "اسم الطيار المستلم", "رقم الطيار المستلم", "الوصول الي المحل خلال", "جاري التجهيز", "جاري التوصيل", "الوصول الي العميل خلال",
  "تم التوصيل", "نتيجة الإشعار", "خطوات التنفيذ"];
var O = { NUM: 1, BON: 2, DATE: 3, TIME: 4, NAME: 5, PHONE: 6, AREA: 7, STREET: 8, LANDMARK: 9, CLOC: 10, DETAILS: 11, SLOC: 12, NOTE: 13, TOTAL: 14,
  ACCEPT: 15, PNAME: 16, PPHONE: 17, SHOP_ETA: 18, PREP: 19, DELIV: 20, CUST_ETA: 21, DONE: 22, NOTIF: 23, STEPS: 24 };
var O_CID = 25;    // عمود مخفي: معرّف الطلب (بيربط الطلب بالجهاز اللي عمله، ومنه بيتمنع التكرار وبيتحمي خصوصية العميل)
var A_AT = 26;     // في ورقة المكتملة: وقت الأرشفة

// ترتيب أعمدة "الطيارين"
var PIL_HEADERS = ["رقم", "اسم الطيار", "رقم الهاتف", "الباسورد", "العنوان", "رقم البطاقه", "تاريخ الميلاد", "السن الحالي", "المركبه",
  "حالة الطلب", "وقت وتارخ قبول الطلب", "حالة الطيار", "شيفت الطيار", "المحفظه", "توكن الإشعارات"];
var P = { NUM: 1, NAME: 2, PHONE: 3, PASS: 4, ADDR: 5, ID: 6, BIRTH: 7, AGE: 8, VEH: 9, REQ: 10, REQ_AT: 11, STATE: 12, SHIFT: 13, WALLET: 14, TOKEN: 15 };
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

function setupOrders_(ss) {
  var sh = ss.getSheetByName(ORD_TAB) || ss.insertSheet(ORD_TAB);
  sh.setRightToLeft(true);
  sh.getRange(1, 1, 1, ORD_HEADERS.length).setValues([ORD_HEADERS]);
  headerStyle_(sh.getRange(1, 1, 1, ORD_HEADERS.length));
  sh.getRange(1, O_CID).setValue("معرّف الطلب (لا تلمسه)").setFontColor("#9CA3AF");
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 44);
  sh.hideColumns(O_CID);
  var widths = [50, 80, 130, 80, 150, 120, 150, 170, 170, 150, 320, 150, 160, 120, 90, 150, 130, 130, 90, 90, 130, 90, 170, 200];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  var rows = Math.max(sh.getMaxRows() - 1, 1);
  [O.ACCEPT, O.PREP, O.DELIV, O.DONE].forEach(function (c) { sh.getRange(2, c, rows, 1).insertCheckboxes(); });
  sh.getRange(2, O.PHONE, rows, 1).setNumberFormat("@");
  sh.getRange(2, O.DETAILS, rows, 1).setWrap(true);
  // قائمة منسدلة لاسم الطيار من ورقة "الطيارين" (مع السماح بالكتابة اليدوية)
  var pil = ss.getSheetByName(PIL_TAB);
  if (pil) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInRange(pil.getRange("B2:B"), true).setAllowInvalid(true).build();
    sh.getRange(2, O.PNAME, rows, 1).setDataValidation(rule);
  }
}

function setupArchive_(ss) {
  var sh = ss.getSheetByName(ARC_TAB) || ss.insertSheet(ARC_TAB);
  sh.setRightToLeft(true);
  var h = ORD_HEADERS.concat(["معرّف الطلب", "وقت الأرشفة"]);
  sh.getRange(1, 1, 1, h.length).setValues([h]);
  headerStyle_(sh.getRange(1, 1, 1, h.length));
  sh.setFrozenRows(1);
  sh.hideColumns(O_CID);
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
var RIDER_WRITE = { pilotRegister: 1, riderAccept: 1, riderStage: 1, riderRelease: 1, riderEta: 1, riderShift: 1, riderToken: 1 };
function doPost(e) {
  var lock = null, locked = false;
  try {
    var d = JSON.parse(e.postData.contents), a = d.action;
    if (a === "pilotLogin") return out_(pilotLogin_(d));
    if (a === "riderOrders") return out_(riderOrders_(d));
    if (a !== "newOrder" && !RIDER_WRITE[a]) return out_({ ok: false, error: "action" });
    lock = LockService.getScriptLock(); lock.waitLock(20000); locked = true;
    if (a === "newOrder") return out_(newOrder_(d));
    if (a === "pilotRegister") return out_(pilotRegister_(d));
    if (a === "riderAccept") return out_(riderAccept_(d));
    if (a === "riderStage") return out_(riderStage_(d));
    if (a === "riderRelease") return out_(riderRelease_(d));
    if (a === "riderEta") return out_(riderEta_(d));
    if (a === "riderShift") return out_(riderShift_(d));
    if (a === "riderToken") return out_(riderToken_(d));
    return out_({ ok: false, error: "action" });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
  finally { if (locked) { try { lock.releaseLock(); } catch (x) {} } }
}
function ssOpen_() { return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

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
  var vals = [];
  vals[O.NUM - 1] = Math.max(last, 1);
  vals[O.BON - 1] = bon; vals[O.DATE - 1] = t.date; vals[O.TIME - 1] = t.time;
  vals[O.NAME - 1] = name; vals[O.PHONE - 1] = phone;
  vals[O.AREA - 1] = txt_(d.gov, 40); vals[O.STREET - 1] = txt_(d.addr, 250); vals[O.LANDMARK - 1] = txt_(d.landmark, 120);
  vals[O.CLOC - 1] = normLoc_(d.location); vals[O.DETAILS - 1] = items; vals[O.SLOC - 1] = STORE_LOCATION;
  vals[O.NOTE - 1] = txt_(d.notes, 300); vals[O.TOTAL - 1] = total;
  vals[O.ACCEPT - 1] = false; vals[O.PNAME - 1] = ""; vals[O.PPHONE - 1] = ""; vals[O.SHOP_ETA - 1] = "";
  vals[O.PREP - 1] = false; vals[O.DELIV - 1] = false; vals[O.CUST_ETA - 1] = ""; vals[O.DONE - 1] = false;
  vals[O.NOTIF - 1] = ""; vals[O.STEPS - 1] = ""; vals[O_CID - 1] = cid;
  var r = last + 1;
  if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 100);
  sh.getRange(r, 1, 1, vals.length).setValues([vals]);
  sh.getRange(r, O.PHONE).setNumberFormat("@").setValue(phone);
  [O.ACCEPT, O.PREP, O.DELIV, O.DONE].forEach(function (c) { sh.getRange(r, c).insertCheckboxes().setValue(false); });
  try { styleOrderRow_(sh, r); } catch (e) {}
  try { sh.getRange(r, O.NOTIF).setValue(broadcastToRiders_("#" + bon + " طلب جديد 📦", "في طلب جديد، افتح التطبيق واقبله قبل غيرك", "new_order_" + bon, { type: "new_order", bon: bon })); } catch (e) {}
  try { var lc = String(vals[O.CLOC - 1] || ""); if (lc) afterLocation_(ss, sh, r, phone, lc); } catch (e) {}   // فهم اللوكيشن (لينك مختصر ← إحداثيات) + حفظه في ورقة العملاء
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
    var n = (archived ? s.getLastRow() : dataLast_(s)) - 1, w = archived ? A_AT : O_CID;
    if (n < 1) return;
    var v = s.getRange(2, 1, n, w).getValues();
    for (var i = 0; i < v.length; i++) {
      var r = v[i], cid = String(r[O_CID - 1]);
      if (!want[cid]) continue;
      var st = "pending";
      if (archived || isTrue_(r[O.DONE - 1])) st = "completed";
      else if (isTrue_(r[O.DELIV - 1])) st = "delivering";
      else if (isTrue_(r[O.PREP - 1])) st = "preparing";
      else if (isTrue_(r[O.ACCEPT - 1])) st = "accepted";
      var at = archived && r[A_AT - 1] ? Utilities.formatDate(new Date(r[A_AT - 1]), TZ, "dd/MM/yyyy hh:mm a") : "";
      out.push({ cid: cid, bon: Number(r[O.BON - 1]) || 0, date: String(r[O.DATE - 1]), time: String(r[O.TIME - 1]), items: String(r[O.DETAILS - 1]),
        total: Number(r[O.TOTAL - 1]) || 0, status: st, pilotName: String(r[O.PNAME - 1] || ""), pilotPhone: String(r[O.PPHONE - 1] || "").replace(/'/g, ""),
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

function archiveOrder_(sh, r, atMs) {
  var ss = sh.getParent(), arc = ss.getSheetByName(ARC_TAB);
  if (!arc) { setupArchive_(ss); arc = ss.getSheetByName(ARC_TAB); }
  var row = sh.getRange(r, 1, 1, O_CID).getValues()[0];
  var now = Date.now(), at = Number(atMs);
  row.push(new Date(at > now - 3 * 864e5 && at <= now ? at : now));   // وقت التسليم الحقيقي عند الطيار (لو اتبعت متأخر بسبب النت)
  arc.appendRow(row);
  var ar = arc.getLastRow();
  arc.getRange(ar, O.PHONE).setNumberFormat("@").setValue(normPhone_(row[O.PHONE - 1]));
  arc.getRange(ar, O.PPHONE).setNumberFormat("@").setValue(normPhone_(row[O.PPHONE - 1]));
  sh.deleteRow(r);
}

// ===== تعديلات الشيت اليدوية (trigger تلقائي، مش محتاج تركيب) =====
function onEdit(e) {
  try {
    var rg = e.range, sh = rg.getSheet(), r = rg.getRow(), c = rg.getColumn(), nm = sh.getName();
    if (r < 2) return;
    if (nm === ORD_TAB) {
      if (c === O.DONE && isTrue_(rg.getValue())) { archiveOrder_(sh, r); return; }       // تم التوصيل: يتنقل لـ "الطلبات المكتملة"
      if (c === O.PNAME) {                                                                // اختيار اسم الطيار: رقمه يتكتب لوحده
        var pil = sh.getParent().getSheetByName(PIL_TAB), nmv = String(rg.getValue()).trim();
        if (pil && nmv && pil.getLastRow() >= 2) {
          var pv = pil.getRange(2, 1, pil.getLastRow() - 1, P.PHONE).getValues();
          for (var i = 0; i < pv.length; i++) if (String(pv[i][P.NAME - 1]).trim() === nmv) { sh.getRange(r, O.PPHONE).setNumberFormat("@").setValue(String(pv[i][P.PHONE - 1]).replace(/'/g, "")); break; }
        }
      }
      if (c === O.ACCEPT || c === O.PREP || c === O.DELIV) styleOrderRow_(sh, r);
    } else if (nm === PIL_TAB) {
      if (c === P.REQ && String(rg.getValue()).trim() === "مقبول" && !sh.getRange(r, P.REQ_AT).getValue()) {
        sh.getRange(r, P.REQ_AT).setValue(Utilities.formatDate(new Date(), TZ, "dd/MM/yyyy hh:mm a"));
      }
      if (c === P.REQ || c === P.STATE) stylePilotRow_(sh, r);
    }
  } catch (err) {}
}

// =====================================================================
// ===== نظام الطيارين (تطبيق Murad-Farmacy-Rider) =====================
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
function coordsFromText_(t) {
  t = String(t || "");
  try { t = decodeURIComponent(t); } catch (e) {}
  var m = t.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/) || t.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/) ||
    t.match(/[?&](?:q|ll|query|destination|center|daddr)=(-?\d{1,3}\.\d+)\s*[,،]\s*(-?\d{1,3}\.\d+)/) || t.match(/\/maps\/(?:place\/)?(-?\d{1,3}\.\d{3,}),(-?\d{1,3}\.\d{3,})/);
  if (!m) return null;
  var la = +m[1], lo = +m[2];
  return Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? { lat: la, lng: lo } : null;
}
function normLoc_(raw) { var s = txt_(raw, 400), u = s.match(/https?:\/\/[^\s]+/i); return u ? u[0].replace(/[)\].,،;]+$/, "") : s; }
// لينك مختصر (maps.app.goo.gl) ← بنمشي ورا التحويلات لحد ما نلاقي الإحداثيات
function resolveMapsLink_(u) {
  var cur = u;
  for (var i = 0; i < 5; i++) {
    var c = coordsFromText_(cur); if (c) return c;
    var r = UrlFetchApp.fetch(cur, { followRedirects: false, muteHttpExceptions: true, headers: { "User-Agent": "Mozilla/5.0" } });
    var code = r.getResponseCode(), h = r.getHeaders() || {}, loc = h["Location"] || h["location"];
    if (code >= 300 && code < 400 && loc) { cur = /^https?:/i.test(loc) ? loc : "https://www.google.com" + loc; continue; }
    var body = String(r.getContentText() || "").slice(0, 300000), cb = coordsFromText_(body); if (cb) return cb;
    var mm = body.match(/https?:\/\/(?:www\.)?google\.[a-z.]+\/maps[^"'<>\s\\]*/i);
    if (mm && mm[0].replace(/&amp;/g, "&") !== cur) { cur = mm[0].replace(/&amp;/g, "&"); continue; }
    break;
  }
  return null;
}
function updateCustomerLoc_(ss, phone, link) {
  var sh = ss.getSheetByName(CUST_TAB_); if (!sh) return;
  var n = sh.getLastRow(); if (n < 2) return;
  var v = sh.getRange(2, C_PHONE_, n - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) if (normPhone_(v[i][0]) === phone) { sh.getRange(i + 2, C_LOC_).setValue(link); return; }
}
function afterLocation_(ss, sh, r, phone, loc) {
  var link = loc, c = coordsFromText_(loc);
  if (!c && /^https?:/i.test(loc)) { try { c = resolveMapsLink_(loc); } catch (e) { c = null; } }
  if (c) { link = "https://www.google.com/maps?q=" + c.lat + "," + c.lng; sh.getRange(r, O.CLOC).setValue(link); }   // لينك بإحداثيات دقيقة (التطبيق بيحسب منه الوصول)
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
function rowVals_(sh, r) { return sh.getRange(r, 1, 1, O_CID).getValues()[0]; }
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
    total: Number(r[O.TOTAL - 1]) || 0, note: String(r[O.NOTE - 1] || "") };
  if (mine) {
    o.name = String(r[O.NAME - 1]); o.phone = normPhone_(r[O.PHONE - 1]); o.street = String(r[O.STREET - 1] || ""); o.landmark = String(r[O.LANDMARK - 1] || "");
    o.cloc = String(r[O.CLOC - 1] || ""); o.sloc = String(r[O.SLOC - 1] || ""); o.shopEta = String(r[O.SHOP_ETA - 1] || ""); o.custEta = String(r[O.CUST_ETA - 1] || "");
    o.stage = isTrue_(r[O.DELIV - 1]) ? "delivering" : (isTrue_(r[O.PREP - 1]) ? "preparing" : "accepted");
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
    var rg = sh.getRange(2, 1, last - 1, O_CID), v = rg.getValues(), dvs = rg.getDisplayValues();
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
      if (pp ? pp !== a.phone : String(q[O.PNAME - 1]).trim() !== myName) continue;
      var h = orderView_(q, true, adv[k]);
      h.name = String(q[O.NAME - 1]);
      h.doneAt = q[A_AT - 1] ? Utilities.formatDate(new Date(q[A_AT - 1]), TZ, "yyyy-MM-dd HH:mm") : "";
      hist.push(h);
    }
  }
  return { ok: true, status: "success", pilot: pilotInfo_(a), pool: pool, mine: mine, history: hist, store: STORE_LOCATION, serverTime: new Date().getTime(), deliveryFee: DELIVERY_FEE };
}

// ---- قبول طلب: الأسرع ياخده (بيتنفذ جوه القفل فمحدش يقدر يقبل نفس الطلب مرتين) ----
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
  sh.getRange(r, O.PNAME).setValue(String(a.v[P.NAME - 1]));
  sh.getRange(r, O.PPHONE).setNumberFormat("@").setValue(a.phone);
  try { styleOrderRow_(sh, r); } catch (e) {}
  var nv = rowVals_(sh, r);
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
  if (stage === "prepare") { if (!isTrue_(rv[O.PREP - 1])) sh.getRange(r, O.PREP).setValue(true); }
  else if (stage === "deliver") { if (!isTrue_(rv[O.PREP - 1])) sh.getRange(r, O.PREP).setValue(true); if (!isTrue_(rv[O.DELIV - 1])) sh.getRange(r, O.DELIV).setValue(true); }
  else {
    if (!isTrue_(rv[O.PREP - 1])) sh.getRange(r, O.PREP).setValue(true);
    if (!isTrue_(rv[O.DELIV - 1])) sh.getRange(r, O.DELIV).setValue(true);
    sh.getRange(r, O.DONE).setValue(true);
    archiveOrder_(sh, r, d.at);                 // بيتنقل لـ "الطلبات المكتملة" (التعديل من السكربت مبيشغّلش onEdit، فبنؤرشف هنا بإيدينا)
    return { ok: true, stage: "complete" };
  }
  try { styleOrderRow_(sh, r); } catch (e) {}
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
  sh.getRange(r, O.ACCEPT).setValue(false);
  sh.getRange(r, O.PNAME).setValue("");
  sh.getRange(r, O.PPHONE).setValue("");
  sh.getRange(r, O.SHOP_ETA).setValue("");
  sh.getRange(r, O.CUST_ETA).setValue("");
  try { styleOrderRow_(sh, r); } catch (e) {}
  try { sh.getRange(r, O.NOTIF).setValue(broadcastToRiders_("#" + d.bon + " رجع للقايمة 📦", "طيار اتنازل عن الطلب، اقبله لو فاضي", "new_order_" + d.bon, { type: "new_order", bon: d.bon }, a.phone)); } catch (e) {}
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

function riderToken_(d) {
  var a = authPilot_(d); if (a.code !== "ok") return authFail_(a);
  return { ok: saveToken_(a.sh, a.row, d.token) };
}

// =====================================================================
// ===== إشعارات Firebase (FCM HTTP v1) ================================
// =====================================================================

function fcmAccessToken_() {
  var cache = CacheService.getScriptCache(), c = cache.get("fcm_access_token");
  if (c) return c;
  var props = PropertiesService.getScriptProperties(), email = props.getProperty("FIREBASE_CLIENT_EMAIL"), key = props.getProperty("FIREBASE_PRIVATE_KEY");
  if (!email || !key) return null;
  key = key.replace(/\\n/g, "\n");
  var b64 = function (bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ""); };
  var now = Math.floor(Date.now() / 1000);
  var head = b64(Utilities.newBlob(JSON.stringify({ alg: "RS256", typ: "JWT" })).getBytes());
  var claim = b64(Utilities.newBlob(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now })).getBytes());
  var sig = b64(Utilities.computeRsaSha256Signature(head + "." + claim, key));
  var resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", { method: "post", contentType: "application/x-www-form-urlencoded", muteHttpExceptions: true,
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claim + "." + sig } });
  var j = {}; try { j = JSON.parse(resp.getContentText()); } catch (e) {}
  if (!j.access_token) { Logger.log("FCM auth error: " + resp.getContentText()); return null; }
  cache.put("fcm_access_token", j.access_token, 3300);
  return j.access_token;
}

function fcmBody_(token, title, body, tag, data) {
  var web = PropertiesService.getScriptProperties().getProperty("RIDER_WEB_URL") || "";
  var dd = {}; for (var k in (data || {})) dd[k] = String(data[k]);
  var m = { token: token, notification: { title: title, body: body }, data: dd,
    android: { priority: "HIGH", ttl: "300s", notification: { channelId: FCM_CHANNEL, sound: "default", tag: tag || "" } },
    webpush: { headers: { Urgency: "high", TTL: "300" }, notification: { tag: tag || "", requireInteraction: true } } };
  if (/^https:\/\//.test(web)) { m.webpush.fcm_options = { link: web }; m.webpush.notification.icon = web.replace(/\/?$/, "/") + "assets/icons/icon-192.png"; }
  return { message: m };
}

// بيبعت لمجموعة طيارين بالتوازي. items: [{token,row}] ← بيرجّع {sent, failed, err}
function fcmSendMany_(items, title, body, tag, data) {
  var pid = PropertiesService.getScriptProperties().getProperty("FIREBASE_PROJECT_ID"), at = fcmAccessToken_();
  if (!pid || !at) return { sent: 0, failed: items.length, err: "Firebase مش مضبوط" };
  var url = "https://fcm.googleapis.com/v1/projects/" + pid + "/messages:send";
  var reqs = items.map(function (it) {
    return { url: url, method: "post", contentType: "application/json", headers: { Authorization: "Bearer " + at }, muteHttpExceptions: true, payload: JSON.stringify(fcmBody_(it.token, title, body, tag, data)) };
  });
  var sent = 0, failed = 0, err = "", rs = reqs.length ? UrlFetchApp.fetchAll(reqs) : [];
  for (var i = 0; i < rs.length; i++) {
    var c = rs[i].getResponseCode();
    if (c >= 200 && c < 300) sent++;
    else {
      failed++; err = "FCM " + c;
      if (c === 404 && items[i].sh && items[i].row) { try { items[i].sh.getRange(items[i].row, P.TOKEN).setValue(""); } catch (e) {} }   // التوكن مات (التطبيق اتمسح)
      else Logger.log("FCM error " + c + ": " + rs[i].getContentText());
    }
  }
  return { sent: sent, failed: failed, err: err };
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

// ===== اختبارات من المحرر =====
function testFirebase() {   // شغّلها مرة بعد ما تحط الـ Script properties، وشوف Execution log
  var t = fcmAccessToken_();
  Logger.log(t ? "✅ Firebase اتربط تمام (Access token اتولّد)" : "❌ راجع FIREBASE_CLIENT_EMAIL و FIREBASE_PRIVATE_KEY و FIREBASE_PROJECT_ID في Script properties");
  return !!t;
}
function testPushToAllRiders() {   // بتبعت إشعار تجريبي لكل طيار شغال وعنده توكن
  Logger.log(broadcastToRiders_("اختبار إشعارات 🔔", "لو وصلك ده يبقى الإشعارات شغالة", "test", { type: "test" }));
}

/**
 * سكربت تسجيل العملاء - صيدليات د/ مراد صادق
 * بيستقبل بيانات العميل من التطبيق (الاسم الرباعي + الموبايل + العنوان) ويكتبها في ورقة "العملاء".
 * لو العميل مسجل قبل كده (نفس رقم الموبايل) بيحدّث صفه بدل ما يكرره.
 *
 * التركيب: شوف قسم "تسجيل العملاء" في README.md
 */

// نفس شيت المشروع (شيت المنتجات)، وهيكتب في ورقة "العملاء" اللي جواه.
var SPREADSHEET_ID = "199-5mWgHEsepqmA8b5CmONGD8sBGctxKyoKBeFN-Otk";
var TAB_NAME = "العملاء";
// ترتيب الأعمدة (ثابت بالمكان): 1 الرقم | 2 اسم العميل | 3 رقم الهاتف | 4 العنوان بالتفصيل | 5 لوكيشن العميل | 6 التعاملات | 7 حالة العميل | 8 حالة البرنامج
var HEADERS = ["الرقم", "اسم العميل", "رقم الهاتف", "العنوان بالتفصيل", "لوكيشن العميل", "التعاملات", "حالة العميل", "حالة البرنامج", "معرّف الجهاز"];
var C_NUM = 1, C_NAME = 2, C_PHONE = 3, C_ADDR = 4, C_LOC = 5, C_DEALS = 6, C_STATUS = 7, C_PROG = 8, C_DEV = 9;   // عمود 9 "معرّف الجهاز": بيتملي تلقائي، وبيمنع المحظور يفتح حساب جديد من نفس الجهاز
// القيم الافتراضية للعميل الجديد بس (العميل القديم مبنلمسش التعاملات ولا الحالات بتاعته)
var DEF_DEALS = 0, DEF_STATUS = "جيد", DEF_PROG = "يعمل";

// GET: بدون باراميتر = فحص إن السكربت شغال. ?action=status&phone=01xxxxxxxxx = بيرجّع حالة العميل وحالة البرنامج من الشيت
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === "status") return out_(status_(p.phone, p.device));
    if (p.action === "myOrders") return out_(myOrders_(p.ids));
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
  return out_({ ok: true, service: "murad-customers" });
}

// القيمة اللي في عمودي "حالة العميل" و"حالة البرنامج" (التطبيق هو اللي بيفسّرها: موقوف = حظر، حذف = إلغاء تثبيت)
function status_(rawPhone, rawDev) {
  var phone = normPhone_(rawPhone), dev = cleanDev_(rawDev);
  var okPhone = /^01[0125]\d{8}$/.test(phone);
  if (!okPhone && !dev) return { ok: false, error: "invalid" };
  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = getTab_(ss);
  var out = { ok: true, found: false, devBan: false };
  var row = okPhone ? findRow_(sh, phone) : 0;
  if (row) {
    var v = sh.getRange(row, C_STATUS, 1, 2).getValues()[0];
    out.found = true;
    out.status = String(v[0] == null ? "" : v[0]).trim();
    out.prog = String(v[1] == null ? "" : v[1]).trim();
    // عميل قديم معندوش معرّف جهاز: بنسجله أول ما يفتح التطبيق
    if (dev && !String(sh.getRange(row, C_DEV).getValue()).trim()) {
      var lock = LockService.getScriptLock();
      try { if (lock.tryLock(3000)) { ensureDevHeader_(sh); sh.getRange(row, C_DEV).setValue(dev); lock.releaseLock(); } } catch (x) {}
    }
  }
  if (dev) out.devBan = deviceBanned_(sh, dev);   // أي حساب محظور على نفس الجهاز = الجهاز كله محظور
  return out;
}

// معرّف الجهاز: حروف وأرقام وشرطات بس، لحد 64 حرف
function cleanDev_(v) { return String(v == null ? "" : v).replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 64); }

function isBanWord_(s) {
  var t = String(s == null ? "" : s).replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();
  return /موقوف|محظور|حظر|ايقاف|بلوك|block|ban/.test(t);
}

// هل في أي صف "حالة العميل" بتاعه موقوف ومعرّف الجهاز بتاعه هو نفسه؟
function deviceBanned_(sh, dev) {
  var n = sh.getLastRow();
  if (n < 2 || !dev) return false;
  var vals = sh.getRange(2, C_STATUS, n - 1, C_DEV - C_STATUS + 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][C_DEV - C_STATUS]).trim() === dev && isBanWord_(vals[i][0])) return true;
  }
  return false;
}

// عنوان العمود التاسع بنفس شكل باقي العناوين (لو مش موجود)
function ensureDevHeader_(sh) {
  if (String(sh.getRange(1, C_DEV).getValue()).trim()) return;
  sh.getRange(1, C_PROG).copyTo(sh.getRange(1, C_DEV), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sh.getRange(1, C_DEV).setValue(HEADERS[C_DEV - 1]);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (d.action === "newOrder") return out_(newOrder_(d));
    if (d.action !== "saveCustomer") return out_({ ok: false, error: "action" });
    return out_(saveCustomer_(d));
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function saveCustomer_(d) {
  // ===== تحقق من جهة السيرفر (نفس شروط التطبيق) =====
  var name = String(d.name || "").replace(/[\u064B-\u0652\u0640]/g, "").replace(/[^A-Za-z\u0621-\u063A\u0641-\u064A\s]/g, "").replace(/\s+/g, " ").trim();
  var phone = normPhone_(d.phone), oldPhone = d.oldPhone ? normPhone_(d.oldPhone) : "";
  var gov = String(d.gov || "").replace(/\s+/g, " ").trim();
  var detail = String(d.addr || "").replace(/\s+/g, " ").trim();
  var landmark = String(d.landmark || "").replace(/\s+/g, " ").trim();
  var dev = cleanDev_(d.device);
  if (nameParts_(name) < 4 || !/^01[0125]\d{8}$/.test(phone) || detail.length < 12 || detail.length > 250 || gov.length > 40 || landmark.length > 120) {
    return { ok: false, error: "invalid" };
  }
  // العنوان في خلية واحدة: كل حاجة في سطر لوحدها تحت بعض (المحافظة / العنوان بالتفصيل / العلامة المميزة)
  var lines = [];
  if (gov) lines.push("المحافظة: " + gov);
  lines.push("العنوان: " + detail);
  if (landmark) lines.push("علامة مميزة: " + landmark);
  var addr = lines.join("\n");

  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = getTab_(ss);
  if (sh.getLastRow() === 0) {                 // ورقة فاضية: نكتب العناوين (لو انت كاتبها بنسيبها زي ما هي)
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  }

  var row = findRow_(sh, oldPhone && oldPhone !== phone ? oldPhone : phone);
  if (!row && oldPhone && oldPhone !== phone) row = findRow_(sh, phone);

  if (row) {                                   // عميل موجود: تحديث بياناته بس (الرقم والحالات بتفضل زي ما هي)
    sh.getRange(row, C_NAME).setValue(name);
    sh.getRange(row, C_PHONE).setNumberFormat("@").setValue(phone);
    sh.getRange(row, C_ADDR).setValue(addr).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP).setVerticalAlignment("middle");
    if (dev && !String(sh.getRange(row, C_DEV).getValue()).trim()) { ensureDevHeader_(sh); sh.getRange(row, C_DEV).setValue(dev); }
    return { ok: true, updated: true };
  }
  row = Math.max(sh.getLastRow(), 1) + 1;      // عميل جديد
  sh.getRange(row, C_NUM).setValue(nextNumber_(sh));
  sh.getRange(row, C_NAME).setValue(name);
  sh.getRange(row, C_PHONE).setNumberFormat("@").setValue(phone);
  sh.getRange(row, C_ADDR).setValue(addr).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP).setVerticalAlignment("middle");
  sh.getRange(row, C_DEALS).setValue(DEF_DEALS);          // التعاملات: 0 (مبنلعبش فيها بعد كده)
  // لو الجهاز ده عليه حساب محظور: الحساب الجديد بيتسجل "موقوف" على طول (عشان ميتخطاش الحظر باسم ورقم تاني)
  sh.getRange(row, C_STATUS).setValue(dev && deviceBanned_(sh, dev) ? "موقوف" : DEF_STATUS);   // حالة العميل: جيد
  sh.getRange(row, C_PROG).setValue(DEF_PROG);            // حالة البرنامج: يعمل
  if (dev) { ensureDevHeader_(sh); sh.getRange(row, C_DEV).setValue(dev); }
  sh.getRange(row, 1, 1, HEADERS.length).setVerticalAlignment("middle");
  SpreadsheetApp.flush();
  return { ok: true, created: true };
}

// ===== أدوات =====
// بيدور على ورقة "العملاء" حتى لو فيها مسافة زيادة أو اختلاف بسيط في الكتابة (ا/أ، ة/ه)
function getTab_(ss) {
  var sh = ss.getSheetByName(TAB_NAME);
  if (sh) return sh;
  var want = tabKey_(TAB_NAME), all = ss.getSheets();
  for (var i = 0; i < all.length; i++) if (tabKey_(all[i].getName()) === want) return all[i];
  return ss.insertSheet(TAB_NAME);
}
function tabKey_(n) { return String(n).replace(/\s+/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي"); }

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function nameParts_(n) {
  var w = String(n).split(" ").filter(Boolean), c = 0;
  for (var i = 0; i < w.length; i++) { if (w[i] === "عبد" && i + 1 < w.length) i++; c++; }
  return c;
}

// بيحوّل الأرقام العربي لإنجليزي، ولو الشيت شال الصفر من الأول (10xxxxxxxx) بيرجّعه
function normPhone_(v) {
  var s = String(v == null ? "" : v)
    .replace(/[\u0660-\u0669]/g, function (x) { return x.charCodeAt(0) - 0x0660; })
    .replace(/\D/g, "");
  if (s.length === 12 && s.indexOf("20") === 0) s = s.slice(2);   // +20 في الأول
  if (s.length === 10 && s.charAt(0) === "1") s = "0" + s;
  return s;
}

// الرقم التالي في عمود "رقم" (آخر رقم + 1)
function nextNumber_(sh) {
  var n = sh.getLastRow();
  if (n < 2) return 1;
  var max = 0, vals = sh.getRange(2, C_NUM, n - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) { var v = Number(vals[i][0]); if (v > max) max = v; }
  return max + 1;
}

function findRow_(sh, phone) {
  var n = sh.getLastRow();
  if (n < 2 || !phone) return 0;
  var vals = sh.getRange(2, C_PHONE, n - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (normPhone_(vals[i][0]) === phone) return i + 2;
  return 0;
}

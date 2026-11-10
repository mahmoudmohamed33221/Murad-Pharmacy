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
// ترتيب الأعمدة (ثابت بالمكان): 1 رقم | 2 اسم العميل | 3 رقم تليفون العميل | 4 العنوان بالتفصيل | 5 لوكيشن العميل | 6 حالة العميل | 7 حالة البرنامج للعميل
var HEADERS = ["رقم", "اسم العميل", "رقم تليفون العميل", "العنوان بالتفصيل", "لوكيشن العميل", "حالة العميل", "حالة البرنامج للعميل"];
var C_NUM = 1, C_NAME = 2, C_PHONE = 3, C_ADDR = 4;   // لوكيشن وحالة العميل وحالة البرنامج: فاضيين لحد ما نحدد شغلهم

function doGet() { return out_({ ok: true, service: "murad-customers" }); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
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
  var addr = String(d.addr || "").replace(/\s+/g, " ").trim();
  if (nameParts_(name) < 4 || !/^01[0125]\d{8}$/.test(phone) || addr.length < 12 || addr.length > 250) {
    return { ok: false, error: "invalid" };
  }

  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_NAME) || ss.insertSheet(TAB_NAME);
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
    sh.getRange(row, C_ADDR).setValue(addr);
    return { ok: true, updated: true };
  }
  row = Math.max(sh.getLastRow(), 1) + 1;      // عميل جديد
  sh.getRange(row, C_NUM).setValue(nextNumber_(sh));
  sh.getRange(row, C_NAME).setValue(name);
  sh.getRange(row, C_PHONE).setNumberFormat("@").setValue(phone);
  sh.getRange(row, C_ADDR).setValue(addr);
  return { ok: true, created: true };
}

// ===== أدوات =====
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

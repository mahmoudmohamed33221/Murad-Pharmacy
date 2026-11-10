/**
 * نظام الطلبات والطيارين - صيدليات د/ مراد صادق
 * ده مشروع Apps Script لوحده (مستقل عن سكربت العملاء). الصقه كله في ملف الكود بتاع مشروع "اوردارس" ثم Deploy كـ Web app.
 *
 * بيعمل:
 *  - setupSheets(): تشغّلها مرة واحدة، بتجهّز ورقة "الطلبات" وورقة "الطيارين" وورقة "الطلبات المكتملة" بنفس الأعمدة بالظبط.
 *  - استقبال أوردر جديد من التطبيق (newOrder) وكتابته في ورقة "الطلبات".
 *  - إرجاع حالة طلبات العميل لصفحة "مشترياتي" (myOrders).
 *  - onEdit: تلوين الصف حسب الحالة، وأرشفة الأوردر أول ما تعلّم "تم التوصيل".
 */

var SPREADSHEET_ID = "199-5mWgHEsepqmA8b5CmONGD8sBGctxKyoKBeFN-Otk";   // نفس شيت الصيدلية
var ORD_TAB = "الطلبات";
var ARC_TAB = "الطلبات المكتملة";
var PIL_TAB = "الطيارين";
var TZ = "Africa/Cairo";
var STORE_LOCATION = "";   // 👈 حط هنا لينك لوكيشن الصيدلية (اختياري)، هيتكتب في عمود "لوكيشن المحل" لكل أوردر

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
  [P.PHONE, P.ID].forEach(function (c) { sh.getRange(2, c, rows, 1).setNumberFormat("@"); });
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
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet(e) {
  try { var p = (e && e.parameter) || {}; if (p.action === "myOrders") return out_(myOrders_(p.ids)); return out_({ ok: true, service: "orders" }); }
  catch (err) { return out_({ ok: false, error: String(err) }); }
}
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse(e.postData.contents);
    if (d.action === "newOrder") return out_(newOrder_(d));
    return out_({ ok: false, error: "action" });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
  finally { try { lock.releaseLock(); } catch (x) {} }
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
  vals[O.CLOC - 1] = txt_(d.location, 300); vals[O.DETAILS - 1] = items; vals[O.SLOC - 1] = STORE_LOCATION;
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

function archiveOrder_(sh, r) {
  var ss = sh.getParent(), arc = ss.getSheetByName(ARC_TAB);
  if (!arc) { setupArchive_(ss); arc = ss.getSheetByName(ARC_TAB); }
  var row = sh.getRange(r, 1, 1, O_CID).getValues()[0];
  row.push(new Date());
  arc.appendRow(row);
  arc.getRange(arc.getLastRow(), O.PHONE).setNumberFormat("@").setValue(String(row[O.PHONE - 1]).replace(/'/g, ""));
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
      if (c === P.REQ || c === P.STATE) {
        var rq = String(sh.getRange(r, P.REQ).getValue()).trim(), stt = String(sh.getRange(r, P.STATE).getValue()).trim();
        var bg = "#111827", fg = "#F3F4F6";
        if (stt === "موقوف نهائي") { bg = "#FF1744"; fg = "#000000"; }
        else if (rq === "منتظر") { bg = "#FFEB3B"; fg = "#000000"; }
        else if (rq === "مرفوض") { bg = "#7A1212"; fg = "#FFFFFF"; }
        else if (rq) { bg = "#FFFFFF"; fg = "#000000"; }
        sh.getRange(r, 1, 1, PIL_HEADERS.length).setBackground(bg).setFontColor(fg);
      }
    }
  } catch (err) {}
}

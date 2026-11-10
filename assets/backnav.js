// زرار الرجوع (بتاع الموبايل / النافيجيشن بار):
//  - جوه التطبيق: بيرجّع خطوة لورا (قسم -> الرئيسية، نافذة السلة -> بتتقفل...)
//  - لو مفيش حاجة قبله (الرئيسية): بيطلع رسالة "هل تريد الخروج؟" (نعم / لا)
// الفكرة: كل تنقل بيتسجّل في history، وعلى الأندرويد بنستخدم plugin @capacitor/app عشان نتحكم في الرجوع والخروج.
(function () {
  if (!window.history || !history.pushState) return;
  var _show = window.show, _openCat = window.openCat, _openSheet = window.openSheet, _close = window.close;
  if (!_show || !_openCat || !_openSheet || !_close) return;      // لو الأسماء اتغيرت منكسرش حاجة

  var ov = document.getElementById("ov");
  var dlg = document.getElementById("exitDlg");
  var TABS = { search: 1, orders: 1, account: 1, settings: 1 };
  var HOME = { d: 0, v: "home" };
  var popping = false, exiting = false;
  var shown = function () { return ov.classList.contains("show"); };
  var st = function () {
    var s = history.state;
    return (s && typeof s.d === "number") ? s : HOME;
  };
  var onGuard = function () { return !!(history.state && history.state.x); };
  var say = function (m) { if (typeof window.toast === "function") window.toast(m); };
  var App = null;
  try { App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; } catch (e) {}

  // أساس التاريخ: [حارس] ثم [الرئيسية]
  var s0 = history.state;
  if (s0 && (s0.x || typeof s0.d === "number")) {                  // الصفحة اتعمل لها ريلود: الحارس موجود أصلًا
    if (s0.x) history.pushState(HOME, ""); else if (s0.d !== 0 || s0.ov) history.replaceState(HOME, "");
  } else {                                                         // أول فتح
    history.replaceState({ x: 1 }, "");
    history.pushState(HOME, "");
  }
  var leaveGuard = function () { if (onGuard()) history.pushState(HOME, ""); };

  // ===== رسالة الخروج =====
  var dlgOpen = function () { return dlg && !dlg.hidden; };
  function openDlg() {
    if (!dlg || dlgOpen()) return;
    dlg.hidden = false;
    requestAnimationFrame(function () { dlg.classList.add("on"); });
  }
  function closeDlg() {
    if (!dlg || !dlgOpen()) return;
    dlg.classList.remove("on");
    setTimeout(function () { dlg.hidden = true; }, 200);
  }
  function doExit() {
    if (App && App.exitApp) { App.exitApp(); return; }              // أندرويد (plugin)
    closeDlg(); exiting = true;                                      // متصفح / نسخة قديمة من غير plugin
    history.back();
    setTimeout(function () { if (!document.hidden) say("اضغط رجوع مرة أخرى للخروج"); }, 450);
  }
  if (dlg) {
    document.getElementById("xdYes").onclick = doExit;
    document.getElementById("xdNo").onclick = closeDlg;
    dlg.addEventListener("click", function (e) { if (e.target === dlg) closeDlg(); });
  }

  // ===== التنقل =====
  // التبويبات + الرئيسية
  window.show = function (v) {
    if (popping) return _show(v);
    if (v !== "home") leaveGuard();
    var s = st();
    if (v === "home") {
      if (s.d > 0) {                                                 // رجوع للأساس: نلغي كل الخطوات اللي فاتت
        if (shown()) _close();
        _show("home");
        history.go(-s.d);
        return;
      }
      return _show("home");
    }
    if (TABS[v]) {
      _show(v);
      if (s.ov) return;
      if (s.d === 0) history.pushState({ d: 1, v: v }, "");          // من الرئيسية لتبويب: خطوة جديدة
      else history.replaceState({ d: 1, v: v }, "");                 // من تبويب/قسم لتبويب: نفس العمق (الرجوع يوديك للرئيسية)
      return;
    }
    return _show(v);                                                 // "cat" بيتسجّل في openCat
  };

  // صفحة القسم
  window.openCat = function (c) {
    if (popping) return _openCat(c);
    leaveGuard();
    var s = st();
    _openCat(c);
    if (s.ov) return;
    var ns = { d: 1, v: "cat", c: c };
    if (s.d === 0) history.pushState(ns, ""); else history.replaceState(ns, "");
  };

  // السلة / إتمام الطلب / تفاصيل المنتج
  window.openSheet = function (v) {
    _openSheet(v);
    if (popping) return;
    leaveGuard();
    var s = st();
    if (!s.ov) history.pushState({ d: s.d + 1, v: s.v, c: s.c, ov: 1 }, "");
  };
  window.close = function () {
    var was = shown();
    _close();
    if (was && st().ov) history.back();
  };

  // خطوة لورا (بنستخدمها في الأندرويد مع الـ plugin)
  function goBackOneStep() {
    if (dlgOpen()) { closeDlg(); return; }
    if (shown()) { window.close(); return; }
    var s = st();
    if (s.d > 0) { history.back(); return; }
    openDlg();                                                       // الرئيسية ومفيش قبلها حاجة: نسأل المستخدم
  }

  // ===== الرجوع من التاريخ (متصفح / PWA / أندرويد من غير plugin) =====
  window.addEventListener("popstate", function (e) {
    var s = e.state || HOME;
    if (s.x) {                                                       // وصلنا للحارس: يعني ضغط رجوع وهو على الرئيسية
      if (exiting) { history.back(); return; }
      if (dlgOpen()) closeDlg(); else openDlg();
      history.pushState(HOME, "");                                   // نفضل على الرئيسية والرسالة ظاهرة
      return;
    }
    if (s.ov) return;
    popping = true;
    try {
      if (shown()) _close();
      if (document.body.dataset.view !== s.v) {
        if (s.v === "cat" && s.c) _openCat(s.c); else _show(s.v);
      }
    } finally { popping = false; }
  });

  // أندرويد + plugin: بنمسك زرار الرجوع بنفسنا
  if (App && App.addListener) {
    try { App.addListener("backButton", goBackOneStep); } catch (e) {}
  }

  // سهم الرجوع اللي جوه صفحة القسم
  var cb = document.getElementById("cback");
  if (cb) cb.onclick = function () {
    var s = st();
    if (s.v === "cat" && s.d > 0 && !s.ov) history.back(); else window.show("home");
  };
})();

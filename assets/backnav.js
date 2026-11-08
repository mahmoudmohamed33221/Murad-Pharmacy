// زرار الرجوع (بتاع الموبايل / النافيجيشن بار) يرجّع خطوة لورا جوه التطبيق بدل ما يقفله.
// الفكرة: كل تنقل (قسم / تبويب / السلة والنوافذ) بيتسجّل في history، والأندرويد (Capacitor) بيرجع بيه تلقائي.
(function () {
  if (!window.history || !history.pushState) return;
  var _show = window.show, _openCat = window.openCat, _openSheet = window.openSheet, _close = window.close;
  if (!_show || !_openCat || !_openSheet || !_close) return;      // لو الأسماء اتغيرت منكسرش حاجة

  var ov = document.getElementById("ov");
  var TABS = { search: 1, account: 1, settings: 1 };
  var popping = false;
  var shown = function () { return ov.classList.contains("show"); };
  var st = function () {
    var s = history.state;
    return (s && typeof s.d === "number") ? s : HOME;
  };
  // حارس الخروج: [E] ثم [الرئيسية]. الرجوع من الرئيسية بيوصل لـ E فنطلّع رسالة بدل ما نقفل.
  var HOME = { d: 0, v: "home" }, EXIT_PRESSES = 3, WINDOW_MS = 4000;
  var s0 = history.state;
  if (s0 && (s0.x || typeof s0.d === "number")) {                  // الصفحة اتعمل لها ريلود: الحارس موجود أصلًا
    if (s0.x) history.pushState(HOME, ""); else if (s0.d !== 0 || s0.ov) history.replaceState(HOME, "");
  } else {                                                         // أول فتح
    history.replaceState({ x: 1 }, "");
    history.pushState(HOME, "");
  }
  var hits = 0, hitTimer = null;
  var onGuard = function () { return !!(history.state && history.state.x); };
  var leaveGuard = function () {                                   // لو المستخدم اتنقل وهو على E نرجّع الرئيسية كأساس
    if (onGuard()) history.pushState(HOME, "");
    hits = 0; clearTimeout(hitTimer);
  };
  var say = function (m) { if (typeof window.toast === "function") window.toast(m); };

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

  // زرار الرجوع نفسه
  window.addEventListener("popstate", function (e) {
    var s = e.state || HOME;
    if (s.x) {                                                     // ضغط رجوع وهو على الرئيسية
      hits++;
      clearTimeout(hitTimer);
      var left = EXIT_PRESSES - hits;                              // الضغطات اللي فاضلة للخروج
      if (left > 0) {
        say(left === 2 ? "اضغط رجوع مرتين للخروج من التطبيق" : "اضغط رجوع مرة أخرى للخروج");
        if (hits === 1) history.pushState(HOME, "");               // أول ضغطة: نرجّع الرئيسية عشان الضغطة الجاية تيجي لـ E تاني
        hitTimer = setTimeout(function () { leaveGuard(); }, WINDOW_MS);   // لو سابها: يتصفّر العدّاد
      }
      return;                                                      // الضغطة الأخيرة بتبقى على E نفسها فبتخرج فعلًا
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

  // سهم الرجوع اللي جوه صفحة القسم
  var cb = document.getElementById("cback");
  if (cb) cb.onclick = function () {
    var s = st();
    if (s.v === "cat" && s.d > 0 && !s.ov) history.back(); else window.show("home");
  };
})();

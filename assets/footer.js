// أرقام التواصل في الفوتر. لتغيير أي رقم عدّل هنا (بصيغة دولية من غير +).
// ولو حابب تتحكم فيها من config.js ضيف CONSULT_PHONE و SUPPORT_PHONE هناك وهتتقرأ تلقائي.
(function () {
  var C = window.APP_CONFIG || {};
  var CONSULT = C.CONSULT_PHONE || C.PHARMACY_PHONE || "201508800926";   // استشاري الصيدلية (واتساب)
  var LANDLINE = C.PHARMACY_LANDLINE || "20224534828";   // التليفون الأرضي للصيدلية (زرار الاتصال)
  var SUPPORT = C.SUPPORT_PHONE || "201067735647";   // الدعم الفني للتطبيق (مش بيتكتب على الشاشة)

  function set(id, href) { var a = document.getElementById(id); if (a) a.href = href; }
  var wa = function (n, t) { return "https://wa.me/" + n + "?text=" + encodeURIComponent(t); };

  set("ftConsultWa", wa(CONSULT, "السلام عليكم، محتاج استشارة من الصيدلية"));
  set("ftConsultTel", "tel:+" + LANDLINE);
  set("ftSupportWa", wa(SUPPORT, "السلام عليكم، محتاج دعم فني بخصوص التطبيق"));
  set("ftSupportTel", "tel:+" + SUPPORT);
})();

// علامة تحميل على أي لينك اتصال / واتساب لحد ما التطبيق يفتح (أو بعد 6 ثواني لو ماحصلش حاجة)
(function () {
  var SEL = 'a[href^="tel:"],a[href*="wa.me"],a[href^="whatsapp:"],a[href*="api.whatsapp.com"]';
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest(SEL);
    if (!a || a.classList.contains("is-busy")) return;
    a.classList.add("is-busy");
    var t = 0;
    var done = function () { a.classList.remove("is-busy"); document.removeEventListener("visibilitychange", vis); clearTimeout(t); };
    var vis = function () { if (document.hidden) setTimeout(done, 700); };
    document.addEventListener("visibilitychange", vis);
    t = setTimeout(done, 6000);
  }, true);
})();

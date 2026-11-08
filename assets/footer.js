// أرقام التواصل في الفوتر. لتغيير أي رقم عدّل هنا (بصيغة دولية من غير +).
// ولو حابب تتحكم فيها من config.js ضيف CONSULT_PHONE و SUPPORT_PHONE هناك وهتتقرأ تلقائي.
(function () {
  var C = window.APP_CONFIG || {};
  var CONSULT = C.CONSULT_PHONE || "201200000001";   // استشاري الصيدلية (مؤقت لحد ما يتغير)
  var SUPPORT = C.SUPPORT_PHONE || "201067735647";   // الدعم الفني للتطبيق (مش بيتكتب على الشاشة)

  function set(id, href) { var a = document.getElementById(id); if (a) a.href = href; }
  var wa = function (n, t) { return "https://wa.me/" + n + "?text=" + encodeURIComponent(t); };

  set("ftConsultWa", wa(CONSULT, "السلام عليكم، محتاج استشارة من الصيدلية"));
  set("ftConsultTel", "tel:+" + CONSULT);
  set("ftSupportWa", wa(SUPPORT, "السلام عليكم، محتاج دعم فني بخصوص التطبيق"));
  set("ftSupportTel", "tel:+" + SUPPORT);
})();

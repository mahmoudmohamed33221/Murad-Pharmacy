// انترو التطبيق (بعد شاشة اللوجو الأصلية بتاعة الأندرويد). بيشتغل مرة واحدة في كل فتحة للتطبيق.
(function () {
  var el = document.getElementById("intro");
  if (!el) return;
  var body = document.body;

  // لو الصفحة اتعمل لها ريلود جوه نفس الجلسة (زي تحديث التطبيق) منعرضش الانترو تاني
  try {
    if (sessionStorage.getItem("introShown")) { el.remove(); return; }
    sessionStorage.setItem("introShown", "1");
  } catch (e) {}

  body.classList.add("intro-lock");
  var TAG = "صحتك أمانة عندنا";
  var timers = [], finished = false;
  var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };

  function finish() {
    if (finished) return; finished = true;
    timers.forEach(clearTimeout);
    el.classList.remove("typing");
    el.classList.add("out");                 // انتقال ناعم (fade + blur + تكبير خفيف)
    body.classList.remove("intro-lock");
    body.classList.add("intro-done");        // دخول التطبيق
    setTimeout(function () { el.remove(); body.classList.remove("intro-done"); }, 2300);
  }

  // الكتابة بتتحسب بالوقت جوه requestAnimationFrame => ناعمة ومتزامنة مع 60 فريم في الثانية
  var CHAR_MS = 65;   // سرعة الحرف (أسرع من قبل)
  function type() {
    var box = document.getElementById("introTag"), t0 = null, last = 0;
    el.classList.add("typing");
    function frame(ts) {
      if (finished) return;
      if (t0 === null) t0 = ts;
      var n = Math.min(TAG.length, Math.floor((ts - t0) / CHAR_MS) + 1);
      if (n !== last) { last = n; box.textContent = TAG.slice(0, n); }
      if (n < TAG.length) requestAnimationFrame(frame);
      else later(function () { el.classList.remove("typing"); }, 500);
    }
    requestAnimationFrame(frame);
  }

  // الجدول الزمني
  later(function () { el.classList.add("s1"); }, 100);    // اللوجو فيد بطيء
  later(function () { el.classList.add("s2"); }, 1000);   // اسم الصيدليات فيد فوق اللوجو (قبل ما اللوجو يخلص)
  later(type, 3000);                                      // كتابة "صحتك أمانة عندنا"
  later(finish, 5600);                                    // انتقال للتطبيق

  el.addEventListener("click", finish);                   // اللمس بيتخطى الانترو
})();

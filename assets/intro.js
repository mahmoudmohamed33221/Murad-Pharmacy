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
  var TAG = "صحتك تهمنا";
  var timers = [], finished = false;
  var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };

  function finish() {
    if (finished) return; finished = true;
    timers.forEach(clearTimeout);
    el.classList.remove("typing");
    el.classList.add("out");                 // انتقال ناعم (fade + blur + تكبير خفيف)
    body.classList.remove("intro-lock");
    body.classList.add("intro-done");        // دخول التطبيق
    setTimeout(function () { el.remove(); body.classList.remove("intro-done"); }, 1000);
  }

  function type() {
    var box = document.getElementById("introTag"), i = 0;
    el.classList.add("typing");
    (function step() {
      if (finished) return;
      i++; box.textContent = TAG.slice(0, i);
      if (i < TAG.length) later(step, 115);
      else later(function () { el.classList.remove("typing"); }, 500);
    })();
  }

  // الجدول الزمني
  later(function () { el.classList.add("s1"); }, 150);    // اللوجو يظهر تدريجيًا لحد 30%
  later(function () { el.classList.add("s2"); }, 2000);   // اسم الصيدليات
  later(type, 3300);                                      // كتابة "صحتك تهمنا"
  later(finish, 5700);                                    // انتقال للتطبيق

  el.addEventListener("click", finish);                   // اللمس بيتخطى الانترو
})();

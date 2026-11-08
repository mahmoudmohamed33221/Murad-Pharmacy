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
  var L1 = "جودة تثق بها", L2 = "وعناية تستحقها";
  var timers = [], finished = false;
  var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };

  function finish() {
    if (finished) return; finished = true;
    timers.forEach(clearTimeout);
    el.classList.add("out");                 // انتقال ناعم (fade + blur + تكبير خفيف)
    body.classList.remove("intro-lock");
    body.classList.add("intro-done");        // دخول التطبيق
    setTimeout(function () { el.remove(); body.classList.remove("intro-done"); }, 3500);
  }

  // الكتابة بتتحسب بالوقت جوه requestAnimationFrame => ناعمة ومتزامنة مع 60 فريم في الثانية
  var CHAR_MS = 65;    // سرعة الحرف
  var PAUSE = 4;       // وقفة صغيرة (بعدد حروف) بين السطرين
  var GAP = 380;       // وقفة بين كتابة الاسم وكتابة السطرين
  function type() {
    var title = el.querySelector(".ititle"), line = el.querySelector(".iline"),
        box = document.getElementById("introTag"), t0 = null, last1 = -1, last2 = -1;
    var TITLE = title.textContent.trim();
    title.innerHTML = '<span class="gh"></span><span class="tw cur"></span>';
    var gh = title.children[0], tw = title.children[1];
    gh.textContent = TITLE;
    line.style.width = gh.offsetWidth + "px";                 // الشريط بعرض الاسم بالظبط
    box.innerHTML = '<span class="l l1"></span><span class="l l2"></span>';
    var a = box.children[0], b = box.children[1];
    var tTitle = TITLE.length * CHAR_MS, tStart2 = tTitle + GAP;
    var total2 = L1.length + PAUSE + L2.length;

    function frame(ts) {
      if (finished) return;
      if (t0 === null) t0 = ts;
      var el_ms = ts - t0;

      // 1) الاسم + الشريط بيتملي بالتوازي معاه
      var p = Math.min(1, el_ms / tTitle);
      line.style.transform = "scaleX(" + p + ")";
      var n1 = Math.min(TITLE.length, Math.floor(el_ms / CHAR_MS) + 1);
      if (n1 !== last1) { last1 = n1; tw.textContent = TITLE.slice(0, n1); }
      if (n1 >= TITLE.length) tw.classList.remove("cur");

      // 2) بعدها السطرين
      var e2 = el_ms - tStart2, done = false;
      if (e2 >= 0) {
        var n = Math.min(total2, Math.floor(e2 / CHAR_MS) + 1);
        if (n !== last2) {
          last2 = n;
          a.textContent = L1.slice(0, Math.min(n, L1.length));
          b.textContent = n > L1.length + PAUSE ? L2.slice(0, n - L1.length - PAUSE) : "";
          var onFirst = n <= L1.length + PAUSE;
          a.classList.toggle("cur", onFirst); b.classList.toggle("cur", !onFirst);
        }
        done = n >= total2;
      }
      if (!done) requestAnimationFrame(frame);
      else later(function () { b.classList.remove("cur"); }, 600);
    }
    requestAnimationFrame(frame);
  }

  // الجدول الزمني
  later(function () { el.classList.add("s1"); }, 100);    // اللوجو فيد بطيء
  later(type, 1000);                                      // كتابة الاسم + الشريط، وبعدها السطرين
  later(finish, 6600);                                    // انتقال للتطبيق

  el.addEventListener("click", finish);                   // اللمس بيتخطى الانترو
})();

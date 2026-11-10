// تسجيل العميل (أول فتح للتطبيق): الاسم الرباعي + رقم الموبايل + العنوان.
// - الشاشة بتظهر مرة واحدة بس، وبعد الحفظ بيتخزن في الجهاز (mrad_profile) وبيتبعت لورقة "العملاء" في الشيت.
// - نفس شروط التحقق بتتطبق في: شاشة التسجيل، صفحة "حسابي"، وبيانات الطلب (عن طريق window.MuradReg).
(function () {
  "use strict";
  var KEY = "mrad_profile", PEND = "mrad_sync_pending", DONE = "mrad_synced";

  // ===== تخزين آمن =====
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function readJSON(k) { try { var v = JSON.parse(lsGet(k) || "null"); return v && typeof v === "object" ? v : null; } catch (e) { return null; } }
  function getProfile() { var p = readJSON(KEY); return { name: (p && p.name) || "", phone: (p && p.phone) || "", addr: (p && p.addr) || "" }; }

  // ===== أدوات التنضيف =====
  function latinDigits(s) {
    return String(s == null ? "" : s)
      .replace(/[\u0660-\u0669]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return d.charCodeAt(0) - 0x06F0; });
  }
  function digits(s) { return latinDigits(s).replace(/\D/g, ""); }
  // حروف عربي/إنجليزي ومسافات بس (بدون أرقام ولا رموز ولا تشكيل ولا تطويل)
  function cleanName(s) {
    return String(s == null ? "" : s).replace(/[\u064B-\u0652\u0640]/g, "")
      .replace(/[^A-Za-z\u0621-\u063A\u0641-\u064A\s]/g, "").replace(/\s+/g, " ").trim();
  }
  function cleanAddr(s) { return latinDigits(s).replace(/\s+/g, " ").trim(); }

  // "عبد" + الاسم اللي بعدها بيتحسبوا اسم واحد (عبد الله، عبد الرحمن...)
  function nameParts(n) {
    var w = cleanName(n).split(" ").filter(Boolean), out = [];
    for (var i = 0; i < w.length; i++) {
      if (w[i] === "عبد" && i + 1 < w.length) { out.push(w[i] + " " + w[i + 1]); i++; } else out.push(w[i]);
    }
    return out;
  }

  // ===== شروط التحقق (بترجّع رسالة الخطأ، أو "" لو سليم) =====
  function errName(v) {
    var c = cleanName(v);
    if (!c) return "اكتب اسمك الرباعي";
    var p = nameParts(c);
    if (p.length < 4) return "الاسم لازم يكون رباعي (4 أسماء)، انت كاتب " + (["", "اسم واحد", "اسمين", "3 أسماء"][p.length]);
    if (p.length > 6) return "الاسم طويل زيادة، اكتب اسمك الرباعي بس";
    for (var i = 0; i < p.length; i++) {
      var len = p[i].replace(/\s/g, "").length;
      if (len < (i === 0 ? 2 : 3)) return "في اسم قصير (" + p[i] + ")، اتأكد إنه مكتوب كامل";
      if (/(.)\1{2,}/.test(p[i])) return "الاسم فيه حروف مكررة غير منطقية، راجعه";
    }
    if (p.every(function (x) { return x === p[0]; })) return "اكتب اسمك الحقيقي";
    return "";
  }
  function errPhone(v) {
    var d = digits(v);
    if (!d) return "اكتب رقم الموبايل";
    if (!/^0(1([0125]\d*)?)?$/.test(d)) return "الرقم لازم يبدأ بـ 010 أو 011 أو 012 أو 015";
    if (d.length !== 11) return "الرقم لازم يكون 11 رقم (كاتب " + d.length + ")";
    if (/^01[0125](\d)\1{7}$/.test(d)) return "الرقم غير صحيح، راجعه تاني";
    return "";
  }
  function errConfirm(v, phone) {
    var d = digits(v);
    if (!d) return "أعد كتابة الرقم للتأكيد";
    if (d !== digits(phone)) return "الرقمين مش متطابقين";
    return "";
  }
  function errAddr(v) {
    var c = cleanAddr(v);
    if (!c) return "اكتب عنوانك";
    var letters = (c.match(/[A-Za-z\u0621-\u064A]/g) || []).length;
    var words = c.split(" ").filter(Boolean).length;
    if (letters < 5) return "العنوان لازم يكون كلمات واضحة، مش أرقام أو رموز بس";
    if (c.length < 12 || words < 3) return "العنوان قصير، اكتب المنطقة واسم أو رقم الشارع وعلامة مميزة جنب بيتك";
    if (c.length > 250) return "العنوان طويل زيادة، اختصره شوية";
    if (/([A-Za-z\u0621-\u064A])\1{3,}/.test(c)) return "العنوان فيه حروف مكررة غير منطقية، راجعه";
    return "";
  }
  function isValid(p) { return !errName(p.name) && !errPhone(p.phone) && !errAddr(p.addr); }

  // ===== منع الأرقام والرموز أثناء الكتابة (في كل خانات الاسم والموبايل في التطبيق) =====
  var NAME_IDS = { "rg-name": 1, an: 1, fn: 1 }, PHONE_IDS = { "rg-phone": 1, "rg-phone2": 1, ap: 1, fp: 1 };
  document.addEventListener("input", function (e) {
    var el = e.target; if (!el || !el.id) return;
    var v = el.value, n = v;
    if (NAME_IDS[el.id]) {
      n = v.replace(/[\u064B-\u0652\u0640]/g, "").replace(/[^A-Za-z\u0621-\u063A\u0641-\u064A\s]/g, "")
        .replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, 60);
    } else if (PHONE_IDS[el.id]) {
      n = digits(v).slice(0, 11);
    }
    if (n !== v) el.value = n;
  }, true);

  // ===== المزامنة مع ورقة "العملاء" (Google Apps Script) =====
  var syncing = false;
  function readPend() { return readJSON(PEND); }
  function queueSync(p, oldPhone) {
    var pend = readPend();
    var base = pend ? (pend.oldPhone || "") : (oldPhone || "");   // الصف اللي لسه موجود في الشيت (لو الرقم اتغير)
    lsSet(PEND, JSON.stringify({ action: "saveCustomer", name: p.name, phone: p.phone, addr: p.addr,
      oldPhone: base && base !== p.phone ? base : "" }));
  }
  function flush() {
    var url = (window.APP_CONFIG || {}).CUSTOMERS_URL, pend = readPend();
    if (!url || !pend || syncing) return;
    syncing = true;
    fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(pend), redirect: "follow" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) { lsDel(PEND); lsSet(DONE, "1"); }
        else if (j && j.error === "invalid") lsDel(PEND);          // السيرفر رفض البيانات: مفيش فايدة من إعادة المحاولة
      })
      .catch(function () { /* مفيش نت: هنحاول تاني في أول فتحة أو لما النت يرجع */ })
      .then(function () { syncing = false; });
  }
  window.addEventListener("online", flush);
  window.addEventListener("load", function () {
    // عملاء قدام (قبل التسجيل ده) بياناتهم سليمة: نبعتهم للشيت مرة واحدة
    var p = getProfile();
    if (isValid(p) && !lsGet(DONE) && !readPend()) queueSync(p, "");
    flush();
  });

  // حفظ بيانات العميل (من التسجيل / حسابي / الطلب) + إرسالها للشيت لو اتغيرت
  function saveProfile(p) {
    var prev = getProfile();
    var prof = { name: cleanName(p.name), phone: digits(p.phone), addr: cleanAddr(p.addr) };
    lsSet(KEY, JSON.stringify(prof));
    var changed = prof.name !== prev.name || prof.phone !== prev.phone || prof.addr !== prev.addr;
    if (changed || !lsGet(DONE)) { queueSync(prof, prev.phone && prev.phone !== prof.phone ? prev.phone : ""); flush(); }
    return prof;
  }

  // ===== شاشة التسجيل =====
  var root = document.getElementById("reg"), built = false, touched = {}, els = {};
  var HINT = {
    name: "اكتب اسمك رباعي زي ما في البطاقة",
    phone: "رقم موبايل مصري من 11 رقم",
    phone2: "أعد كتابة نفس الرقم للتأكيد",
    addr: "المنطقة + اسم أو رقم الشارع + علامة مميزة جنب بيتك"
  };
  var IC = '<svg class="rg-ic y" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M7.8 12.5l3 3 5.6-6.2"/></svg>' +
           '<svg class="rg-ic n" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';
  function fieldHTML(key, label, ctrl) {
    return '<div class="rg-field" id="rgf-' + key + '"><label for="rg-' + key + '">' + label + ' <i>*</i></label>' +
      '<div class="rg-box">' + ctrl + IC + '</div><div class="rg-msg" id="rgm-' + key + '"></div></div>';
  }
  function build() {
    if (built || !root) return; built = true;
    root.innerHTML =
      '<div class="rg-wrap">' +
        '<div class="rg-head"><img class="rg-logo" src="assets/logo.png" alt="">' +
          '<h1 id="rgT">أهلاً بيك في صيدليات د/ مراد صادق</h1>' +
          '<p>سجّل بياناتك مرة واحدة بس، وهنحفظها علشان طلباتك توصلك أسرع وأسهل.</p><div class="rg-gold"></div></div>' +
        '<div class="rg-card">' +
          fieldHTML("name", "الاسم الرباعي", '<input id="rg-name" type="text" autocomplete="name" placeholder="مثال: محمد أحمد علي حسن" maxlength="60">') +
          fieldHTML("phone", "رقم الموبايل", '<input id="rg-phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01xxxxxxxxx" maxlength="11">') +
          fieldHTML("phone2", "تأكيد رقم الموبايل", '<input id="rg-phone2" type="tel" inputmode="numeric" autocomplete="off" placeholder="أعد كتابة الرقم" maxlength="11">') +
          fieldHTML("addr", "العنوان", '<textarea id="rg-addr" rows="3" autocomplete="street-address" placeholder="مثال: الشرقية - الزقازيق - شارع الجمهورية - عمارة 5 - بجوار مسجد الرحمن" maxlength="250"></textarea>') +
          '<button class="rg-go" id="rg-go" type="button" disabled>حفظ والدخول للتطبيق</button>' +
        '</div>' +
        '<p class="rg-note">بياناتك بنستخدمها لتجهيز وتوصيل طلباتك بس، وتقدر تعدّلها في أي وقت من صفحة "حسابي".</p>' +
      '</div>';
    ["name", "phone", "phone2", "addr"].forEach(function (k) {
      els[k] = { wrap: document.getElementById("rgf-" + k), input: document.getElementById("rg-" + k), msg: document.getElementById("rgm-" + k) };
    });
    ["name", "phone", "phone2", "addr"].forEach(function (k) {
      els[k].input.addEventListener("input", function () {
        if (k === "phone" && touched.phone2) paint("phone2");
        paint(k); refreshBtn();
      });
      els[k].input.addEventListener("blur", function () { touched[k] = true; paint(k); });
    });
    document.getElementById("rg-go").onclick = submit;
  }
  function errOf(k) {
    var v = els[k].input.value;
    return k === "name" ? errName(v) : k === "phone" ? errPhone(v) : k === "phone2" ? errConfirm(v, els.phone.input.value) : errAddr(v);
  }
  function paint(k) {
    var w = els[k].wrap, e = errOf(k);
    w.classList.remove("ok", "bad");
    if (touched[k]) { w.classList.add(e ? "bad" : "ok"); els[k].msg.textContent = e || ""; }
    else els[k].msg.textContent = HINT[k];
    if (touched[k] && !e) els[k].msg.textContent = "";
  }
  function allOk() { return ["name", "phone", "phone2", "addr"].every(function (k) { return !errOf(k); }); }
  function refreshBtn() { var b = document.getElementById("rg-go"); if (b) b.disabled = !allOk(); }

  function submit() {
    var firstBad = null;
    ["name", "phone", "phone2", "addr"].forEach(function (k) { touched[k] = true; paint(k); if (!firstBad && errOf(k)) firstBad = k; });
    if (firstBad) { els[firstBad].input.focus(); return; }
    var prof = saveProfile({ name: els.name.input.value, phone: els.phone.input.value, addr: els.addr.input.value });
    closeReg();
    if (document.body.dataset.view === "account" && typeof window.accountView === "function") window.accountView();
    var first = nameParts(prof.name)[0] || "";
    setTimeout(function () { if (typeof window.toast === "function") window.toast("أهلاً بيك يا " + first + " 👋"); }, 350);
  }
  function openReg() {
    if (!root) return;
    build();
    var p = getProfile();
    touched = {};
    els.name.input.value = cleanName(p.name); els.phone.input.value = digits(p.phone).slice(0, 11);
    els.phone2.input.value = ""; els.addr.input.value = cleanAddr(p.addr);
    // بيانات قديمة ناقصة/غلط: نوريله إيه المطلوب تعديله علطول
    if (els.name.input.value) touched.name = true;
    if (els.phone.input.value) touched.phone = true;
    if (els.addr.input.value) touched.addr = true;
    ["name", "phone", "phone2", "addr"].forEach(paint);
    refreshBtn();
    document.documentElement.classList.add("need-reg");
    root.scrollTop = 0;
  }
  function closeReg() { document.documentElement.classList.remove("need-reg"); }
  // بيتنده عليها أول ما التطبيق يفتح، وبعد "مسح بياناتي"
  function check() { if (isValid(getProfile())) closeReg(); else openReg(); }

  window.MuradReg = {
    errName: errName, errPhone: errPhone, errAddr: errAddr,
    cleanName: cleanName, cleanAddr: cleanAddr, digits: digits,
    isValid: isValid, saveProfile: saveProfile, check: check
  };
  check();
})();

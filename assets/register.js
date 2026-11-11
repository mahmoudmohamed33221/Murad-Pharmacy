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
  function getProfile() { var p = readJSON(KEY); return { name: (p && p.name) || "", phone: (p && p.phone) || "", gov: (p && p.gov) || "", addr: (p && p.addr) || "", landmark: (p && p.landmark) || "" }; }

  // ===== المحافظات =====
  var GOVS = ["القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الشرقية", "الدقهلية", "الغربية", "المنوفية", "كفر الشيخ", "البحيرة",
    "دمياط", "بورسعيد", "الإسماعيلية", "السويس", "شمال سيناء", "جنوب سيناء", "الفيوم", "بني سويف", "المنيا", "أسيوط",
    "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح"];

  var GOV_GROUPS = [
    ["القاهرة الكبرى", ["القاهرة", "الجيزة", "القليوبية"]],
    ["الإسكندرية والساحل", ["الإسكندرية", "البحيرة", "مطروح"]],
    ["الدلتا", ["الشرقية", "الدقهلية", "الغربية", "المنوفية", "كفر الشيخ", "دمياط"]],
    ["القناة وسيناء", ["بورسعيد", "الإسماعيلية", "السويس", "شمال سيناء", "جنوب سيناء"]],
    ["الصعيد", ["الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان"]],
    ["البحر الأحمر والوادي الجديد", ["البحر الأحمر", "الوادي الجديد"]]
  ];
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>';
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var gvEl = null, curForm = null;
  function govSheet() {
    if (gvEl) return gvEl;
    gvEl = document.createElement("div"); gvEl.id = "gvSheet"; gvEl.hidden = true;
    gvEl.setAttribute("role", "dialog"); gvEl.setAttribute("aria-modal", "true");
    gvEl.innerHTML = '<div class="gv-card"><div class="gv-h"><b>اختار المحافظة</b><button type="button" class="gv-x" aria-label="إغلاق">✕</button></div>' +
      '<div class="gv-s"><input type="search" id="gvQ" placeholder="ابحث عن محافظتك" autocomplete="off"></div><div class="gv-body" id="gvBody"></div></div>';
    document.body.appendChild(gvEl);
    gvEl.addEventListener("click", function (e) {
      if (e.target === gvEl || e.target.closest(".gv-x")) { closeGov(); return; }
      var b = e.target.closest("[data-g]"); if (b) pickGov(b.getAttribute("data-g"));
    });
    gvEl.querySelector("#gvQ").addEventListener("input", function () { paintGov(this.value); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !gvEl.hidden) closeGov(); });
    return gvEl;
  }
  function normAr(s) { return String(s || "").replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim(); }
  function paintGov(q) {
    var cur = curForm ? curForm.els.gov.input.value : "", nq = normAr(q), html = "";
    GOV_GROUPS.forEach(function (g) {
      var items = g[1].filter(function (n) { return !nq || normAr(n).indexOf(nq) >= 0; });
      if (!items.length) return;
      html += '<div class="gv-g"><h4>' + g[0] + '</h4><div class="gv-grid">' + items.map(function (n) {
        return '<button type="button" class="gv-i' + (n === cur ? " on" : "") + '" data-g="' + n + '"><span>' + n + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>';
      }).join("") + '</div></div>';
    });
    gvEl.querySelector("#gvBody").innerHTML = html || '<div class="gv-none">مفيش محافظة بالاسم ده</div>';
  }
  function openGov(F) {
    curForm = F;
    govSheet(); gvEl.querySelector("#gvQ").value = ""; paintGov("");
    gvEl.hidden = false; requestAnimationFrame(function () { gvEl.classList.add("on"); });
    var on = gvEl.querySelector(".gv-i.on"); if (on) setTimeout(function () { on.scrollIntoView({ block: "center" }); }, 60);
  }
  function closeGov() {
    if (!gvEl || gvEl.hidden) return;
    gvEl.classList.remove("on"); setTimeout(function () { gvEl.hidden = true; }, 200);
    if (curForm) { curForm.touched.gov = true; curForm.paint("gov"); }
  }
  function pickGov(v) {
    var F = curForm; if (!F) return;
    F.setGov(v); F.els.gov.input.dispatchEvent(new Event("change"));
    gvEl.classList.remove("on"); setTimeout(function () { gvEl.hidden = true; }, 200);
    F.touched.gov = true; F.paint("gov");
  }

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
  function errGov(v) { return GOVS.indexOf(String(v || "")) < 0 ? "اختار المحافظة من القائمة" : ""; }
  function cleanLandmark(s) { return latinDigits(s).replace(/\s+/g, " ").trim(); }
  function errLandmark(v) {
    var c = cleanLandmark(v);
    if (!c) return "اكتب علامة مميزة قريبة من بيتك";
    if ((c.match(/[A-Za-z\u0621-\u064A]/g) || []).length < 3) return "العلامة المميزة لازم تكون كلمات واضحة (مثال: بجوار مسجد الرحمن)";
    if (c.length > 120) return "العلامة المميزة طويلة زيادة، اختصرها شوية";
    if (/([A-Za-z\u0621-\u064A])\1{3,}/.test(c)) return "فيها حروف مكررة غير منطقية، راجعها";
    return "";
  }
  function isValid(p) { return !errName(p.name) && !errPhone(p.phone) && !errGov(p.gov) && !errAddr(p.addr) && !errLandmark(p.landmark); }

  // ===== منع الأرقام والرموز أثناء الكتابة (في كل خانات الاسم والموبايل في التطبيق) =====
  var NAME_IDS = { "rg-name": 1, an: 1, fn: 1 }, PHONE_IDS = { "rg-phone": 1, "rg-phone2": 1, ap: 1, fp: 1 };
  document.addEventListener("input", function (e) {
    var el = e.target; if (!el) return;
    var rk = el.getAttribute && el.getAttribute("data-rk");
    if (!el.id && !rk) return;
    var v = el.value, n = v;
    if (NAME_IDS[el.id] || rk === "name") {
      n = v.replace(/[\u064B-\u0652\u0640]/g, "").replace(/[^A-Za-z\u0621-\u063A\u0641-\u064A\s]/g, "")
        .replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, 60);
    } else if (PHONE_IDS[el.id] || rk === "phone" || rk === "phone2") {
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
    lsSet(PEND, JSON.stringify({ action: "saveCustomer", name: p.name, phone: p.phone, gov: p.gov || "", addr: p.addr, landmark: p.landmark || "",
      device: (window.MuradGuard && window.MuradGuard.device && window.MuradGuard.device()) || "",
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
    // المحافظة والعلامة المميزة: لو الصفحة اللي بتحفظ مبعتتهمش (حسابي / الطلب) بنسيبهم زي ما هم
    var prof = { name: cleanName(p.name), phone: digits(p.phone), gov: p.gov !== undefined ? String(p.gov) : prev.gov,
      addr: cleanAddr(p.addr), landmark: p.landmark !== undefined ? cleanLandmark(p.landmark) : prev.landmark };
    lsSet(KEY, JSON.stringify(prof));
    var changed = prof.name !== prev.name || prof.phone !== prev.phone || prof.gov !== prev.gov || prof.addr !== prev.addr || prof.landmark !== prev.landmark;
    if (changed || !lsGet(DONE)) { queueSync(prof, prev.phone && prev.phone !== prof.phone ? prev.phone : ""); flush(); }
    return prof;
  }

  // ===== نموذج البيانات (بيتستخدم في: التسجيل / حسابي / تأكيد الطلب) =====
  var HINT = {
    name: "اكتب اسمك رباعي زي ما في البطاقة",
    phone: "رقم موبايل مصري من 11 رقم",
    phone2: "أعد كتابة نفس الرقم للتأكيد",
    gov: "اختار المحافظة اللي ساكن فيها",
    addr: "المركز / المنطقة + اسم أو رقم الشارع + رقم العمارة والشقة",
    landmark: "حاجة معروفة قريبة منك تساعد المندوب يوصلك (مسجد، صيدلية، محل...)"
  };
  var IC = '<svg class="rg-ic y" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M7.8 12.5l3 3 5.6-6.2"/></svg>' +
           '<svg class="rg-ic n" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';
  function mountForm(host, pfx, opts) {
    opts = opts || {};
    var keys = opts.confirm ? ["name", "phone", "phone2", "gov", "addr", "landmark"] : ["name", "phone", "gov", "addr", "landmark"];
    var F = { els: {}, touched: {}, keys: keys, onChange: opts.onChange || null };
    function fh(key, label, ctrl) {
      return '<div class="rg-field" id="' + pfx + 'f-' + key + '"><label for="' + pfx + '-' + key + '">' + label + ' <i>*</i></label>' +
        '<div class="rg-box">' + ctrl + IC + '</div><div class="rg-msg" id="' + pfx + 'm-' + key + '"></div></div>';
    }
    var html = fh("name", "الاسم الرباعي", '<input id="' + pfx + '-name" data-rk="name" type="text" autocomplete="name" placeholder="مثال: محمد أحمد علي حسن" maxlength="60">') +
      fh("phone", "رقم الموبايل", '<input id="' + pfx + '-phone" data-rk="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01xxxxxxxxx" maxlength="11">') +
      (opts.confirm ? fh("phone2", "تأكيد رقم الموبايل", '<input id="' + pfx + '-phone2" data-rk="phone2" type="tel" inputmode="numeric" autocomplete="off" placeholder="أعد كتابة الرقم" maxlength="11">') : "") +
      fh("gov", "المحافظة", '<input type="hidden" id="' + pfx + '-gov"><button type="button" class="rg-pick" id="' + pfx + '-govbtn" aria-haspopup="dialog"><span class="gv-pin">' + PIN + '</span><span class="gv-t">اختار المحافظة</span><span class="gv-chev">' + CHEV + '</span></button>') +
      fh("addr", "العنوان بالتفصيل", '<textarea id="' + pfx + '-addr" rows="3" autocomplete="street-address" placeholder="مثال: الزقازيق - شارع الجمهورية - عمارة 5 - الدور الثالث - شقة 8" maxlength="250"></textarea>') +
      fh("landmark", "علامة مميزة", '<input id="' + pfx + '-landmark" type="text" autocomplete="off" placeholder="مثال: بجوار مسجد الرحمن" maxlength="120">');
    host.innerHTML = html;
    keys.forEach(function (k) {
      F.els[k] = { wrap: document.getElementById(pfx + "f-" + k), input: document.getElementById(pfx + "-" + k), msg: document.getElementById(pfx + "m-" + k) };
    });
    F.errOf = function (k) {
      var v = F.els[k].input.value;
      return k === "name" ? errName(v) : k === "phone" ? errPhone(v) : k === "phone2" ? errConfirm(v, F.els.phone.input.value) : k === "gov" ? errGov(v) : k === "landmark" ? errLandmark(v) : errAddr(v);
    };
    F.paint = function (k) {
      var w = F.els[k].wrap, e = F.errOf(k);
      w.classList.remove("ok", "bad");
      if (F.touched[k]) { w.classList.add(e ? "bad" : "ok"); F.els[k].msg.textContent = e || ""; }
      else F.els[k].msg.textContent = HINT[k];
      if (F.touched[k] && !e) F.els[k].msg.textContent = "";
    };
    F.allOk = function () { return keys.every(function (k) { return !F.errOf(k); }); };
    F.setGov = function (v) {
      F.els.gov.input.value = v || "";
      var b = document.getElementById(pfx + "-govbtn");
      if (b) { b.querySelector(".gv-t").textContent = v || "اختار المحافظة"; b.classList.toggle("has", !!v); }
    };
    F.set = function (p) {
      F.touched = {};
      F.els.name.input.value = cleanName(p.name); F.els.phone.input.value = digits(p.phone).slice(0, 11);
      if (F.els.phone2) F.els.phone2.input.value = "";
      F.els.addr.input.value = cleanAddr(p.addr); F.setGov(GOVS.indexOf(p.gov) >= 0 ? p.gov : "");
      F.els.landmark.input.value = cleanLandmark(p.landmark);
      ["name", "phone", "addr", "gov", "landmark"].forEach(function (k) { if (F.els[k].input.value) F.touched[k] = true; });   // نوريه الناقص علطول
      keys.forEach(F.paint);
      if (F.onChange) F.onChange();
    };
    F.get = function () {
      return { name: cleanName(F.els.name.input.value), phone: digits(F.els.phone.input.value), gov: F.els.gov.input.value,
        addr: cleanAddr(F.els.addr.input.value), landmark: cleanLandmark(F.els.landmark.input.value) };
    };
    F.validate = function () {
      var bad = null;
      keys.forEach(function (k) { F.touched[k] = true; F.paint(k); if (!bad && F.errOf(k)) bad = k; });
      if (bad) { var el = F.els[bad].wrap; try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} if (bad !== "gov") F.els[bad].input.focus(); return false; }
      return true;
    };
    keys.forEach(function (k) {
      F.els[k].input.addEventListener(k === "gov" ? "change" : "input", function () {
        if (k === "phone" && F.touched.phone2) F.paint("phone2");
        F.paint(k); if (F.onChange) F.onChange();
      });
      F.els[k].input.addEventListener("blur", function () { F.touched[k] = true; F.paint(k); });
    });
    document.getElementById(pfx + "-govbtn").onclick = function () { openGov(F); };
    return F;
  }

  // ===== شاشة التسجيل =====
  var root = document.getElementById("reg"), built = false, RF = null;
  function build() {
    if (built || !root) return; built = true;
    root.innerHTML =
      '<div class="rg-wrap">' +
        '<div class="rg-head"><img class="rg-logo" src="assets/logo.png" alt="">' +
          '<h1 id="rgT">أهلاً بيك في صيدليات د/ مراد صادق</h1>' +
          '<p>سجّل بياناتك مرة واحدة بس، وهنحفظها علشان طلباتك توصلك أسرع وأسهل.</p><div class="rg-gold"></div></div>' +
        '<div class="rg-card"><div id="rg-form"></div>' +
          '<button class="rg-go" id="rg-go" type="button" disabled>حفظ والدخول للتطبيق</button>' +
        '</div>' +
        '<p class="rg-note">بياناتك بنستخدمها لتجهيز وتوصيل طلباتك بس، وتقدر تعدّلها في أي وقت من صفحة "حسابي".</p>' +
      '</div>';
    RF = mountForm(document.getElementById("rg-form"), "rg", { confirm: true, onChange: function () { var b = document.getElementById("rg-go"); if (b) b.disabled = !RF.allOk(); } });
    document.getElementById("rg-go").onclick = submit;
  }
  function submit() {
    if (!RF.validate()) return;
    var prof = saveProfile(RF.get());
    try { if (window.MuradGuard) window.MuradGuard.recheck(); } catch (e) {}   // لو الرقم ده محظور في الشيت: الحظر يظهر فورًا
    closeReg();
    if (document.body.dataset.view === "account" && typeof window.accountView === "function") window.accountView();
    var first = nameParts(prof.name)[0] || "";
    setTimeout(function () { if (typeof window.toast === "function") window.toast("أهلاً بيك يا " + first + " 👋"); }, 350);
  }
  function openReg() {
    if (!root) return;
    build();
    RF.set(getProfile());
    document.documentElement.classList.add("need-reg");
    root.scrollTop = 0;
  }
  function closeReg() { document.documentElement.classList.remove("need-reg"); }
  // بيتنده عليها أول ما التطبيق يفتح، وبعد "مسح بياناتي"
  function check() { if (isValid(getProfile())) closeReg(); else openReg(); }

  window.MuradReg = {
    errName: errName, errPhone: errPhone, errAddr: errAddr, errGov: errGov, errLandmark: errLandmark,
    cleanName: cleanName, cleanAddr: cleanAddr, digits: digits,
    isValid: isValid, saveProfile: saveProfile, check: check, mountForm: mountForm, getProfile: getProfile
  };
  check();
})();

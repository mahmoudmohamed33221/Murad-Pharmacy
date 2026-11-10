// حارس العميل: بيقرا "حالة العميل" و"حالة البرنامج" من ورقة العملاء ويطبّقهم.
//  - حالة العميل = موقوف  -> شاشة حظر مفيهاش غير (واتساب) و(خروج)، ومحدش يقدر يعديها.
//  - حالة البرنامج = حذف  -> مسح بيانات التطبيق + طلب إلغاء التثبيت (أندرويد) + شاشة قفل.
// الحالة بتتخزن في أكتر من مكان في الجهاز (localStorage + Cookie + IndexedDB + Cache Storage)
// وكل مرة بتتقرا بتتنسخ للباقي، فلو مكان اتمسح الباقي بيرجّعه. وأول ما التطبيق يفتح بنسأل السيرفر،
// ولو مفيش نت أو النت ضعيف بنكمّل بالمحفوظ في الجهاز لحد ما السيرفر يرد.
(function () {
  "use strict";

  var KEY = "mrad_guard", IDB = "mrad_guard", CACHE = "mrad-guard-v1", CACHE_URL = "/__mrad_guard__";
  var PROFILE_KEY = "mrad_profile";
  var rec = { ban: 0, del: 0, phone: "", dev: "", ts: 0 };
  var introDone = false, started = false, wiped = false, uninstallTried = false, busy = null;
  var kind = "", obs = null, guardTimer = null;
  var CFG = function () { return window.APP_CONFIG || {}; };
  var plugins = function () { try { return (window.Capacitor && window.Capacitor.Plugins) || {}; } catch (e) { return {}; } };

  // ===== تفسير القيم اللي في الشيت =====
  function norm(s) {
    return String(s == null ? "" : s).replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function isBan(s) { return /موقوف|محظور|حظر|ايقاف|بلوك|block|ban/.test(norm(s)); }
  function isDel(s) { return /حذف|مسح|الغاء|ازال|uninstall|delete/.test(norm(s)); }

  // ===== التخزين في 4 أماكن =====
  function lsRead() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function lsWrite(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} }
  function ckRead() {
    try { var m = document.cookie.match(/(?:^|;\s*)mrad_guard=([^;]*)/); return m ? JSON.parse(decodeURIComponent(m[1])) : null; }
    catch (e) { return null; }
  }
  function ckWrite(r) {
    try { document.cookie = "mrad_guard=" + encodeURIComponent(JSON.stringify(r)) + ";max-age=315360000;path=/;SameSite=Lax"; } catch (e) {}
  }
  function idbOpen() {
    return new Promise(function (res) {
      try {
        var q = indexedDB.open(IDB, 1);
        q.onupgradeneeded = function () { q.result.createObjectStore("kv"); };
        q.onsuccess = function () { res(q.result); };
        q.onerror = q.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  function idbRead() {
    return idbOpen().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        try {
          var t = db.transaction("kv", "readonly").objectStore("kv").get("g");
          t.onsuccess = function () { res(t.result || null); db.close(); };
          t.onerror = function () { res(null); db.close(); };
        } catch (e) { res(null); }
      });
    });
  }
  function idbWrite(r) {
    return idbOpen().then(function (db) {
      if (!db) return;
      return new Promise(function (res) {
        try {
          var tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(r, "g");
          tx.oncomplete = tx.onerror = tx.onabort = function () { db.close(); res(); };
        } catch (e) { res(); }
      });
    });
  }
  function cRead() {
    if (!window.caches) return Promise.resolve(null);
    return caches.open(CACHE).then(function (c) { return c.match(CACHE_URL); })
      .then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
  }
  function cWrite(r) {
    if (!window.caches) return Promise.resolve();
    return caches.open(CACHE).then(function (c) {
      return c.put(CACHE_URL, new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } }));
    }).catch(function () {});
  }
  function save(r) { lsWrite(r); ckWrite(r); idbWrite(r); cWrite(r); }
  function valid(r) { return r && typeof r === "object" && typeof r.ts === "number"; }
  // بنختار أحدث نسخة من الأماكن الأربعة وبنرجّعها للكل
  function load() {
    return Promise.all([Promise.resolve(lsRead()), Promise.resolve(ckRead()), idbRead(), cRead()]).then(function (all) {
      var best = null;
      all.forEach(function (r) { if (valid(r) && (!best || r.ts > best.ts)) best = r; });
      if (best) { best = { ban: best.ban ? 1 : 0, del: best.del ? 1 : 0, phone: String(best.phone || ""), dev: String(best.dev || ""), ts: best.ts }; save(best); }
      return best;
    });
  }

  function profilePhone() {
    try { var p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); return p && p.phone ? String(p.phone) : ""; }
    catch (e) { return ""; }
  }

  // ===== معرّف الجهاز =====
  // الأندرويد (APK): ANDROID_ID من النظام، بيفضل ثابت حتى لو التطبيق اتحذف ونزل تاني. الويب: رقم عشوائي بيتحفظ في الجهاز (بيروح لو اتمسح).
  function webId() {
    try { if (window.crypto && crypto.randomUUID) return "w-" + crypto.randomUUID(); } catch (e) {}
    return "w-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  function ensureDevice() {
    return new Promise(function (res) {
      try {
        var P = plugins().AppUninstall;
        if (P && P.deviceId) { P.deviceId().then(function (o) { res(o && o.id ? "a-" + String(o.id) : ""); }, function () { res(""); }); return; }
      } catch (e) {}
      res("");
    }).then(function (id) {
      var dev = id || rec.dev || webId();
      if (dev !== rec.dev) { rec.dev = dev; rec.ts = Math.max(rec.ts, Date.now()); save(rec); }
    });
  }

  // ===== سؤال السيرفر (الشيت) =====
  function query(phone, dev) {
    var url = CFG().CUSTOMERS_URL;
    if (!url || (!phone && !dev)) return Promise.resolve(null);
    var ctl = window.AbortController ? new AbortController() : null, tm;
    var timeout = new Promise(function (res) { tm = setTimeout(function () { if (ctl) ctl.abort(); res(null); }, 7000); });
    var req = fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "action=status&phone=" + encodeURIComponent(phone || "") + "&device=" + encodeURIComponent(dev || "") + "&_=" + Date.now(),
      { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { return j && j.ok ? j : null; })
      .catch(function () { return null; });
    return Promise.race([req, timeout]).then(function (j) { clearTimeout(tm); return j; });
  }

  function apply(j) {
    // محظور لو حالة العميل موقوف، أو لو الجهاز ده عليه أي حساب محظور (حتى لو بالاسم والرقم التانيين)
    var ban = !!((j.found && isBan(j.status)) || j.devBan), del = !!(j.found && isDel(j.prog));
    rec = { ban: ban ? 1 : 0, del: del ? 1 : 0, phone: rec.phone, dev: rec.dev, ts: Date.now() };
    save(rec);
    render();
  }

  function recheck() {
    var phone = profilePhone() || rec.phone;
    if (!phone && !rec.dev) return Promise.resolve();
    if (phone && phone !== rec.phone) { rec.phone = phone; rec.ts = Date.now(); save(rec); }
    if (busy) return busy;
    busy = query(phone, rec.dev).then(function (j) { busy = null; if (j) apply(j); });   // مفيش رد: بنكمّل على المحفوظ في الجهاز
    return busy;
  }

  // ===== الشاشة =====
  var CSS = "#mg-block{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;z-index:2147483647!important;" +
    "background:#000!important;color:#f2f2f2!important;display:flex!important;flex-direction:column!important;align-items:center!important;" +
    "justify-content:center!important;gap:14px!important;padding:28px 24px!important;direction:rtl!important;text-align:center!important;" +
    "font-family:Cairo,Tahoma,sans-serif!important;visibility:visible!important;opacity:1!important;transform:none!important;" +
    "pointer-events:auto!important;overflow:auto!important}" +
    "#mg-block *{box-sizing:border-box;font-family:inherit}" +
    "#mg-block .mg-logo{width:96px;height:96px;border-radius:50%;background:#000;box-shadow:0 0 0 2px #C8A24A,0 10px 30px rgba(0,0,0,.6);margin-bottom:6px}" +
    "#mg-block h2{margin:0;font-size:24px;font-weight:800;color:#fff}" +
    "#mg-block p{margin:0;max-width:340px;font-size:16px;line-height:1.9;color:#d8d8d8;font-weight:600}" +
    "#mg-block .mg-hint{font-size:13px;color:#9a9a9a}" +
    "#mg-block button{width:100%;max-width:340px;border:0;border-radius:16px;padding:15px 18px;font-size:17px;font-weight:800;cursor:pointer;" +
    "font-family:inherit;-webkit-tap-highlight-color:transparent}" +
    "#mg-block .mg-wa{background:#1fa855;color:#fff;margin-top:10px}" +
    "#mg-block .mg-un{background:#F57C00;color:#fff;margin-top:10px}" +
    "#mg-block .mg-exit{background:transparent;color:#f2f2f2;border:2px solid #3a3a3a}" +
    "#mg-block .mg-wa:active,#mg-block .mg-un:active{filter:brightness(.9)}";

  function ensureCss() {
    if (document.getElementById("mg-css")) return;
    var st = document.createElement("style"); st.id = "mg-css"; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function exitApp() {
    try { var A = plugins().App; if (A && A.exitApp) { A.exitApp(); return; } } catch (e) {}
    try { window.close(); } catch (e) {}
    setTimeout(function () { var n = document.getElementById("mg-exit-note"); if (n) n.hidden = false; }, 300);
  }

  function openWA() {
    var c = CFG(), ph = String(c.BAN_PHONE || c.PHARMACY_PHONE || "").replace(/\D/g, "");
    var msg = "السلام عليكم، أنا محظور من استخدام تطبيق " + (c.PHARMACY_NAME || "الصيدلية") +
      (rec.phone ? "\nرقم الموبايل: " + rec.phone : "") + "\nأرجو مراجعة حالتي.";
    var u = "https://wa.me/" + ph + "?text=" + encodeURIComponent(msg), w = null;
    try { w = window.open(u, "_blank"); } catch (e) {}
    if (!w) { try { location.href = u; } catch (e) {} }
  }

  function nativeUninstall() {
    try { var P = plugins().AppUninstall; if (P && P.uninstall) { P.uninstall(); return true; } } catch (e) {}
    return false;
  }

  // مسح بيانات التطبيق (ما عدا سجل الحارس نفسه)
  function wipe() {
    if (wiped) return; wiped = true;
    try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }); } catch (e) {}
    try { if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { if (k !== CACHE) caches.delete(k); }); }); } catch (e) {}
    try { var keep = localStorage.getItem(KEY); localStorage.clear(); if (keep) localStorage.setItem(KEY, keep); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    try { if (indexedDB.databases) indexedDB.databases().then(function (ds) { ds.forEach(function (d) { if (d.name && d.name !== IDB) indexedDB.deleteDatabase(d.name); }); }); } catch (e) {}
  }

  function build(k) {
    ensureCss();
    var old = document.getElementById("mg-block"); if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement("div");
    el.id = "mg-block"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-modal", "true");
    var hasNative = !!(plugins().AppUninstall && plugins().AppUninstall.uninstall);
    el.innerHTML = '<img class="mg-logo" src="assets/logo.png" alt="">' + (k === "del"
      ? '<h2>تم إلغاء تفعيل التطبيق</h2>' +
        '<p>تم إيقاف التطبيق على هذا الجهاز' + (hasNative ? '، اضغط "موافق" في رسالة النظام لإلغاء التثبيت.' : '، من فضلك احذفه من جهازك.') + '</p>' +
        (hasNative ? '<button type="button" class="mg-un">إلغاء التثبيت</button>'
                   : '<p class="mg-hint">امسك أيقونة التطبيق على الشاشة واختار "إلغاء التثبيت".</p>')
      : '<h2>حسابك محظور</h2>' +
        '<p>أنت محظور من استخدام التطبيق الخاص بنا، يرجى التواصل عبر واتساب.</p>' +
        '<button type="button" class="mg-wa">تواصل عبر واتساب</button>') +
      '<button type="button" class="mg-exit">خروج</button>' +
      '<p class="mg-hint" id="mg-exit-note" hidden>اقفل التطبيق من زر الرجوع أو من التطبيقات الأخيرة.</p>';
    el.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!t) return;
      if (t.classList.contains("mg-wa")) openWA();
      else if (t.classList.contains("mg-un")) { if (!nativeUninstall()) exitApp(); }
      else if (t.classList.contains("mg-exit")) exitApp();
    });
    document.documentElement.appendChild(el);
  }

  // لو حد حاول يشيل الشاشة أو يخفيها (من أدوات المطور مثلًا) بنرجّعها فورًا
  function ensure() {
    if (!kind) return;
    var el = document.getElementById("mg-block");
    if (!el || el.parentNode !== document.documentElement) { build(kind); return; }
    if (el.hidden || el.getAttribute("style") || el.className) { el.hidden = false; el.removeAttribute("style"); el.removeAttribute("class"); }
    if (!document.getElementById("mg-css")) ensureCss();
    if (document.body && !document.body.hasAttribute("inert")) document.body.setAttribute("inert", "");
  }

  function lock(k) {
    var changed = kind !== k;
    kind = k;
    if (changed || !document.getElementById("mg-block")) build(k);
    if (document.body) document.body.setAttribute("inert", "");
    if (!obs && window.MutationObserver) {
      obs = new MutationObserver(function () { ensure(); });
      obs.observe(document.documentElement, { childList: true });
      if (document.head) obs.observe(document.head, { childList: true });
      obs.observe(document.getElementById("mg-block"), { attributes: true });
    } else if (obs && changed) {
      try { obs.disconnect(); obs.observe(document.documentElement, { childList: true }); if (document.head) obs.observe(document.head, { childList: true }); obs.observe(document.getElementById("mg-block"), { attributes: true }); } catch (e) {}
    }
    if (!guardTimer) guardTimer = setInterval(ensure, 1000);
    if (k === "del") {
      wipe();
      if (!uninstallTried) { uninstallTried = true; setTimeout(nativeUninstall, 900); }
    }
  }

  function unlock() {
    kind = "";
    if (guardTimer) { clearInterval(guardTimer); guardTimer = null; }
    if (obs) { try { obs.disconnect(); } catch (e) {} obs = null; }
    var el = document.getElementById("mg-block"); if (el && el.parentNode) el.parentNode.removeChild(el);
    if (document.body) document.body.removeAttribute("inert");
  }

  function render() {
    if (!introDone) return;                    // الرسالة بتظهر بعد ما الانترو يخلص
    if (rec.del) lock("del"); else if (rec.ban) lock("ban"); else if (kind) unlock();
  }

  function waitIntro() {
    var t0 = Date.now();
    (function poll() {
      var el = document.getElementById("intro"), b = document.body;
      if (!el || !b || !b.classList.contains("intro-lock") || Date.now() - t0 > 20000) { introDone = true; render(); return; }
      setTimeout(poll, 150);
    })();
  }

  function start() {
    if (started) return; started = true;
    waitIntro();
    // 1) الأول المحفوظ في الجهاز (سريع)، 2) وفي نفس الوقت بنسأل السيرفر وهو اللي ليه الكلمة الأخيرة
    load().then(function (r) {
      if (r) rec = r;
      var ph = profilePhone();
      if (ph && ph !== rec.phone) { rec.phone = ph; rec.ts = Math.max(rec.ts, Date.now()); save(rec); }
      render();
      return ensureDevice().then(function () { render(); return recheck(); });
    });
  }

  try {
    var A = plugins().App;                     // زرار الرجوع في الأندرويد وإحنا في شاشة الحظر = خروج
    if (A && A.addListener) A.addListener("backButton", function () { if (kind) exitApp(); });
  } catch (e) {}
  document.addEventListener("visibilitychange", function () { if (!document.hidden) recheck(); });
  window.addEventListener("online", function () { recheck(); });
  setInterval(function () { if (!document.hidden) recheck(); }, 90000);

  window.MuradGuard = { recheck: recheck, device: function () { return rec.dev || ""; }, blocked: function () { return !!(rec.ban || rec.del); } };

  // config.js بيتحمّل بعد السكربت ده، فبنبدأ بعد ما الصفحة تتحمّل
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

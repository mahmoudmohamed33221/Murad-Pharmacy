// مشترياتي: الطلبات اللي جاري توصيلها (فوق) + الطلبات اللي اتستلمت (تحت الخط الفاصل).
// - كل طلب بيتحفظ في الجهاز وبيتبعت لورقة "الطلبات" (لو النت واقع بيستنى ويتبعت لما يرجع).
// - الحالة (مقبول / جاري التجهيز / جاري التوصيل / تم التوصيل) بتتسحب من الشيت كل ثواني وبتظهر على الكارت.
(function () {
  "use strict";
  var KEY = "mrad_orders2", MAX = 40;
  var CFG = window.APP_CONFIG || {};
  var list = ld(KEY, []);
  var syncing = false, pollT = null, sending = false;

  var STEPS = [
    { k: "pending", t: "تم إرسال الطلب" },
    { k: "accepted", t: "تم قبول الطلب" },
    { k: "preparing", t: "جاري التجهيز" },
    { k: "delivering", t: "جاري التوصيل" }
  ];
  var SHORT = { queued: "جاري الإرسال", pending: "في انتظار القبول", accepted: "تم قبول طلبك", preparing: "جاري تجهيز طلبك", delivering: "طلبك في الطريق", completed: "تم الاستلام" };

  function save() { sv(KEY, list.slice(0, MAX)); }
  function rid() { return "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function stOf(o) { return o.status || (o.sent ? "pending" : "queued"); }
  function isDone(o) { return stOf(o) === "completed"; }
  var dig = function (s) { return String(s == null ? "" : s).replace(/[٠-٩]/g, function (x) { return "٠١٢٣٤٥٦٧٨٩".indexOf(x); }); };
  var tel = function (s) { return dig(s).replace(/\D/g, ""); };

  // ===== إضافة طلب جديد (بيتنده من app.js وقت تأكيد الطلب) =====
  function add(p) {
    var now = new Date();
    var o = { cid: rid(), ts: now.getTime(), d: now.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "numeric", day: "numeric" }),
      t: now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), items: p.items, total: p.total, sent: false, status: "",
      payload: { action: "newOrder", name: p.name, phone: p.phone, gov: p.gov || "", addr: p.addr, landmark: p.landmark || "", notes: p.notes || "", total: p.total,
        items: p.items.join("\n"), device: (window.MuradGuard && window.MuradGuard.device && window.MuradGuard.device()) || "" } };
    o.payload.cid = o.cid;
    list.unshift(o); save(); badge(); push();
    if (!$("v-orders").hidden) render();
    return o;
  }

  // ===== إرسال الطلبات اللي لسه ما وصلتش للشيت =====
  function push() {
    var url = CFG.ORDERS_URL; if (!url || sending) return;
    var o = list.filter(function (x) { return !x.sent && x.payload; }).pop();     // الأقدم الأول
    if (!o) return;
    sending = true;
    fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(o.payload), redirect: "follow" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) { o.sent = true; o.bon = j.bon; if (!o.status) o.status = "pending"; delete o.payload; }
        else if (j && j.error) { o.sent = true; o.status = "pending"; o.rejected = j.error; delete o.payload; }   // السيرفر رفضه (حظر/بيانات): مفيش فايدة من التكرار
        save(); render(); badge();
      })
      .catch(function () {})
      .then(function () { sending = false; if (list.some(function (x) { return !x.sent && x.payload; })) setTimeout(push, 1500); });
  }

  // ===== سحب الحالة من الشيت =====
  function sync() {
    var url = CFG.ORDERS_URL;
    var ids = list.filter(function (o) { return o.sent && !(isDone(o) && o.final); }).map(function (o) { return o.cid; });
    if (!url || syncing || !ids.length) return Promise.resolve();
    syncing = true;
    return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "action=myOrders&ids=" + encodeURIComponent(ids.join(",")) + "&_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) return;
        var by = {}; (j.orders || []).forEach(function (s) { by[s.cid] = s; });
        list.forEach(function (o) {
          var s = by[o.cid]; if (!s) return;
          o.bon = s.bon; o.status = s.status; o.pilotName = s.pilotName; o.pilotPhone = s.pilotPhone; o.shopEta = s.shopEta; o.custEta = s.custEta;
          if (s.status === "completed") { o.final = true; o.doneAt = s.doneAt || o.doneAt || ""; }
          if (s.total) o.total = s.total;
        });
        save(); render(); badge();
      })
      .catch(function () {})
      .then(function () { syncing = false; });
  }

  // ===== الرسم =====
  var I = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    bike: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l3-7h5l4 7M9 10l-1-3H6M13 7h3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };
  function itemsHTML(o) {
    var a = Array.isArray(o.items) ? o.items : String(o.items || "").split("\n").filter(Boolean);
    return '<ul class="od-items">' + a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }
  function stepsHTML(st) {
    var idx = Math.max(0, STEPS.map(function (s) { return s.k; }).indexOf(st));
    return '<div class="od-steps">' + STEPS.map(function (s, i) {
      return '<div class="od-st' + (i < idx ? " done" : i === idx ? " now" : "") + '"><i>' + (i < idx ? "✓" : "") + "</i><span>" + s.t + "</span></div>";
    }).join("") + "</div>";
  }
  function activeCard(o) {
    var st = stOf(o), eta = "";
    if (st === "delivering" && o.custEta) eta = '<div class="od-eta">' + I.clock + "الوصول إليك خلال <b>" + esc(o.custEta) + "</b></div>";
    else if ((st === "accepted" || st === "preparing") && o.shopEta) eta = '<div class="od-eta">' + I.clock + "الطيار يصل للصيدلية خلال <b>" + esc(o.shopEta) + "</b></div>";
    var pilot = o.pilotName ? '<div class="od-pilot"><span class="pi">' + I.bike + "</span><div><small>الطيار</small><b>" + esc(o.pilotName) + "</b></div>" +
      (tel(o.pilotPhone) ? '<a class="pcall" href="tel:' + tel(o.pilotPhone) + '" aria-label="اتصال بالطيار">' + I.phone + "</a>" : "") + "</div>" : "";
    var note = o.rejected === "banned" ? '<div class="od-warn">تعذر تسجيل الطلب. تواصل مع الصيدلية.</div>' : "";
    return '<article class="od-card act"><div class="od-top"><div><b class="od-bon">' + (o.bon ? "طلب رقم " + o.bon : "طلب جديد") + "</b><small>" + esc(o.d) + " · " + esc(o.t || "") +
      '</small></div><span class="od-chip s-' + st + '">' + SHORT[st] + "</span></div>" +
      (st === "queued" ? '<div class="od-wait">جاري إرسال الطلب للصيدلية... تأكد من الإنترنت وهيتبعت لوحده.</div>' : stepsHTML(st)) +
      eta + pilot + note + itemsHTML(o) + '<div class="od-tot"><span>إجمالي الحساب</span><b>' + fmt(o.total) + "</b></div></article>";
  }
  function doneCard(o) {
    return '<article class="od-card dn"><div class="od-top"><div><b class="od-bon">' + (o.bon ? "طلب رقم " + o.bon : "طلب") + "</b><small>" + esc(o.d) + " · " + esc(o.t || "") +
      '</small></div><span class="od-chip s-completed">' + I.check + "تم الاستلام</span></div>" + itemsHTML(o) +
      (o.pilotName ? '<div class="od-meta">' + I.bike + "الطيار: <b>" + esc(o.pilotName) + "</b></div>" : "") +
      '<div class="od-tot"><span>إجمالي الحساب</span><b>' + fmt(o.total) + "</b></div></article>";
  }
  function render() {
    var box = $("od-active"); if (!box) return;
    var act = list.filter(function (o) { return !isDone(o); }), dn = list.filter(isDone);
    box.innerHTML = act.length ? act.map(activeCard).join("") : '<div class="od-empty">لا توجد أي طلبات حالياً جاري توصيلها</div>';
    $("od-done").innerHTML = dn.length ? dn.map(doneCard).join("") : '<div class="od-empty sm">لسه مفيش طلبات اتستلمت</div>';
  }
  function badge() {
    var n = list.filter(function (o) { return !isDone(o); }).length, b = $("odBadge");
    if (b) { b.textContent = n.toLocaleString("ar-EG"); b.hidden = !n; }
    if (n && !pollT) pollT = setInterval(function () { if (!document.hidden) sync(); }, 20000);
    if (!n && pollT) { clearInterval(pollT); pollT = null; }
  }

  // بيتنده عليها لما التبويب يتفتح
  var viewT = null;
  function open() {
    render(); sync(); push();
    clearInterval(viewT); viewT = setInterval(function () { if (document.body.dataset.view !== "orders") { clearInterval(viewT); return; } if (!document.hidden) { sync(); push(); } }, 8000);
  }

  window.addEventListener("online", function () { push(); sync(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { push(); sync(); } });
  render(); badge(); push(); sync();
  function reset() { list = []; save(); render(); badge(); }
  window.Orders = { reset: reset, add: add, open: open, sync: sync, render: render };
})();

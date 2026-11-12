// مشترياتي: الطلبات اللي جاري توصيلها (فوق) + الطلبات اللي اتستلمت (تحت الخط الفاصل).
// - كل طلب بيتحفظ في الجهاز وبيتبعت لورقة "الطلبات" (لو النت واقع بيستنى ويتبعت لما يرجع).
// - الحالة (مقبول / جاري التجهيز / جاري التوصيل / تم التوصيل) بتتسحب من الشيت كل ثواني وبتظهر على الكارت.
(function () {
  "use strict";
  var KEY = "mrad_orders2", MAX = 40;
  var CFG = window.APP_CONFIG || {};
  var list = ld(KEY, []);
  var syncing = false, pollT = null, sending = false, waits = {};

  var SHORT = { queued: "جاري الإرسال", pending: "في انتظار القبول", accepted: "تم قبول طلبك", preparing: "جاري تجهيز طلبك", delivering: "طلبك في الطريق", arrived: "المندوب وصل", completed: "تم الاستلام" };

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

  // بيرجّع رقم البون أول ما السيرفر يرد (أو null بعد المهلة)
  function whenBon(o, ms) {
    return new Promise(function (res) {
      if (o.bon) return res(o.bon);
      var t = setTimeout(function () { res(null); }, ms || 5000);
      (waits[o.cid] = waits[o.cid] || []).push(function (b) { clearTimeout(t); res(b); });
    });
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
        if (j && j.ok) { o.sent = true; o.bon = j.bon; if (!o.status) o.status = "pending"; delete o.payload; (waits[o.cid] || []).forEach(function (f) { f(j.bon); }); delete waits[o.cid]; }
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
    bike: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M7.4 18h9.2M16.6 18l-2.3-9.5H11.5M13.6 6h3.6"/><rect x="2.5" y="7.5" width="7.5" height="6" rx="1.2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };
  // ===== الفاتورة =====
  function parseLines(o) {
    var a = Array.isArray(o.items) ? o.items : String(o.items || "").split("\n").filter(Boolean);
    return a.map(function (x) {
      var m = String(x).match(/^(.*)\s×\s(\d+)\s=\s([\d.,]+)/);
      if (!m) return { n: String(x), q: 0, t: 0, p: 0, raw: true };
      var q = +m[2], t = parseFloat(m[3].replace(/,/g, "")) || 0;
      return { n: m[1].trim(), q: q, t: t, p: q ? t / q : 0 };
    });
  }
  var num = function (n) { return (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }); };
  function invoiceHTML(o) {
    var L = parseLines(o), sum = L.reduce(function (a, l) { return a + l.t; }, 0);
    var total = Math.max(Number(o.total) || 0, sum), ship = Math.round((total - sum) * 100) / 100;
    var rows = L.map(function (l) {
      return "<tr><td class=\"inv-n\">" + esc(l.n) + "</td><td>" + (l.raw ? "-" : num(l.p)) + "</td><td>" + (l.raw ? "-" : l.q) + "</td><td><b>" + (l.raw ? "-" : num(l.t)) + "</b></td></tr>";
    }).join("");
    rows += "<tr class=\"ship\"><td class=\"inv-n\">التوصيل</td><td>0</td><td>0</td><td><b>" + num(ship) + "</b></td></tr>";
    return '<div class="inv"><div class="inv-h"><b>صيدليات د/ مراد صادق</b><img src="assets/logo.png" alt=""></div>' +
      '<div class="inv-sub">' + (o.bon ? "فاتورة طلب رقم " + o.bon + " · " : "") + esc(o.d || "") + " · " + esc(o.t || "") + "</div>" +
      (o.pilotName ? '<div class="inv-pilot">' + I.bike + "الطيار: <b>" + esc(o.pilotName) + "</b></div>" : "") +
      '<table class="inv-t"><thead><tr><th class="inv-n">اسم الصنف</th><th>سعر القطعة</th><th>العدد</th><th>إجمالي سعر القطع</th></tr></thead><tbody>' + rows +
      '</tbody><tfoot><tr><td colspan="4"><div class="inv-f"><span>الإجمالي النهائي</span><b>' + num(total) + " " + CURRENCY + "</b></div></td></tr></tfoot></table></div>";
  }
  var openInv = {};
  var CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var RECEIPT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>';
  function invBlock(o) {
    var on = !!openInv[o.cid];
    return '<div class="od-inv' + (on ? " open" : "") + '"><button type="button" class="od-inv-btn" data-inv="' + o.cid + '" aria-expanded="' + on + '">' +
      '<span class="ic">' + RECEIPT + '</span><span class="tx">' + (on ? "إخفاء الفاتورة" : "اظهر الفاتورة") + '</span><span class="chev">' + CHEVRON + "</span></button>" +
      '<div class="od-inv-wrap"><div class="od-inv-in">' + invoiceHTML(o) + "</div></div></div>";
  }

  // ===== شريط المراحل =====
  // حالة كل مرحلة: done (أخضر + صح) / now (شغالة دلوقتي) / todo (لسه)
  var CUR = { queued: 0, pending: 1, accepted: 2, preparing: 2, delivering: 3, arrived: 4 };
  var STEP_TXT = [
    { ok: "تم إرسال الطلب", now: "جاري إرسال الطلب", todo: "إرسال الطلب" },
    { ok: "تم استلام الطلب", now: "في انتظار قبول الطلب", todo: "في انتظار قبول الطلب" },
    { ok: "تم تجهيز طلبك", now: "جاري تحضير الطلب", todo: "جاري تحضير الطلب" },
    { ok: "خرج الطلب للتوصيل", now: "جاري توصيل الطلب", todo: "جاري توصيل الطلب" },
    { ok: "تم وصول المندوب إلى موقعك", now: "تم وصول المندوب إلى موقعك", todo: "تم وصول المندوب إلى موقعك" }
  ];
  var TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg>';
  function stepsHTML(st) {
    var cur = CUR[st] == null ? 1 : CUR[st], dots = "", lbls = "";
    for (var i = 0; i < 5; i++) {
      var s = (st === "arrived" && i === 4) ? "ok" : i < cur ? "ok" : i === cur ? "now" : "todo";
      dots += '<div class="od-d od-' + s + '"><i>' + (s === "ok" ? TICK : s === "now" ? "<b></b>" : "") + "</i></div>";
      lbls += '<span class="od-' + s + '">' + STEP_TXT[i][s] + "</span>";
    }
    return '<div class="od-tl"><div class="od-dots">' + dots + '</div><div class="od-lbls">' + lbls + "</div></div>";
  }

  function activeCard(o) {
    var st = stOf(o), eta = "";
    if (st === "delivering" && o.custEta) eta = '<div class="od-eta">' + I.clock + "الوصول إليك خلال <b>" + esc(o.custEta) + "</b></div>";
    else if ((st === "accepted" || st === "preparing") && o.shopEta) eta = '<div class="od-eta">' + I.clock + "الطيار يصل للصيدلية خلال <b>" + esc(o.shopEta) + "</b></div>";
    var pilot = o.pilotName ? '<div class="od-pilot"><span class="pi">' + I.bike + "</span><div><small>الطيار</small><b>" + esc(o.pilotName) + "</b></div>" +
      (tel(o.pilotPhone) ? '<a class="pcall" href="tel:' + tel(o.pilotPhone) + '" aria-label="اتصال بالطيار">' + I.phone + "</a>" : "") + "</div>" : "";
    var note = o.rejected === "banned" ? '<div class="od-warn">تعذر تسجيل الطلب. تواصل مع الصيدلية.</div>' : "";
    var wait = st === "queued" ? '<div class="od-wait">جاري إرسال الطلب للصيدلية... تأكد من الإنترنت وهيتبعت لوحده.</div>' : "";
    return '<article class="od-card act"><div class="od-top"><div><b class="od-bon">' + (o.bon ? "طلب رقم " + o.bon : "طلب جديد") + "</b><small>" + esc(o.d) + " · " + esc(o.t || "") +
      '</small></div><span class="od-chip s-' + st + '">' + SHORT[st] + "</span></div>" + stepsHTML(st) + wait +
      eta + pilot + note + invBlock(o) + '<div class="od-tot"><span>إجمالي الحساب</span><b>' + fmt(o.total) + "</b></div></article>";
  }
  function doneCard(o) {
    return '<article class="od-card dn"><div class="od-top"><div><b class="od-bon">' + (o.bon ? "طلب رقم " + o.bon : "طلب") + "</b><small>" + esc(o.d) + " · " + esc(o.t || "") +
      '</small></div><span class="od-chip s-completed">' + I.check + "تم الاستلام</span></div>" + invBlock(o) +
      '<div class="od-tot"><span>إجمالي الحساب</span><b>' + fmt(o.total) + "</b></div></article>";
  }
  var lastSig = "";
  function render() {
    var box = $("od-active"); if (!box) return;
    var act = list.filter(function (o) { return !isDone(o); }), dn = list.filter(isDone);
    var a = act.length ? act.map(activeCard).join("") : '<div class="od-empty">لا توجد أي طلبات حالياً جاري توصيلها</div>';
    var d = dn.length ? dn.map(doneCard).join("") : '<div class="od-empty sm">لسه مفيش طلبات اتستلمت</div>';
    var sig = a + "|" + d; if (sig === lastSig) return;       // مفيش تغيير: ما نعيدش الرسم (علشان الفاتورة المفتوحة ما تقفلش)
    lastSig = sig; box.innerHTML = a; $("od-done").innerHTML = d;
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-inv]"); if (!b) return;
    var id = b.getAttribute("data-inv"), box = b.closest(".od-inv"), on = !box.classList.contains("open");
    openInv[id] = on; box.classList.toggle("open", on); b.setAttribute("aria-expanded", on);
    b.querySelector(".tx").textContent = on ? "إخفاء الفاتورة" : "اظهر الفاتورة";
    lastSig = "";   // الرسم الجاي يتحدّث بالحالة الجديدة
  });
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
  function reset() { list = []; openInv = {}; lastSig = ""; save(); render(); badge(); }
  window.Orders = { whenBon: whenBon, reset: reset, add: add, open: open, sync: sync, render: render };
})();

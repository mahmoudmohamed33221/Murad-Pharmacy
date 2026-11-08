
// ====== الإعدادات (من ملف config.js) ======
const CFG = window.APP_CONFIG || {};
const PHARMACY_PHONE = CFG.PHARMACY_PHONE || "";
const CURRENCY = CFG.CURRENCY || "ج.م";
const RECOGNIZE_URL = CFG.RECOGNIZE_URL || "";
let DEBUG = false; try{ DEBUG = localStorage.getItem("mrad_debug")==="1" || /[?&]debug=1/.test(location.search); }catch(e){}

// ====== الأيقونات (خطوط بسيطة بدل الإيموجي) ======
const IC = {
 pill:'<path d="M10.5 20.5l-7-7a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7z"/><path d="M8.5 8.5l7 7"/>',
 drop:'<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
 sparkle:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
 bubbles:'<circle cx="9" cy="14" r="5"/><circle cx="17" cy="7" r="3"/><circle cx="18" cy="16.5" r="2"/>',
 leaf:'<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-5 6-8 10-10"/>',
 heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
 pulse:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
 box:'<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
 cart:'<path d="M3 4h2.2l2.3 11.1a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8.5H6.2"/><circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
 receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
 camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
 image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
 alert:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.1"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'
};
const svg = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||IC.box}</svg>`;
const CAT_ICON = {"أدوية":"pill","عناية بالشعر":"drop","عناية بالبشرة":"sparkle","العناية اليومية":"bubbles","مكملات وفيتامينات":"leaf","الأم والطفل":"heart","أجهزة طبية":"pulse"};
const iconFor = c => CAT_ICON[c] || "box";
const thumb = p => `<span class="th">${svg(iconFor(p.cat))}${p.imgs&&p.imgs[0]?`<img src="${esc(p.imgs[0])}" data-pid="${esc(p.id)}" data-i="0" alt="" loading="lazy" referrerpolicy="no-referrer" onload="imgOk(this)" onerror="imgFail(this)">`:""}</span>`;
const fillIcons = () => document.querySelectorAll("[data-ic]").forEach(e=>{ e.innerHTML = svg(e.dataset.ic); });

// ====== المنتجات: بتتحمل من data/products.json أو من Google Sheet ======
let PRODUCTS = [], BY = {};
const P = id => BY[id];
const stripPrice = p => p.stripPrice || Math.round(p.price/p.strips);
function driveImgs(u){
  u=String(u||"").trim(); if(!u) return [];
  const m=u.match(/\/d\/([\w-]{10,})/)||u.match(/[?&]id=([\w-]{10,})/);
  if(m && /drive\.google|docs\.google|googleusercontent/.test(u)){ const id=m[1];
    return ["https://lh3.googleusercontent.com/d/"+id+"=w800","https://drive.google.com/thumbnail?id="+id+"&sz=w800","https://drive.google.com/uc?export=view&id="+id]; }
  return [/^https?:/.test(u) ? u : "assets/products/"+u];
}
const IMGLOG = {};
const dbgText = p => "خلية الصورة: "+(p.rawImg||"(فاضية)")+"\nالأعمدة: "+(window.__HDR||"-")+"\n"+(IMGLOG[p.id]||[]).slice(-8).join("\n");
function imgNote(pid,msg){
  if(!DEBUG) return; (IMGLOG[pid] = IMGLOG[pid]||[]).push(msg);
  const d = document.getElementById("dbgimg"), p = P(pid); if(d && p && popId===pid) d.textContent = dbgText(p);
}
function imgOk(el){ imgNote(el.dataset.pid, "✓ اتحملت: "+el.currentSrc); }
function imgFail(el){
  const p = P(el.dataset.pid), i = (+el.dataset.i||0)+1;
  imgNote(el.dataset.pid, "✗ فشل: "+el.src);
  if(p && p.imgs && p.imgs[i]){ el.dataset.i = i; el.src = p.imgs[i]; } else el.remove();
}
function normProduct(r,i){
  const num = v => { const n = parseFloat(String(v==null?"":v).replace(/[^\d.]/g,"")); return isFinite(n)?n:0; };
  const name = String(r.name||"").trim(); if(!name) return null;
  const sh = /^\s*\d+(\.\d+)?\s*$/.test(String(r.sh||"")) ? num(r.sh) : 0;     // رقم أكبر من صفر فقط = في شرايط
  const k = sh>0 ? Math.max(1,Math.floor(sh)) : 1;
  const stock = Math.max(0,Math.floor(/^\s*\d+\s*$/.test(String(r.stock||"")) ? num(r.stock) : 0));   // فاضي/كلام = غير متوفر
  return { id:String(r.id||("p"+(i+1))).trim(), name, cat:String(r.cat||"").trim()||"أخرى", price:num(r.price), strips:k, stripPrice:num(r.strip_price),
    imgs:driveImgs(r.image), rawImg:String(r.image||"").trim(), alias:"", stock, out:stock<=0,
    disc:Math.min(100,num(r.disc)), minq:Math.max(1,Math.floor(num(r.minq))||1), incl:Math.floor(num(r.incl)) };
}
function parseCSV(t){
  const rows=[]; let r=[], c="", q=false;
  for(let i=0;i<t.length;i++){ const ch=t[i];
    if(q){ if(ch==='"'){ if(t[i+1]==='"'){c+='"';i++;} else q=false; } else c+=ch; }
    else if(ch==='"') q=true; else if(ch===","){ r.push(c); c=""; }
    else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&t[i+1]==="\n") i++; r.push(c); rows.push(r); r=[]; c=""; }
    else c+=ch; }
  if(c||r.length){ r.push(c); rows.push(r); }
  return rows;
}
const hdrKey = x => { const h = norm(String(x)).replace(/\s+/g," ");
  if(HK[h]) return HK[h];
  if(h.includes("صور")||h.includes("image")||h.includes("photo")) return "image";
  if(h.includes("خصم")) return "disc";
  if(h.includes("ادني")||h.startsWith("الحد")) return "minq";
  if(h.includes("مشمول")||h.includes("تقطيع")) return "incl";
  return ""; };
const HK = {"الرقم":"id","اسم المنتج":"name","القسم":"cat","خصم":"disc","قيمه الخصم":"disc","الكميه":"minq","الحد الادني":"minq","تقطيع":"incl","العدد المشمول":"incl","علبه":"stock","شرايط":"sh","سعر العلبه":"price","سعر الشريط":"strip_price","رابط الصوره":"image"};
async function loadProducts(){
  const KEY = "mrad_products_cache", S = CFG.SHEET || {};
  const fromSheet = async ()=>{
    const tabs = S.TABS || [S.TAB||"Products"], out = [], seen = new Set(); let ok = 0;
    for(let ti=0; ti<tabs.length; ti++){
      try{
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${S.ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabs[ti])}&_=${Date.now()}`,{cache:"no-store"});
        if(!r.ok) throw new Error("sheet");
        const txt = await r.text(); ok++;
        if(seen.has(txt)) continue; seen.add(txt);
        const vals = parseCSV(txt), keys = (vals[0]||[]).map(hdrKey);
        if(ti===0) window.__HDR = (vals[0]||[]).map((h,i)=>String(h).trim()+"→"+(keys[i]||"؟")).join(" | ");
        vals.slice(1).forEach(v=>{ const o = Object.fromEntries(keys.map((k,i)=>[k||("x"+i),v[i]])); if(ti && o.id) o.id = "t"+ti+"-"+o.id; out.push(o); });
      }catch(e){}
    }
    if(!ok) throw new Error("sheet");
    return out;
  };
  const fromJson = async ()=>{ const r = await fetch(CFG.PRODUCTS_JSON||"data/products.json",{cache:"no-cache"}); if(!r.ok) throw new Error("json"); const j = await r.json(); return j.products||j; };
  let raw = null;
  try{
    raw = (CFG.PRODUCTS_SOURCE==="sheet" && S.ID) ? await fromSheet() : await fromJson();
    try{ localStorage.setItem(KEY, JSON.stringify(raw)); }catch(e){}
  }catch(e){
    try{ raw = JSON.parse(localStorage.getItem(KEY)||"null"); }catch(_){}
    if(!raw) raw = await fromJson().catch(()=>[]);
  }
  return raw.map(normProduct).filter(Boolean);
}
let lastSig = "", syncing = false, syncTimer = null;
const sig = list => JSON.stringify(list);
async function syncProducts(){
  if(syncing || document.hidden) return; syncing = true;
  try{
    const fresh = await loadProducts();
    if(!fresh.length) return;
    const sg = sig(fresh); if(sg === lastSig) return;
    const a = document.activeElement;
    if(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.id!=="q") return;   // المستخدم بيكتب كمية: نأجل للدورة الجاية
    lastSig = sg; PRODUCTS = fresh; BY = Object.fromEntries(PRODUCTS.map(p=>[p.id,p]));
    for(const k in cart){ if(!P(String(k).split(":")[0])) delete cart[k]; }
    refresh(); nameSearch();
    if(popId) renderPop();
    if(openCatName) { const y = $("catpage").scrollTop; renderCatList(openCatName); $("catpage").scrollTop = y; }
    if($("ov").classList.contains("show") && $("sheet").dataset.v==="cart") cartView();
    toast("تم تحديث الأسعار والمنتجات");
  }catch(e){} finally{ syncing = false; }
}
function startSync(){
  if(startSync.on) return; startSync.on = true;
  const ms = Math.max(10, +(CFG.SYNC_SECONDS||30)) * 1000;
  syncTimer = setInterval(syncProducts, ms);
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) syncProducts(); });
  window.addEventListener("online", syncProducts);
  window.addEventListener("focus", syncProducts);
}
async function boot(){
  $("grid").innerHTML = `<div class="empty" style="grid-column:1/-1">جاري تحميل المنتجات...</div>`;
  PRODUCTS = await loadProducts();
  BY = Object.fromEntries(PRODUCTS.map(p=>[p.id,p]));
  for(const k in cart){ if(!P(String(k).split(":")[0])) delete cart[k]; }
  refresh(); nameSearch(); setHH();
  lastSig = sig(PRODUCTS); startSync();
}

// ====== الحالة ======
let cart = {}, cat = "الكل", term = "";
try{ cart = JSON.parse(localStorage.getItem("mrad_cart")||"{}"); }catch(e){}
const $ = id => document.getElementById(id);

const save = () => { try{ localStorage.setItem("mrad_cart", JSON.stringify(cart)); }catch(e){} };
const fmt = n => n.toLocaleString("ar-EG") + " " + CURRENCY;
const n2 = v => Number(v).toLocaleString("ar-EG");

// تطبيع النص العربي عشان البحث يلاقي رغم اختلاف الهمزات والتشكيل
const norm = s => s.toLowerCase().replace(/[\u064B-\u0652\u0640]/g,"")
  .replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").trim();

// ====== العرض ======
function renderCats(){
  const cats = [...new Set(PRODUCTS.map(p=>p.cat))];
  $("cats").innerHTML = cats.map(c=>`<button class="c ${c===cat?"on":""}" data-c="${c}">
    <div class="pic">${svg(iconFor(c))}</div><b>${c}</b><small>${PRODUCTS.filter(p=>p.cat===c).length.toLocaleString("ar-EG")} منتج</small></button>`).join("");
}
function cardHTML(p){
  const q = (cart[p.id]||0) + (cart[p.id+":s"]||0);
  return `<div class="pcard ${p.out?"out":""}" data-open="${esc(p.id)}">
    <div class="pimg2">${thumb(p)}${p.out?`<span class="soldout">غير متوفر</span>`:""}${q?`<span class="incart">في السلة × ${n2(q)}</span>`:""}</div>
    <div class="pinfo"><b class="pn2">${esc(p.name)}</b>
    <div class="pp">${n2(p.price)} <small>${CURRENCY}</small></div></div>${discNote(p)}
  </div>`;
}
function grid(){
  renderCats();
  $("prodTitle").textContent = term ? "نتائج البحث" : (cat==="الكل" ? "كل المنتجات" : cat);
  $("allBtn").hidden = (cat==="الكل" && !term);
  const t = norm(term);
  const list = PRODUCTS.filter(p => (cat==="الكل"||p.cat===cat) && (!t || norm(p.name).includes(t) || norm(p.cat).includes(t)));
  $("count").textContent = list.length ? `${list.length.toLocaleString("ar-EG")} منتج` : "";
  $("grid").innerHTML = list.length ? list.map(cardHTML).join("")
  : `<div class="empty" style="grid-column:1/-1"><b>${svg("search")}</b>مفيش نتيجة لـ "${term}"<br>جرّب اسم تاني أو اختار قسم مختلف</div>`;
}
const parseK = k => { const [id,u] = String(k).split(":"); return {p:P(id), u:u==="s"?"s":"b"}; };
const unitPrice = k => { const {p,u} = parseK(k); return u==="s" ? stripPrice(p) : p.price; };
const label = k => { const {p,u} = parseK(k); return p.name + (u==="s" ? " (شريط)" : ""); };
function priceCalc(p,u,q){
  const up = u==="s" ? stripPrice(p) : p.price;
  if(u==="s" || !(p.disc>0) || q<p.minq) return q*up;
  const d = p.incl>0 ? Math.min(p.incl,q) : q;
  return Math.round((d*up*(1-p.disc/100) + (q-d)*up)*100)/100;
}
const lineTotal = k => { const {p,u} = parseK(k); return priceCalc(p,u,cart[k]); };
const discCond = p => ((p.minq>1?"عند شراء "+n2(p.minq)+" علب فأكثر":"") + (p.incl>0?" على "+n2(p.incl)+" علبة":"")).trim();
const discNote = p => p.disc>0 ? `<span class="dsc"><b>خصم ${n2(p.disc)}٪</b>${discCond(p)?`<small>${discCond(p)}</small>`:""}</span>` : "";
function totals(){
  let n=0,s=0; for(const k in cart){ n+=cart[k]; s+=lineTotal(k); }
  return {n,s};
}
function refresh(skip){
  const {n,s} = totals();
  $("badge").textContent = n.toLocaleString("ar-EG");
  $("badge").hidden = n===0; $("openCart").classList.toggle("has", n>0);
  $("bar").classList.toggle("show", n>0);
  $("barTxt").textContent = `إتمام الشراء (${n.toLocaleString("ar-EG")} منتج)`;
  $("barTot").textContent = fmt(s);
  if(!skip) grid(); save();
}
function change(key,d){
  const pp = P(String(key).split(":")[0]), kk = pp.strips>1?pp.strips:1;
  let q = (cart[key]||0)+d;
  if(String(key).endsWith(":s") && q>=kk){ delete cart[key]; key = pp.id; q = Math.floor(q/kk); toast("تم التحويل إلى علبة"); }
  if(key===pp.id && q>pp.stock){ q = pp.stock; toast("المتاح حاليًا: "+pp.stock.toLocaleString("ar-EG")); }
  cart[key] = q;
  if(cart[key]<=0) delete cart[key];
  refresh(true);
  const pid = String(key).split(":")[0];
  document.querySelectorAll(`.pcard[data-open="${pid}"]`).forEach(el=>{ const t=document.createElement("div"); t.innerHTML=cardHTML(P(pid)); const n=t.firstElementChild; n.classList.add("pop"); el.replaceWith(n); });
  const b=$("badge"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  if(d>0 && cart[key]===d) toast("تمت إضافة "+label(key));
  if($("ov").classList.contains("show") && $("sheet").dataset.v==="cart") cartView();
}
let toastT;
function toast(m){ const t=$("toast"); t.textContent=m; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1500); }

// ====== السلة وإتمام الشراء ======
function open(v){ $("sheet").dataset.v=v; $("ov").classList.add("show"); }
function close(){ $("ov").classList.remove("show"); }
function cartView(){
  open("cart");
  const ids = Object.keys(cart), {s} = totals();
  $("sheet").innerHTML = `<h2>سلة المشتريات <button class="x" data-a="close" aria-label="إغلاق">✕</button></h2>` +
  (ids.length ? ids.map(id=>{const p=parseK(id).p;return `<div class="row"><div class="e">${thumb(p)}</div>
     <div class="t">${label(id)}<small>${fmt(unitPrice(id))}${lineTotal(id)<cart[id]*unitPrice(id)?" · بعد الخصم "+fmt(lineTotal(id)):""}</small></div>
     <div class="qty"><button data-a="plus" data-i="${id}">+</button><span>${cart[id].toLocaleString("ar-EG")}</span><button data-a="minus" data-i="${id}">−</button></div></div>`}).join("") +
     `<div class="total"><span>الإجمالي</span><span>${fmt(s)}</span></div>
      <button class="go" data-a="checkout">متابعة لإتمام الطلب</button>
      <button class="ghost" data-a="clear">إفراغ السلة</button>`
   : `<div class="empty"><b>${svg("cart")}</b>السلة فاضية، ابحث عن منتج وأضفه</div>`);
}
function checkoutView(){
  open("checkout");
  $("sheet").innerHTML = `<h2>بيانات الطلب <button class="x" data-a="close" aria-label="إغلاق">✕</button></h2>
   <div class="total"><span>الإجمالي</span><span>${fmt(totals().s)}</span></div>
   <div class="f">
     <input id="fn" placeholder="الاسم بالكامل" autocomplete="name" value="${esc(PF().name)}">
     <input id="fp" type="tel" inputmode="tel" placeholder="رقم الموبايل" autocomplete="tel" value="${esc(PF().phone)}">
     <textarea id="fa" rows="3" placeholder="العنوان بالتفصيل">${esc(PF().addr)}</textarea>
     <textarea id="fo" rows="2" placeholder="ملاحظات (اختياري)"></textarea>
     <div class="err" id="err">من فضلك اكتب الاسم ورقم الموبايل والعنوان.</div>
   </div>
   <button class="go" data-a="send">تأكيد الطلب</button>
   <button class="ghost" data-a="cartv">رجوع للسلة</button>`;
}
function send(){
  const n=$("fn").value.trim(), p=$("fp").value.trim(), a=$("fa").value.trim(), o=$("fo").value.trim();
  if(!n||!p||!a){ $("err").style.display="block"; return; }
  const {s} = totals();
  let msg = `*طلب جديد - صيدليات د/ مراد صادق*\n\n`;
  for(const id in cart) msg += `• ${label(id)} × ${cart[id]} = ${lineTotal(id)} ${CURRENCY}\n`;
  msg += `\n*الإجمالي: ${s} ${CURRENCY}*\n\nالاسم: ${n}\nالموبايل: ${p}\nالعنوان: ${a}` + (o?`\nملاحظات: ${o}`:"");
  window.open(`https://wa.me/${PHARMACY_PHONE}?text=${encodeURIComponent(msg)}`,"_blank");
  saveOrder(s); sv("mrad_profile",{name:n,phone:p,addr:a});
  cart = {}; refresh();
  $("sheet").innerHTML = `<div class="done"><b>${svg("check")}</b><h2 style="border:0;justify-content:center">تم تجهيز طلبك</h2>
    <p style="color:var(--gr)">أكمل إرسال الرسالة في واتساب وهنتواصل معاك لتأكيد التوصيل.</p></div>
    <button class="go" data-a="close">تمام</button>`;
}

// ====== الأحداث ======
let openCatName = null;
const setHH = () => { const h = document.querySelector("header"); if(h) document.documentElement.style.setProperty("--hh", h.offsetHeight+"px"); };
window.addEventListener("resize", setHH); window.addEventListener("load", setHH);
function renderCatList(c){
  const list = PRODUCTS.filter(p=>p.cat===c);
  $("catTitle").textContent = c; $("catCount").textContent = list.length.toLocaleString("ar-EG")+" منتج";
  $("catlist").innerHTML = list.map(rowHTML).join("");
}
function openCat(c){
  openCatName = c; setHH();
  const list = PRODUCTS.filter(p=>p.cat===c);
  $("catTitle").textContent = c; $("catCount").textContent = list.length.toLocaleString("ar-EG")+" منتج";
  $("catlist").innerHTML = list.map(rowHTML).join("");
  $("catpage").hidden = false; $("catpage").scrollTop = 0;
}
$("catBack").onclick = ()=>{ $("catpage").hidden = true; openCatName = null; };
$("cats").addEventListener("click", e=>{
  const b = e.target.closest("[data-c]"); if(b) openCat(b.dataset.c);
});
$("allBtn").onclick = ()=>{ cat="الكل"; term=""; $("q").value=""; grid(); };
$("openCart").onclick = cartView;
$("barBtn").onclick = cartView;
$("ov").addEventListener("click", e=>{ if(e.target.id==="ov") close(); });
document.addEventListener("click", e=>{
  const b = e.target.closest("[data-a]"); if(!b) return;
  const a=b.dataset.a, i=b.dataset.i;
  if(a==="plus") change(i,1);
  else if(a==="minus") change(i,-1);
  else if(a==="close") close();
  else if(a==="checkout") checkoutView();
  else if(a==="cartv") cartView();
  else if(a==="send") send();
  else if(a==="clear"){ cart={}; refresh(); cartView(); }
});
document.addEventListener("keydown", e=>{ if(e.key==="Escape") close(); });

// ====== شريط العروض ======
const AUTO_MS = 3000;   // التنقل التلقائي كل 3 ثواني
const USER_MS = 5000;   // بعد تحريك العميل بإيده: ينتظر 5 ثواني
const track = $("track"), real = [...track.children], N = real.length;
// نسخة من آخر عرض في البداية ونسخة من أول عرض في النهاية => دوران لا نهائي في الاتجاهين
const mk = el => { const c = el.cloneNode(true); c.setAttribute("aria-hidden","true"); c.tabIndex = -1; return c; };
track.prepend(mk(real[N-1])); track.append(mk(real[0]));
const slides = [...track.children];            // [نسخة آخر، 1..N، نسخة أول]
$("dots").innerHTML = real.map(()=>"<i></i>").join("");
const dots = [...$("dots").children];
let cur = 0, timer = null, tok = 0, ticking = false;

const realIdx = i => ((i-1)%N+N)%N;
const mark = i => { cur = realIdx(i); dots.forEach((d,k)=>d.classList.toggle("on",k===cur)); };
const offset = i => { const t=track.getBoundingClientRect(), r=slides[i].getBoundingClientRect(); return (r.left+r.width/2)-(t.left+t.width/2); };
function nearest(){
  const t=track.getBoundingClientRect(), c=t.left+t.width/2; let best=0, bd=1e9;
  slides.forEach((s,k)=>{ const r=s.getBoundingClientRect(), d=Math.abs(r.left+r.width/2-c); if(d<bd){bd=d;best=k;} });
  return best;
}
// تأثير الانتقال: العرض الخارج بيصغر ويخفت ويرجع لورا، والداخل بيكبر ويظهر
function fx(){
  const t=track.getBoundingClientRect(), c=t.left+t.width/2;
  slides.forEach(s=>{
    const r=s.getBoundingClientRect(), d=Math.min(1,Math.abs(r.left+r.width/2-c)/t.width);
    s.style.transform = `scale(${1-0.14*d})`;
    s.style.opacity = 1-0.6*d;
  });
}
// نقل فوري (بدون حركة) لعرض معين ويتوسط
function jumpTo(i){ track.scrollLeft += offset(i); mark(i); fx(); }
// النسخة مطابقة للعرض الحقيقي، فننقل الصفحة بنفس المسافة بالظبط: الانتقال غير ملحوظ
function wrapCheck(){
  const n = nearest();
  if(n !== 0 && n !== N+1) return false;
  const tgt = n === 0 ? N : 1;
  track.scrollLeft += slides[tgt].offsetLeft - slides[n].offsetLeft;   // offsetLeft مش بيتأثر بالتصغير
  mark(tgt); fx();
  return true;
}
function animateBy(delta, ms=600){
  const my = ++tok, start = track.scrollLeft, t0 = performance.now();
  (function f(now){
    if(my !== tok) return;
    const p = Math.min(1,(now-t0)/ms), e = p<.5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2;
    track.scrollLeft = start + delta*e;
    if(p<1) requestAnimationFrame(f); else wrapCheck();
  })(t0);
}
function step(){
  wrapCheck();
  animateBy(offset(nearest()+1));
  schedule(AUTO_MS);
}
function schedule(ms){ clearTimeout(timer); if(document.body.dataset.view !== "home") return; timer = setTimeout(step, ms); }
const stop = () => { clearTimeout(timer); tok++; };

track.addEventListener("scroll", ()=>{
  if(ticking) return; ticking = true;
  requestAnimationFrame(()=>{ ticking = false; fx(); const n = nearest(); if(realIdx(n) !== cur) mark(n); });
},{passive:true});

// ====== السحب باليد: كل سحبة = عرض واحد بالظبط مهما كانت قوتها ======
let drag = null, wasDrag = false;
track.addEventListener("pointerdown", e=>{
  if(e.pointerType === "mouse" && e.button !== 0) return;
  stop(); wrapCheck();
  drag = {x:e.clientX, sl:track.scrollLeft, i:nearest(), t:performance.now(), moved:false, id:e.pointerId};
});
track.addEventListener("pointermove", e=>{
  if(!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  if(!drag.moved){ if(Math.abs(dx) < 6) return; drag.moved = true; try{ track.setPointerCapture(e.pointerId); }catch(_){} }
  track.scrollLeft = drag.sl - dx;     // العرض يتبع إصبعك
});
function endDrag(e){
  if(!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if(d.moved){
    wasDrag = true; setTimeout(()=>{ wasDrag = false; }, 0);
    const dx = e.clientX - d.x, v = dx / Math.max(1, performance.now()-d.t), w = track.clientWidth;
    let target = d.i;
    if(Math.abs(dx) > w*0.15 || Math.abs(v) > 0.3) target = d.i + (dx > 0 ? 1 : -1);   // أقصى حد: عرض واحد
    animateBy(offset(target), 380);
  }
  schedule(USER_MS);
}
track.addEventListener("pointerup", endDrag);
track.addEventListener("pointercancel", endDrag);
document.addEventListener("visibilitychange", ()=>document.hidden?stop():schedule(AUTO_MS));
window.addEventListener("resize", ()=>jumpTo(Math.min(Math.max(nearest(),1),N)));
track.addEventListener("click", e=>{
  if(wasDrag) return;
  const s = e.target.closest(".slide"); if(!s) return;
  show("search"); setTab("name"); $("q").value = s.dataset.q; nameSearch();
});
jumpTo(1);                                             // ابدأ على أول عرض حقيقي
window.addEventListener("load", ()=>{ if(!drag && nearest()===0) jumpTo(1); });
schedule(AUTO_MS);


// ====== التنقل السفلي: الرئيسية / حسابي / الإعدادات ======
const ld = (k,d) => { try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } };
const sv = (k,v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const esc = t => String(t||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const PF = () => ld("mrad_profile",{name:"",phone:"",addr:""});
function saveOrder(total){
  const list = ld("mrad_orders",[]);
  const items = Object.keys(cart).map(id=>`${label(id)} × ${cart[id]}`);
  list.unshift({d:new Date().toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric"}), total, items});
  sv("mrad_orders", list.slice(0,20));
}
function accountView(){
  const p = PF(); $("an").value = p.name; $("ap").value = p.phone; $("aa").value = p.addr; $("pok").textContent = "";
  const list = ld("mrad_orders",[]);
  $("orders").innerHTML = list.length ? list.map(o=>`<div class="ord"><div>${esc(o.d)}<small>${o.items.map(esc).join("، ")}</small></div><b>${fmt(o.total)}</b></div>`).join("")
    : `<div class="empty" style="padding:20px 0"><b>${svg("receipt")}</b>لسه ما عملتش أي طلب</div>`;
}
const VIEWS = ["home","search","account","settings"];
function show(v){
  $("catpage").hidden = true; openCatName = null;
  VIEWS.forEach(x=>{ $("v-"+x).hidden = (x!==v); });
  document.body.dataset.view = v;
  $("nav").querySelectorAll("button").forEach(b=>b.classList.toggle("on", b.dataset.v===v));
  $("ind").style.transform = `translateX(${-100*VIEWS.indexOf(v)}%)`;
  const vw=$("v-"+v); vw.style.animation="none"; void vw.offsetWidth; vw.style.animation="";
  window.scrollTo(0,0);
  if(v==="home"){ requestAnimationFrame(()=>{ jumpTo(1); schedule(AUTO_MS); }); } else stop();
  if(v==="account") accountView();
}
$("nav").addEventListener("click", e=>{ const b=e.target.closest("[data-v]"); if(b) show(b.dataset.v); });
$("saveProfile").onclick = ()=>{
  sv("mrad_profile",{name:$("an").value.trim(),phone:$("ap").value.trim(),addr:$("aa").value.trim()});
  $("pok").textContent = "✓ تم حفظ بياناتك، وهتتعبى تلقائي في الطلب الجاي";
};
// الإعدادات
function setFs(px){ document.documentElement.style.fontSize = px+"px"; sv("mrad_fs",px); [...$("fsz").children].forEach(b=>b.classList.toggle("on", +b.dataset.f===+px)); }
$("fsz").addEventListener("click", e=>{ const b=e.target.closest("[data-f]"); if(b) setFs(b.dataset.f); });
setFs(ld("mrad_fs",16));
$("waLink").href = "https://wa.me/"+PHARMACY_PHONE;
$("telLink").href = "tel:+"+PHARMACY_PHONE;
$("wipe").onclick = ()=>{
  if(!confirm("هتتمسح بياناتك وطلباتك والسلة. متأكد؟")) return;
  try{ ["mrad_profile","mrad_orders","mrad_cart","mrad_fs"].forEach(k=>localStorage.removeItem(k)); }catch(e){}
  cart = {}; refresh(); setFs(16);
};
document.body.dataset.view = "home";


// ====== البحث بالاسم + التصوير ======
const pick = {};
const getPick = id => pick[id] || (pick[id] = {u:"b", n:1});
function rowHTML(p){ return cardHTML(p); }
const toNum = s => parseInt(String(s).replace(/[٠-٩]/g,x=>"٠١٢٣٤٥٦٧٨٩".indexOf(x)).replace(/\D/g,""),10)||1;
function fixPick(p,pk){
  const k = p.strips>1?p.strips:1, max = p.stock*(pk.u==="s"?k:1);
  pk.n = Math.max(1,pk.n);
  if(pk.n>max){ pk.n = Math.max(1,max); toast("المتاح حاليًا: "+(pk.u==="s"?max:p.stock).toLocaleString("ar-EG")); }
  if(pk.u==="s" && pk.n>=k){ pk.u="b"; pk.n = Math.floor(pk.n/k); toast("تم التحويل إلى علبة"); }
}
function addPick(p,pk){
  const k = p.strips>1?p.strips:1, id = p.id;
  let T = (cart[id]||0)*k + (cart[id+":s"]||0) + (pk.u==="s"?pk.n:pk.n*k);
  if(T>p.stock*k){ T = p.stock*k; toast("المتاح حاليًا: "+p.stock.toLocaleString("ar-EG")); }
  delete cart[id]; delete cart[id+":s"];
  if(k>1 && T<k) cart[id+":s"] = T; else cart[id] = Math.floor(T/k);
  refresh(); toast("تمت إضافة "+p.name);
}
// ====== نافذة المنتج المكبّرة ======
let popId = null;
function popHTML(p){
  const pk = getPick(p.id), k = p.strips, isS = pk.u==="s" && k>1, up = isS ? stripPrice(p) : p.price;
  const tot = priceCalc(p,pk.u,pk.n), save = Math.round((pk.n*up - tot)*100)/100, d = p.out?"disabled":"";
  let dsc = "";
  if(p.disc>0){
    let st;
    if(isS) st = `<em class="off">الخصم على العلب فقط</em>`;
    else if(pk.n>=p.minq) st = `<em>✓ تم تطبيق الخصم على طلبك</em>`;
    else st = `<em class="off">زوّد ${n2(p.minq-pk.n)} ${p.minq-pk.n<=10?"علب":"علبة"} كمان عشان تاخد الخصم</em>`;
    dsc = `<div class="dsc big"><b>خصم ${n2(p.disc)}٪</b>${discCond(p)?`<small>${discCond(p)}</small>`:""}${st}</div>`;
  }
  const low = !p.out && p.stock<=5 ? `<div class="stocknote">متبقي ${n2(p.stock)} فقط</div>` : "";
  return `<button class="pclose" data-pa="close" aria-label="إغلاق">✕</button>
  <div class="pscroll">
    <div class="pbig">${thumb(p)}</div>
    <div class="pbody">
      <div class="pcat">${esc(p.cat)}</div>
      <h3 class="ptitle">${esc(p.name)}</h3>
      <div class="pprice">${n2(up)} <small>${CURRENCY} / ${isS?"شريط":"علبة"}</small></div>
      ${low}${dsc}
      ${k>1?`<div class="plabel">اشتري بـ</div><div class="useg">
        <button data-pa="ub" class="${isS?"":"on"}"><b>علبة</b><small>${fmt(p.price)}</small></button>
        <button data-pa="us" class="${isS?"on":""}"><b>شريط</b><small>${fmt(stripPrice(p))}</small></button></div>`:""}
      <div class="plabel">الكمية</div>
      <div class="qbig"><button data-pa="dec" ${d} aria-label="نقص">−</button><input class="pqin" data-pa="inp" inputmode="numeric" value="${n2(pk.n)}" ${d}><button data-pa="inc" ${d} aria-label="زيادة">+</button></div>
      ${DEBUG?`<pre class="dbg" id="dbgimg">${esc(dbgText(p))}</pre>`:""}
    </div>
  </div>
  <div class="pfoot"><div class="ptot"><small>الإجمالي</small><b>${fmt(tot)}</b>${save>0?`<em>وفّرت ${fmt(save)}</em>`:""}</div>
    <button class="padd" data-pa="add" ${d}>${p.out?"غير متوفر":"أضف للسلة"}</button></div>`;
}
function renderPop(){
  const p = P(popId); if(!p){ closePop(); return; }
  const old = $("psheet").querySelector(".pscroll"), y = old ? old.scrollTop : 0;
  $("psheet").innerHTML = popHTML(p);
  $("psheet").querySelector(".pscroll").scrollTop = y;
}
function openProduct(id){
  const p = P(id); if(!p) return;
  popId = id; const pk = getPick(id); pk.n = 1; pk.u = "b";
  renderPop(); $("pov").classList.add("show");
}
function rerenderLists(){
  if(openCatName){ const y = $("catpage").scrollTop; renderCatList(openCatName); $("catpage").scrollTop = y; }
  nameSearch(); grid();
}
function closePop(){ popId = null; $("pov").classList.remove("show"); rerenderLists(); }
$("pov").addEventListener("click", e=>{ if(e.target.id==="pov") closePop(); });
$("psheet").addEventListener("click", e=>{
  const b = e.target.closest("[data-pa]"); if(!b || b.tagName==="INPUT") return;
  const a = b.dataset.pa, p = P(popId); if(!p) return;
  const pk = getPick(popId);
  if(a==="close"){ closePop(); return; }
  if(a==="ub"){ pk.u="b"; pk.n=1; } else if(a==="us"){ pk.u = p.strips>1?"s":"b"; pk.n=1; }
  else if(a==="inc") pk.n++; else if(a==="dec") pk.n--;
  if(a==="add"){ addPick(p,pk); pk.n=1; pk.u="b"; closePop(); return; }
  fixPick(p,pk); renderPop();
});
$("psheet").addEventListener("change", e=>{
  if(e.target.dataset && e.target.dataset.pa==="inp"){ const p = P(popId); if(!p) return; const pk = getPick(popId); pk.n = toNum(e.target.value); fixPick(p,pk); renderPop(); }
});
document.addEventListener("click", e=>{
  const c = e.target.closest("[data-open]"); if(c) openProduct(c.dataset.open);
});
function nameSearch(){
  const raw = $("q").value, t = norm(raw).split(/\s+/).filter(Boolean), box = $("sres");
  if(!t.length){ box.innerHTML = `<div class="empty"><b>${svg("search")}</b>اكتب اسم الدواء أو المنتج (عربي أو إنجليزي)</div>`; return; }
  const list = PRODUCTS.filter(p=>{ const h = norm(p.name+" "+p.alias+" "+p.cat); return t.every(w=>h.includes(w)); }).slice(0,40);
  box.innerHTML = list.length ? list.map(rowHTML).join("") : `<div class="empty"><b>${svg("search")}</b>مفيش نتيجة لـ "${esc(raw)}"<br>جرّب اسم تاني أو صوّر العلبة</div>`;
}
$("q").addEventListener("input", nameSearch);
function setTab(t){
  $("stabs").querySelectorAll("button").forEach(b=>b.classList.toggle("on", b.dataset.t===t));
  $("t-name").hidden = t!=="name"; $("t-scan").hidden = t!=="scan";
}
$("stabs").addEventListener("click", e=>{ const b=e.target.closest("[data-t]"); if(b) setTab(b.dataset.t); });
nameSearch();

// --- التعرف على الأسماء من النص ---
const STOP = new Set(["مجم","قرص","اقراص","شراب","كبسولات","مضاد","حيوي","للشعر","للقشرة","للبرد","للوجه","للبشره","كريم","زيت","جهاز","سيروم","معجون","اسنان","بلسم","غسول","قياس","اطفال","فيتامين","vitamin","شامبو","tablets","tablet"]);
function lev(a,b){
  if(Math.abs(a.length-b.length)>2) return 9;
  const m=[...Array(b.length+1).keys()];
  for(let i=1;i<=a.length;i++){ let prev=m[0]; m[0]=i; for(let j=1;j<=b.length;j++){ const t=m[j]; m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1)); prev=t; } }
  return m[b.length];
}
function matchText(text){
  const nt = norm(text), words = [...new Set(nt.split(/[^a-z0-9\u0621-\u064A]+/).filter(w=>w.length>=4))], out = [];
  PRODUCTS.forEach(p=>{
    const toks = [...new Set(norm(p.name+" "+p.alias).split(/\s+/).filter(t=>t.length>=4 && !/^\d+$/.test(t) && !STOP.has(t)))];
    let sc = 0;
    toks.forEach(t=>{ if(nt.includes(t)) sc+=2; else if(t.length>=5 && words.some(w=>lev(w,t) <= (t.length>=7?2:1))) sc+=1; });
    if(sc>0) out.push({p,sc});
  });
  return out.sort((a,b)=>b.sc-a.sc).slice(0,10).map(r=>r.p);
}
// --- قراءة الصورة ---
let tesLoad = null;
function loadTes(){
  return tesLoad || (tesLoad = new Promise((res,rej)=>{
    if(window.Tesseract) return res();
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js";
    sc.onload = res; sc.onerror = ()=>{ tesLoad=null; rej(new Error("load")); };
    document.head.appendChild(sc);
  }));
}
function prepImage(file){
  return new Promise((res,rej)=>{
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = ()=>{ const k = Math.min(1, 1600/Math.max(im.width,im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width*k); c.height = Math.round(im.height*k); c.getContext("2d").drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(u); res(c); };
    im.onerror = rej; im.src = u;
  });
}
async function readText(canvas, prog){
  if(RECOGNIZE_URL){
    const r = await fetch(RECOGNIZE_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:canvas.toDataURL("image/jpeg",.85)})});
    const j = await r.json(); return (j.names||[]).join("\n")+"\n"+(j.text||"");
  }
  prog(0,"جاري تجهيز قارئ النصوص (أول مرة بياخد وقت)...");
  await loadTes();
  const r = await Tesseract.recognize(canvas,"ara+eng",{logger:m=>{ if(m.status==="recognizing text") prog(m.progress,"جاري قراءة الصورة..."); }});
  return r.data.text;
}
async function scan(file){
  if(!file) return;
  const stat=$("stat"), pgb=$("pgb"), stx=$("stx"), out=$("scanRes");
  out.innerHTML=""; stat.hidden=false; pgb.style.width="3%"; stx.textContent="جاري تحضير الصورة...";
  try{
    const c = await prepImage(file);
    $("prev").src = c.toDataURL("image/jpeg",.7); $("prev").hidden = false;
    const text = await readText(c,(p,m)=>{ pgb.style.width = Math.max(3,Math.round(p*100))+"%"; stx.textContent = m; });
    const list = matchText(text);
    stat.hidden = true;
    out.innerHTML = list.length
      ? `<div class="found"><h2>لقينا ${list.length.toLocaleString("ar-EG")} ${list.length>2?"أدوية":"دواء"}</h2></div>`+list.map(rowHTML).join("")+
        `<button class="go" id="addAll">أضف الكل للسلة</button>`+rawBox(text)
      : `<div class="empty"><b>${svg("search")}</b>مقدرناش نتعرف على اسم دواء واضح<br>جرب صورة أقرب وأوضح، أو ابحث بالاسم</div><button class="go" id="toName">ابحث بالاسم</button>`+rawBox(text);
    out._list = list;
  }catch(err){
    stat.hidden = true;
    out.innerHTML = `<div class="empty"><b>${svg("alert")}</b>حصلت مشكلة في قراءة الصورة (محتاجة إنترنت).<br>جرب تاني أو ابحث بالاسم</div><button class="go" id="toName">ابحث بالاسم</button>`;
  }
}
const rawBox = t => t.trim() ? `<details class="raw"><summary>النص اللي اتقرا من الصورة</summary><pre>${esc(t.trim())}</pre></details>` : "";
$("fcam").addEventListener("change", e=>{ scan(e.target.files[0]); e.target.value=""; });
$("fgal").addEventListener("change", e=>{ scan(e.target.files[0]); e.target.value=""; });
$("scanRes").addEventListener("click", e=>{
  if(e.target.id==="toName"){ setTab("name"); $("q").focus(); }
  if(e.target.id==="addAll"){
    const list = $("scanRes")._list || []; let n=0;
    list.forEach(p=>{ if(p.out) return; const pk=getPick(p.id); addPick(p,pk); pk.n=1; pk.u="b"; n++; });
    $("scanRes").querySelectorAll(".pcard").forEach(r=>{ const t=document.createElement("div"); t.innerHTML=cardHTML(P(r.dataset.open)); r.replaceWith(t.firstElementChild); });
    toast("تمت إضافة "+n.toLocaleString("ar-EG")+" صنف للسلة");
  }
});

fillIcons(); boot();

// ====== النسخة والتحديث (PWA) ======
(()=>{ let n=0,t; $("ver").addEventListener("click",()=>{ n++; clearTimeout(t); t=setTimeout(()=>n=0,3000);
  if(n>=5){ n=0; DEBUG=!DEBUG; try{ localStorage.setItem("mrad_debug",DEBUG?"1":"0"); }catch(e){} toast(DEBUG?"وضع الفحص: شغال":"وضع الفحص: مقفول"); } }); })();
$("ver").textContent = "الإصدار " + (CFG.APP_VERSION||"1.0.0") + " · " + (CFG.BUILD||"dev");
function showUpdate(w){
  $("upd").hidden = false;
  $("updBtn").onclick = ()=>{ $("updBtn").textContent = "جاري التحديث..."; w.postMessage({type:"SKIP_WAITING"}); };
}
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  let reg = null, reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{ if(!reloading){ reloading = true; location.reload(); } });
  navigator.serviceWorker.register("sw.js").then(r=>{
    reg = r;
    if(r.waiting && navigator.serviceWorker.controller) showUpdate(r.waiting);
    r.addEventListener("updatefound", ()=>{ const w = r.installing; w.addEventListener("statechange", ()=>{ if(w.state==="installed" && navigator.serviceWorker.controller) showUpdate(w); }); });
    setInterval(()=>r.update(), 30*60*1000);
  }).catch(()=>{});
  $("chkUpd").onclick = async ()=>{
    if(!reg){ toast("التحديث متاح على النسخة المنشورة بس"); return; }
    try{ await reg.update(); }catch(e){}
    toast(reg.installing || reg.waiting ? "في نسخة جديدة، هتظهر لك رسالة التحديث" : "أنت على آخر نسخة");
  };
} else { $("chkUpd").onclick = ()=>toast("التحديث متاح على النسخة المنشورة بس"); }


// ====== الإعدادات (من ملف config.js) ======
const CFG = window.APP_CONFIG || {};
const PHARMACY_PHONE = CFG.PHARMACY_PHONE || "";
const CURRENCY = CFG.CURRENCY || "ج.م";
const RECOGNIZE_URL = CFG.RECOGNIZE_URL || "";

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
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
const offerTag = p => p.offer ? `<span class="offer">${esc(p.offer)}</span>` : "";
const thumb = p => `<span class="th">${svg(iconFor(p.cat))}${p.img?`<img src="${esc(p.img)}" data-alts="${esc((p.alts||[]).join("|"))}" alt="" referrerpolicy="no-referrer" onerror="imgFail(this)">`:""}</span>`;
const fillIcons = () => document.querySelectorAll("[data-ic]").forEach(e=>{ e.innerHTML = svg(e.dataset.ic); });

// ====== المنتجات: بتتحمل من data/products.json أو من Google Sheet ======
let PRODUCTS = [], BY = {};
const P = id => BY[id];
const stripPrice = p => p.stripPrice || Math.round(p.price/p.strips);
function driveAlts(u){
  u=String(u||"").trim(); const m=u.match(/\/d\/([\w-]{10,})/)||u.match(/[?&]id=([\w-]{10,})/);
  return (m && /drive\.google|docs\.google/.test(u)) ? ["https://lh3.googleusercontent.com/d/"+m[1]+"=w500","https://drive.google.com/uc?export=view&id="+m[1]] : [];
}
function imgFail(im){ const a=(im.dataset.alts||"").split("|").filter(Boolean); if(a.length){ im.dataset.alts=a.slice(1).join("|"); im.src=a[0]; } else im.remove(); }
function driveImg(u){
  u=String(u||"").trim(); if(!u) return "";
  const m=u.match(/\/d\/([\w-]{10,})/)||u.match(/[?&]id=([\w-]{10,})/);
  if(m && /drive\.google|docs\.google/.test(u)) return "https://drive.google.com/thumbnail?id="+m[1]+"&sz=w500";
  return /^https?:/.test(u) ? u : "assets/products/"+u;
}
function normProduct(r,i){
  const num = v => { const n = parseFloat(String(v==null?"":v).replace(/[^\d.]/g,"")); return isFinite(n)?n:0; };
  const name = String(r.name||"").trim(); if(!name) return null;
  const drw = String(r.disc==null?"":r.disc);
  // الخصم دايمًا نسبة مئوية: ١٠ أو ١٠٪ = ١٠٪، وكمان ٠.١ (اللي جوجل شيت بيطلعه لخلية نسبة) = ١٠٪
  let dv = num(drw); if(!/[%٪]/.test(drw) && dv>0 && dv<1) dv = Math.round(dv*100); dv = Math.min(100,dv); const dpct = true;
  const sh = /^\s*\d+(\.\d+)?\s*$/.test(String(r.sh||"")) ? num(r.sh) : 0;     // رقم أكبر من صفر فقط = في شرايط
  const k = sh>0 ? Math.max(1,Math.floor(sh)) : 1;
  const stock = Math.max(0,Math.floor(/^\s*\d+\s*$/.test(String(r.stock||"")) ? num(r.stock) : 0));   // فاضي/كلام = غير متوفر
  return { id:String(r.id||("p"+(i+1))).trim(), name, cat:String(r.cat||"").replace(/\s+/g," ").trim(), offer:offerOf(r.offer)||(dv>0?"عرض خاص":""), disc:dv, discPct:dpct, min:Math.max(1,Math.floor(num(r.min))||1), inc:Math.max(0,Math.floor(num(r.inc))||0), price:num(r.price), strips:k, stripPrice:num(r.strip_price),
    img:driveImg(r.image), alts:driveAlts(r.image), alias:String(r.alias||"").trim(), stock, out:stock<=0 };
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
// الأعمدة: عمود القسم ("لينك القسم" أو "القسم") بعد "رابط الصوره": اللي بيتكتب جنب كل منتج هو اسم القسم، والأقسام بتتكوّن منه تلقائي.
const HK = {"الرقم":"id","اسم المنتج":"name","علبه":"stock","شرايط":"sh","سعر العلبه":"price","سعر الشريط":"strip_price","رابط الصوره":"image","لينك القسم":"cat","رابط القسم":"cat","القسم":"cat","لينك الصوره":"image","الصوره":"image","صوره":"image","عرض خاص":"offer","عرض":"offer","قيمه الخصم":"disc","الخصم":"disc","الحد الادني":"min","الحد الادنى":"min","العدد المشمول":"inc","العدد المشمول بالخصم":"inc","عدد العلب المشمول":"inc","الاسم بالانجليزي":"alias","الاسم الانجليزي":"alias","اسم انجليزي":"alias","الاسم العلمي":"alias","الاسم التجاري":"alias","english":"alias","name_en":"alias"};
// عمود "عرض خاص": أي قيمة معناها نعم => العرض شغال. لو اتكتب نص مخصص (مثلا "خصم ٢٠٪") بيظهر هو بدل "عرض خاص"
const offerOf = v => { v=String(v==null?"":v).trim(); if(!v || /^(0|لا|no|false|-|x)$/i.test(norm(v))) return ""; return /^(1|نعم|yes|true|✓|✔|عرض|عرض خاص|اوفر|offer)$/i.test(norm(v)) ? "عرض خاص" : v; };
async function loadProducts(){
  const KEY = "mrad_products_cache", S = CFG.SHEET || {};
  const fromSheet = async ()=>{
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${S.ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(S.TAB||"Products")}&_=${Date.now()}`,{cache:"no-store"});
    if(!r.ok) throw new Error("sheet");
    const vals = parseCSV(await r.text()), keys = (vals[0]||[]).map(x=>HK[norm(String(x)).replace(/\s+/g," ")]||"");
    return vals.slice(1).map(v=>Object.fromEntries(keys.map((k,i)=>[k||("x"+i),v[i]])));
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
// تحديث فوري: بنسحب الشيت كل ١٠ ثواني وكل ما التطبيق يرجع للشاشة، ولو في تغيير بنحدّث الأقسام والمنتجات من غير ما تقفل التطبيق
let lastSig = "", syncing = false;
async function syncProducts(){
  if(syncing) return; syncing = true;
  try{
    const list = await loadProducts(), sig = JSON.stringify(list);
    if(sig === lastSig) return;                 // مفيش تغيير: متلمسش الشاشة
    lastSig = sig; PRODUCTS = list;
    // الأقسام من عمود القسم: نفس الاسم (بغض النظر عن الهمزة/المسافات) = قسم واحد. لو مفيش ولا قسم في الشيت => "أدوية"
    const seen = {}, any = PRODUCTS.some(p=>p.cat);
    PRODUCTS.forEach(p=>{ if(!p.cat) p.cat = any ? "أخرى" : "أدوية"; const k = norm(p.cat); p.cat = seen[k] || (seen[k] = p.cat); });
    BY = Object.fromEntries(PRODUCTS.map(p=>[p.id,p]));
    for(const k in cart){ if(!P(String(k).split(":")[0])) delete cart[k]; }
    refresh();
    if(!$("v-search").hidden) nameSearch();
    if(!$("v-cat").hidden){ if(PRODUCTS.some(p=>p.cat===curCat)) catSearch(); else show("home"); }
    if($("ov").classList.contains("show") && $("sheet").dataset.v==="cart") cartView();
  } finally { syncing = false; }
}
const boot = () => syncProducts().catch(()=>{});
setInterval(()=>{ if(!document.hidden) syncProducts().catch(()=>{}); }, 10000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) syncProducts().catch(()=>{}); });
window.addEventListener("focus", ()=>syncProducts().catch(()=>{}));
window.addEventListener("online", ()=>syncProducts().catch(()=>{}));

// ====== الحالة ======
let cart = {};
try{ cart = JSON.parse(localStorage.getItem("mrad_cart")||"{}"); }catch(e){}
const $ = id => document.getElementById(id);

const save = () => { try{ localStorage.setItem("mrad_cart", JSON.stringify(cart)); }catch(e){} };
const fmt = n => n.toLocaleString("ar-EG") + " " + CURRENCY;

// تطبيع النص العربي عشان البحث يلاقي رغم اختلاف الهمزات والتشكيل
const norm = s => s.toLowerCase().replace(/[\u064B-\u0652\u0640]/g,"")
  .replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").trim();

// ====== العرض ======
function renderCats(){
  const cats = [...new Set(PRODUCTS.map(p=>p.cat))];
  $("cats").innerHTML = cats.map(c=>`<button class="c" data-c="${esc(c)}">
    <div class="pic">${svg(iconFor(c))}</div><b>${esc(c)}</b><small>${PRODUCTS.filter(p=>p.cat===c).length.toLocaleString("ar-EG")} منتج</small></button>`).join("");
}

function cardHTML(p){
    const q = cart[p.id]||0;
    return `<div class="card ${q?"sel":""}" data-id="${p.id}">
      <div class="ico">${thumb(p)}${offerTag(p)}</div><div class="cat">${esc(p.cat)}</div>
      <div class="nm">${esc(p.name)}</div><div class="pr"><small class="pl">سعر العبوة الواحدة</small> ${fmt(p.price)}</div>
      ${q? `<div class="qty"><button data-a="plus" data-i="${p.id}" aria-label="زيادة">+</button><span>${q.toLocaleString("ar-EG")}</span><button data-a="minus" data-i="${p.id}" aria-label="نقص">−</button></div>`
         : `<button class="add" ${p.out?"disabled":""} data-a="plus" data-i="${p.id}">${p.out?"غير متوفر":"أضف للسلة"}</button>`}
    </div>`;}
function grid(){ renderCats(); }   // الرئيسية: الأقسام بس، من غير منتجات تحتها
const parseK = k => { const [id,u] = String(k).split(":"); return {p:P(id), u:u==="s"?"s":"b"}; };
const ar = v => Number(v).toLocaleString("ar-EG");
// نظام الخصم: لو العميل اشترى "الحد الأدنى" علب أو أكتر، الخصم بيتطبق على "العدد المشمول" علب بس والباقي بسعره العادي
// (لو العدد المشمول فاضي = الخصم على كل العلب). قيمة الخصم: ١٠٪ = نسبة، ورقم عادي = جنيه لكل علبة
const perBox = p => p.discPct ? Math.round(p.price*p.disc)/100 : Math.min(p.disc,p.price);
const covered = (p,boxes) => p.inc>0 ? Math.min(p.inc,boxes) : boxes;
const saveOf = (p,boxes) => (p.disc>0 && boxes>=p.min) ? covered(p,boxes)*perBox(p) : 0;
const discTxt = p => p.discPct ? ar(p.disc)+"٪" : fmt(p.disc);
const boxWord = n => n>2 && n<11 ? "علب" : (n===2 ? "علبتين" : "علبة");
const cnt = n => n===1 ? "علبة واحدة" : n===2 ? "علبتين" : ar(n)+" "+boxWord(n);
const offerLine = p => p.inc>0 ? `اشتري ${cnt(p.min)} أو أكتر: خصم ${discTxt(p)} على ${cnt(p.inc)} فقط` : `اشتري ${cnt(p.min)} أو أكتر: خصم ${discTxt(p)} على كل العلب`;
// شرح العرض بالتفصيل (من غير لبس) مع مثال محسوب
function offerExplain(p){
  if(!(p.inc>0)) return `<div>لما تشتري <b>${cnt(p.min)} أو أكتر</b> بتاخد خصم <b>${discTxt(p)}</b> على <b>كل العلب</b>.</div>`;
  
  return `<div>لما تشتري <b>${cnt(p.min)} أو أكتر</b> بتاخد خصم <b>${discTxt(p)}</b> على <b>${cnt(p.inc)} فقط</b>.</div>
    <div>أي علب زيادة عن كده بتتحسب <b>بسعرها العادي من غير خصم</b>.</div>`;
}
const label = k => { const {p,u} = parseK(k); return p.name + (u==="s" ? " (شريط)" : ""); };
const lineTotal = k => { const {p,u}=parseK(k), q=cart[k]||0; return u==="s" ? q*stripPrice(p) : q*p.price - saveOf(p,q); };
function totals(){
  let n=0,s=0,sav=0; for(const k in cart){ n+=cart[k]; s+=lineTotal(k); const {p,u}=parseK(k); if(u==="b") sav+=saveOf(p,cart[k]); }
  return {n,s,sav};
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
  document.querySelectorAll(`.card[data-id="${pid}"]`).forEach(el=>{ const t=document.createElement("div"); t.innerHTML=cardHTML(P(pid)); const n=t.firstElementChild; n.classList.add("pop"); el.replaceWith(n); });
  const b=$("badge"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  if(d>0 && cart[key]===d) toast("تمت إضافة "+label(key));
  if($("ov").classList.contains("show") && $("sheet").dataset.v==="cart") cartView();
}
let toastT;
function toast(m){ const t=$("toast"); t.textContent=m; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1500); }

// ====== السلة وإتمام الشراء ======
function open(v){ $("sheet").dataset.v=v; $("ov").classList.add("show"); }
function close(){ $("ov").classList.remove("show"); }
const saveLine = sav => sav>0 ? `<div class="save"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>وفرت ${fmt(sav)} من إجمالي المبلغ</div>` : "";
function cartView(){
  open("cart");
  const ids = Object.keys(cart), {s,sav} = totals();
  $("sheet").innerHTML = `<h2>سلة المشتريات <button class="x" data-a="close" aria-label="إغلاق">✕</button></h2>` +
  (ids.length ? ids.map(id=>{
     const {p,u}=parseK(id), q=cart[id], d = u==="b" ? saveOf(p,q) : 0;
     let hint = "";
     if(u==="b" && p.disc>0) hint = q>=p.min ? `<em class="okk">العرض شغال ✓ وفرت ${fmt(d)} على ${cnt(covered(p,q))}${p.inc>0&&q>p.inc?" — والباقي بالسعر العادي":""}</em>` : `<em class="hintx">ناقصك ${cnt(p.min-q)} عشان العرض يشتغل</em>`;
     return `<div class="row"><div class="e">${thumb(p)}</div>
     <div class="t">${label(id)}<small>${d>0?`<s>${fmt(q*p.price)}</s> `:""}${fmt(lineTotal(id))}</small>${hint}</div>
     <div class="qty"><button data-a="plus" data-i="${id}">+</button><span>${ar(q)}</span><button data-a="minus" data-i="${id}">−</button></div></div>`}).join("") +
     saveLine(sav)+
     `<div class="total"><span>الإجمالي</span><span>${fmt(s)}</span></div>
      <button class="go" data-a="checkout">متابعة لإتمام الطلب</button>
      <button class="ghost" data-a="clear">إفراغ السلة</button>`
   : `<div class="empty"><b>${svg("cart")}</b>السلة فاضية، ابحث عن منتج وأضفه</div>`);
}
function checkoutView(){
  open("checkout");
  $("sheet").innerHTML = `<h2>بيانات الطلب <button class="x" data-a="close" aria-label="إغلاق">✕</button></h2>
   ${saveLine(totals().sav)}<div class="total"><span>الإجمالي</span><span>${fmt(totals().s)}</span></div>
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
  const {s,sav} = totals();
  let msg = `*طلب جديد - صيدليات د/ مراد صادق*\n\n`;
  for(const id in cart) msg += `• ${label(id)} × ${cart[id]} = ${lineTotal(id)} ${CURRENCY}\n`;
  if(sav>0) msg += `\nوفّر العميل: ${sav} ${CURRENCY}\n`;
  msg += `\n*الإجمالي: ${s} ${CURRENCY}*\n\nالاسم: ${n}\nالموبايل: ${p}\nالعنوان: ${a}` + (o?`\nملاحظات: ${o}`:"");
  window.open(`https://wa.me/${PHARMACY_PHONE}?text=${encodeURIComponent(msg)}`,"_blank");
  saveOrder(s); sv("mrad_profile",{name:n,phone:p,addr:a});
  cart = {}; refresh();
  $("sheet").innerHTML = `<div class="done"><b>${svg("check")}</b><h2 style="border:0;justify-content:center">تم تجهيز طلبك</h2>
    <p style="color:var(--gr)">أكمل إرسال الرسالة في واتساب وهنتواصل معاك لتأكيد التوصيل.</p></div>
    <button class="go" data-a="close">تمام</button>`;
}

// ====== الأحداث ======
$("cats").addEventListener("click", e=>{
  const b = e.target.closest("[data-c]"); if(!b) return;
  openCat(b.dataset.c);
});
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
  else if(a==="need") change(i, +b.dataset.n);
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
  [...VIEWS,"cat"].forEach(x=>{ $("v-"+x).hidden = (x!==v); });
  document.body.dataset.view = v;
  const nv = v==="cat" ? "home" : v;      // صفحة القسم تتحسب تحت "الرئيسية" في الشريط السفلي
  $("nav").querySelectorAll("button").forEach(b=>b.classList.toggle("on", b.dataset.v===nv));
  $("ind").style.transform = `translateX(${-100*VIEWS.indexOf(nv)}%)`;
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
function rowHTML(p){
  return `<div class="pcard ${p.out?"out":""}" data-id="${esc(p.id)}"><div class="pimg">${thumb(p)}${offerTag(p)}${p.out?'<span class="pout">غير متوفر</span>':""}</div>
    <b class="pn">${esc(p.name)}</b>
    <div class="pp"><small class="pl">سعر العبوة الواحدة</small><span class="pv">${fmt(p.price)}</span></div>
    ${p.disc>0?`<div class="pd">${offerLine(p)}</div>`:""}</div>`;
}
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
// ====== شاشة المنتج (تظهر لما تدوس على الكارت) ======
let pvId = null;
function productView(id){
  const p = P(id); if(!p) return; pvId = id; open("product");
  const pk = getPick(id), k = p.strips>1?p.strips:1, isS = pk.u==="s" && k>1, inCart = cart[id]||0;
  const boxes = inCart + (isS?0:pk.n), d = saveOf(p,boxes), add = isS ? 0 : d - saveOf(p,inCart);
  const line = (isS ? stripPrice(p) : p.price)*pk.n - add;
  let ofr = "";
  if(p.disc>0){
    const need = p.min - boxes, over = p.inc>0 ? Math.max(0, boxes-p.inc) : 0;
    ofr = `<div class="ofr ${need<=0?"on":""}"><b>${esc(p.offer)}</b>${offerExplain(p)}`+
      (need>0 ? `<em class="hintx">لسه ناقصك ${cnt(need)} عشان العرض يشتغل</em>`
              : `<em class="okk">العرض شغال ✓ وفرت ${fmt(d)} على ${cnt(covered(p,boxes))}${over>0?" — و"+cnt(over)+" الزيادة بالسعر العادي":""}</em>`)+`</div>`;
  }
  const dis = p.out?"disabled":"";
  $("sheet").innerHTML = `<h2>${esc(p.name)} <button class="x" data-a="close" aria-label="إغلاق">✕</button></h2>
    <div class="pimg big">${thumb(p)}${offerTag(p)}</div>
    <div class="pp big"><small class="pl">${isS?"سعر الشريط الواحد":"سعر العبوة الواحدة"}</small><span class="pv">${fmt(isS?stripPrice(p):p.price)}</span></div>
    ${inCart?`<div class="inc">في سلتك: ${ar(inCart)} ${boxWord(inCart)}</div>`:""}
    ${ofr}
    <div class="prow"><div class="qty"><button data-pv="inc" ${dis}>+</button><input class="qin" data-pv="inp" inputmode="numeric" value="${pk.n}" ${dis}><button data-pv="dec" ${dis}>−</button></div>
      ${k>1?`<div class="seg sm"><button data-pv="ub" class="${isS?"":"on"}">علبة</button><button data-pv="us" class="${isS?"on":""}">شريط</button></div>`:""}</div>
    <button class="go" data-pv="add" ${dis}>${p.out?"غير متوفر":"أضف للسلة · "+fmt(line)}</button>`;
}
function pvAct(a,val,n){
  const p = P(pvId), pk = getPick(pvId); if(!p) return;
  if(a==="ub"){ pk.u="b"; pk.n=1; } else if(a==="us"){ pk.u = p.strips>1?"s":"b"; pk.n=1; }
  else if(a==="inc") pk.n++; else if(a==="dec") pk.n--; else if(a==="inp") pk.n = toNum(val);
  else if(a==="need"){ pk.u="b"; pk.n += n; }
  else if(a==="add"){ addPick(p,pk); pk.n=1; pk.u="b"; close(); return; }
  fixPick(p,pk); productView(pvId);
}
$("sheet").addEventListener("click", e=>{ const b = e.target.closest("[data-pv]"); if(!b || b.tagName==="INPUT") return; pvAct(b.dataset.pv, null, +b.dataset.n||0); });
$("sheet").addEventListener("change", e=>{ if(e.target.dataset && e.target.dataset.pv==="inp") pvAct("inp", e.target.value); });
document.addEventListener("click", e=>{ const c = e.target.closest(".pcard"); if(c && !c.classList.contains("out")) productView(c.dataset.id); });
function nameSearch(){
  const raw = $("q").value, t = norm(raw).split(/\s+/).filter(Boolean), box = $("sres");
  if(!t.length){ box.innerHTML = `<div class="empty"><b>${svg("search")}</b>اكتب اسم الدواء أو المنتج (عربي أو إنجليزي)</div>`; return; }
  const list = PRODUCTS.filter(p=>{ const h = norm(p.name+" "+p.alias+" "+p.cat); return t.every(w=>h.includes(w)); }).slice(0,40);
  box.innerHTML = list.length ? list.map(rowHTML).join("") : `<div class="empty"><b>${svg("search")}</b>مفيش نتيجة لـ "${esc(raw)}"<br>جرّب اسم تاني أو صوّر العلبة</div>`;
}
$("q").addEventListener("input", nameSearch);

// ====== صفحة القسم: منتجات القسم + بحث خاص بالقسم بس ======
let curCat = "";
function catSearch(){
  const t = norm($("cq").value).split(/\s+/).filter(Boolean);
  const list = PRODUCTS.filter(p=>p.cat===curCat && t.every(w=>norm(p.name+" "+p.alias).includes(w)));
  $("ccount").textContent = list.length ? list.length.toLocaleString("ar-EG")+" منتج" : "";
  $("cres").innerHTML = list.length ? list.map(rowHTML).join("")
    : `<div class="empty"><b>${svg("search")}</b>${t.length?`مفيش نتيجة لـ "${esc($("cq").value)}" في ${esc(curCat)}`:"مفيش منتجات في القسم ده"}</div>`;
}
function openCat(c){
  curCat = c; $("ctitle").textContent = c; $("cq").value = "";
  show("cat"); catSearch();
}
$("cq").addEventListener("input", catSearch);
$("cback").onclick = ()=>show("home");

function setTab(t){
  $("stabs").querySelectorAll("button").forEach(b=>b.classList.toggle("on", b.dataset.t===t));
  $("t-name").hidden = t!=="name"; $("t-scan").hidden = t!=="scan";
}
$("stabs").addEventListener("click", e=>{ const b=e.target.closest("[data-t]"); if(b) setTab(b.dataset.t); });
nameSearch();

// --- التعرف على الأسماء من النص ---
// "بصمة صوتية": بنحوّل الاسم (عربي أو إنجليزي) لهيكل حروفه الساكنة عشان "Panadol" و"بنادول" يطلعوا نفس البصمة (bndl)
const AR_K = {"ب":"b","ت":"t","ط":"t","ث":"s","س":"s","ص":"s","ج":"j","غ":"j","ح":"h","خ":"h","ه":"h","ة":"h","د":"d","ض":"d","ذ":"z","ز":"z","ظ":"z","ر":"r","ش":"X","ك":"k","ق":"k","ل":"l","م":"m","ن":"n","ف":"f"};
function skel(w){
  w = norm(String(w)).replace(/[^a-zء-ي]/g,"");
  w = w.replace(/ph/g,"f").replace(/sh/g,"X").replace(/ch/g,"X").replace(/th/g,"t").replace(/ck/g,"k").replace(/x/g,"ks").replace(/c(?=[eiy])/g,"s");
  let o = "";
  for(const ch of w){
    let k = AR_K[ch];
    if(k===undefined){ if(/[a-z]/.test(ch)) k = {p:"b",v:"f",q:"k",c:"k",g:"j",w:"",y:"",a:"",e:"",i:"",o:"",u:""}[ch] ?? ch; else k = ""; }
    if(k && o[o.length-1]!==k) o += k;
  }
  return o;
}
const STOPW = ["مجم","ملجم","قرص","اقراص","شراب","كبسولات","مضاد","حيوي","للشعر","للقشرة","للبرد","للوجه","للبشره","كريم","زيت","جهاز","سيروم","معجون","اسنان","بلسم","غسول","قياس","اطفال","فيتامين","vitamin","شامبو","tablets","tablet","capsules","cream","gel","syrup","drops","mg","extra","اكسترا","forte","فورت","plus","بلس","advance","كولد","cold","flu","new","for","and","the"];
const STOP = new Set(STOPW.map(norm)), STOPK = new Set(STOPW.map(skel).filter(Boolean));
function lev(a,b){
  if(Math.abs(a.length-b.length)>2) return 9;
  const m=[...Array(b.length+1).keys()];
  for(let i=1;i<=a.length;i++){ let prev=m[0]; m[0]=i; for(let j=1;j<=b.length;j++){ const t=m[j]; m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1)); prev=t; } }
  return m[b.length];
}
function matchText(text){
  const nt = norm(text), raw = nt.split(/[^a-z0-9ء-ي]+/).filter(w=>w.length>=3);
  const words = [...new Set(raw.filter(w=>w.length>=4))];
  const wk = [...new Set(raw.map(skel).filter(k=>k.length>=3))], out = [];
  PRODUCTS.forEach(p=>{
    const toks = [...new Set(norm(p.name+" "+p.alias).split(/\s+/).filter(t=>t.length>=3 && !/^\d+$/.test(t) && !STOP.has(t)))];
    let sc = 0;
    toks.forEach(t=>{
      if(t.length>=4 && nt.includes(t)){ sc+=3; return; }
      const k = skel(t);
      if(k.length<3 || STOPK.has(k)){ return; }
      if(wk.includes(k)) sc += 3;                                                    // نفس البصمة الصوتية (عربي/إنجليزي)
      else if(k.length>=4 && wk.some(x=>lev(x,k)<=1)) sc += 2;                       // قريبة بحرف واحد (أخطاء القراءة)
      else if(t.length>=5 && words.some(w=>lev(w,t) <= (t.length>=7?2:1))) sc += 1;
    });
    if(sc>0) out.push({p,sc});
  });
  return out.sort((a,b)=>b.sc-a.sc).slice(0,10).map(r=>r.p);
}
// --- قراءة الصورة ---
let tesLoad = null;
function loadTes(){
  return tesLoad || (tesLoad = new Promise((res,rej)=>{
    if(window.Tesseract) return res();
    const urls = ["https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js","https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"];
    const next = i => {
      if(i>=urls.length){ tesLoad=null; return rej(new Error("load")); }
      const sc = document.createElement("script"); sc.src = urls[i];
      sc.onload = res; sc.onerror = ()=>{ sc.remove(); next(i+1); };
      document.head.appendChild(sc);
    };
    next(0);
  }));
}
// تجهيز الصورة: تكبير الصغيرة، رمادي + رفع التباين (بيحسّن قراءة العلب والروشتات)
function prepImage(file){
  return new Promise((res,rej)=>{
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = ()=>{
      const m = Math.max(im.width,im.height), k = m>2000 ? 2000/m : (m<1200 ? 1200/m : 1), c = document.createElement("canvas");
      c.width = Math.round(im.width*k); c.height = Math.round(im.height*k);
      const x = c.getContext("2d"); x.drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(u);
      const d = x.getImageData(0,0,c.width,c.height), a = d.data; let lo=255, hi=0;
      for(let i=0;i<a.length;i+=4){ const g = (a[i]*.299+a[i+1]*.587+a[i+2]*.114)|0; a[i]=a[i+1]=a[i+2]=g; if(g<lo)lo=g; if(g>hi)hi=g; }
      const sp = Math.max(40,hi-lo);
      for(let i=0;i<a.length;i+=4){ const v = Math.max(0,Math.min(255,((a[i]-lo)*255/sp)|0)); a[i]=a[i+1]=a[i+2]=v; }
      x.putImageData(d,0,0); res(c);
    };
    im.onerror = rej; im.src = u;
  });
}
async function ocrLang(canvas, lang, base, span, prog){
  const w = await Tesseract.createWorker(lang, 1, {logger:m=>{ if(m.status==="recognizing text") prog(base+m.progress*span,"جاري قراءة الصورة..."); }});
  try{
    try{ await w.setParameters({tessedit_pageseg_mode:"11"}); }catch(_){}      // نص متفرق: أنسب للعلب
    return (await w.recognize(canvas)).data.text || "";
  } finally { try{ await w.terminate(); }catch(_){} }
}
async function readText(canvas, prog){
  if(RECOGNIZE_URL){
    const r = await fetch(RECOGNIZE_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:canvas.toDataURL("image/jpeg",.85)})});
    const j = await r.json(); return (j.names||[]).join("\n")+"\n"+(j.text||"");
  }
  prog(0,"جاري تجهيز قارئ النصوص (أول مرة بياخد وقت)...");
  await loadTes();
  // قراءة إنجليزي وعربي كل واحدة لوحدها (أدق من دمجهم)، ولو واحدة فشلت نكمل بالتانية
  let text = "", ok = 0, err = null;
  for(const [lang,base] of [["eng",0],["ara",.5]]){
    try{ text += "\n" + await ocrLang(canvas, lang, base, .5, prog); ok++; }catch(e){ err = e; }
  }
  if(!ok) throw err || new Error("ocr");
  return text;
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
      ? `<div class="found"><h2>لقينا ${list.length.toLocaleString("ar-EG")} ${list.length>2?"أدوية":"دواء"}</h2></div>`+`<div class="pgrid">${list.map(rowHTML).join("")}</div>`+
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
    toast("تمت إضافة "+n.toLocaleString("ar-EG")+" صنف للسلة");
  }
});

fillIcons(); boot();

// ====== النسخة والتحديث (PWA) ======
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

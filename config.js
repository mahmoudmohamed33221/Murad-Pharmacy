// ===== إعدادات Murad Pharmacy =====
// ده الملف الوحيد اللي بتعدل فيه إعدادات الصيدلية (من غير ما تلمس الكود).
window.APP_CONFIG = {
  PHARMACY_NAME: "صيدليات د/ مراد صادق",
  BAN_PHONE: "201099335833",   // رقم واتساب اللي بيظهر للعميل المحظور (بصيغة دولية بدون +). 01200000001 = 201200000001
  PHARMACY_PHONE: "201099335833",   // رقم واتساب الصيدلية بصيغة دولية بدون +
  CURRENCY: "ج.م",

  // مصدر المنتجات: "json" (ملف data/products.json) أو "sheet" (Google Sheet)
  PRODUCTS_SOURCE: "sheet",
  PRODUCTS_JSON: "data/products.json",
  SHEET: {
    ID: "199-5mWgHEsepqmA8b5CmONGD8sBGctxKyoKBeFN-Otk",          // رقم الشيت: الجزء اللي بين /d/ و /edit في رابطه
    TABS: ["الادويه", "العنايه"], // أسماء الأوراق (Tabs) اللي فيها المنتجات. كل ورقة تتقرا وتتدمج، وأي قسم جديد بيظهر تلقائي. زود أي ورقة جديدة هنا
    API_KEY: ""      // مفتاح Google Sheets API (مقيّد بالقراءة وبرابط موقعك)
  },

  // رابط سكربت تسجيل العملاء (Google Apps Script Web App) - شوف backend/customers.gs وقسم "تسجيل العملاء" في README
  // لو سيبته فاضي: التسجيل بيشتغل عادي وبيتحفظ في الجهاز، بس مش هيوصل لورقة "العملاء".
  CUSTOMERS_URL: "https://script.google.com/macros/s/AKfycbylNxiKp409Ox8t8IqOStHSgyiNAireDF65lBU82PjU3_K2PhQVFFHTOXJftKKFH2Y/exec",

  // رابط سكربت الطلبات ومشترياتي (مشروع Apps Script اسمه اوردارس) - شوف backend/orders.gs
  ORDERS_URL: "https://script.google.com/macros/s/AKfycby2L6f1B6iFQiR75h5FZPZnar4gY5WdcrbqElRVUJZxSg2z2jeURyC2m3H77zsB4fw/exec",

  // رابط سيرفر الذكاء الاصطناعي لقراءة الروشتات (اختياري) - شوف README قسم 8
  RECOGNIZE_URL: "",

  APP_VERSION: "1.0.0",
  BUILD: "__BUILD__"   // بيتستبدل تلقائي عند كل نشر على GitHub
};

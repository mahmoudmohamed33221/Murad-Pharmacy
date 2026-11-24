// ===== إعدادات Ouf Pharmacy =====
// ده الملف الوحيد اللي بتعدل فيه إعدادات الصيدلية (من غير ما تلمس الكود).
window.APP_CONFIG = {
  PHARMACY_NAME: "صيدلية عوف",
  BAN_PHONE: "201508800926",   // رقم واتساب اللي بيظهر للعميل المحظور (بصيغة دولية بدون +). 01200000001 = 201200000001
  PHARMACY_PHONE: "201508800926",   // رقم واتساب الصيدلية (واتساب + اتصال) بصيغة دولية بدون +
  CONSULT_PHONE: "201508800926",    // رقم استشاري الصيدلية (واتساب) في الفوتر
  PHARMACY_LANDLINE: "20224534828", // التليفون الأرضي للصيدلية (0224534828): بيتفتح بزرار "اتصال" في الإعدادات وفي الفوتر
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
  CUSTOMERS_URL: "https://script.google.com/macros/s/AKfycbzKUo02n5ZGecAj6YQJ1FLGi9FmP-vuM-96zEFIgiR_xYXYrMBvuuf9GFKrXEdl8Mo/exec",

  // رابط سكربت الطلبات ومشترياتي (مشروع Apps Script اسمه اوردارس) - شوف backend/orders.gs
  ORDERS_URL: "https://script.google.com/macros/s/AKfycbweCaCKVK2m2ps2ZCC7UHqUaZOSPGjRJXOG9urYH-HJsWZ5SGd9u9VB4K3js8Tx3pw/exec",

  // رابط سيرفر الذكاء الاصطناعي لقراءة الروشتات (اختياري) - شوف README قسم 8
  RECOGNIZE_URL: "",

  // true = لما العرض يكون "ايقاف" في عمود "حالة العرض" الخصم نفسه كمان يتلغي (مش بس يختفي من العروض المتحركة). false = يختفي من العروض المتحركة والإشعارات بس
  OFFER_OFF_CANCELS_DISCOUNT: false,

  APP_VERSION: "1.0.0",
  BUILD: "__BUILD__"   // بيتستبدل تلقائي عند كل نشر على GitHub
};

// ===== إعدادات Murad Pharmacy =====
// ده الملف الوحيد اللي بتعدل فيه إعدادات الصيدلية (من غير ما تلمس الكود).
window.APP_CONFIG = {
  PHARMACY_NAME: "صيدليات د/ مراد صادق",
  PHARMACY_PHONE: "201000000000",   // رقم واتساب الصيدلية بصيغة دولية بدون +
  CURRENCY: "ج.م",

  // مصدر المنتجات: "json" (ملف data/products.json) أو "sheet" (Google Sheet)
  PRODUCTS_SOURCE: "json",
  PRODUCTS_JSON: "data/products.json",
  SHEET: {
    ID: "",          // رقم الشيت: الجزء اللي بين /d/ و /edit في رابطه
    TAB: "Products", // اسم الورقة (Tab) اللي فيها المنتجات
    API_KEY: ""      // مفتاح Google Sheets API (مقيّد بالقراءة وبرابط موقعك)
  },

  // رابط سيرفر الذكاء الاصطناعي لقراءة الروشتات (اختياري) - شوف README قسم 8
  RECOGNIZE_URL: "",

  APP_VERSION: "1.0.0",
  BUILD: "__BUILD__"   // بيتستبدل تلقائي عند كل نشر على GitHub
};

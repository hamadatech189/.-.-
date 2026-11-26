/**
 * ملف الإعدادات الرئيسي لموقع «المكتبة»
 * ---------------------------------------------------------
 * المطلوب منك فقط: لصق مفتاح Supabase العام (anon / publishable key)
 * مكان النص PASTE_YOUR_SUPABASE_ANON_KEY_HERE بالأسفل.
 *
 * ملاحظة أمنية مهمة:
 * هذا المفتاح عام ومصمم للعمل في المتصفح بأمان لأن الحماية الحقيقية
 * مضبوطة داخل سيرفر Supabase عبر قواعد RLS (لا تضع أبداً المفتاح السري service_role هنا).
 */

window.Almaktabah = window.Almaktabah || {};

window.Almaktabah.CONFIG = {
  // 1) بيانات مشروع Supabase الخاص بك
  SUPABASE_URL: "https://lvndqzmsqbjeangsiqwi.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_vWK8hgR7aLk_yXKkQCBwvA_2jFwttrt",

  // 2) بيانات التواصل مع مالك المكتبة (تظهر في الفوتر بعد تسجيل الدخول)
  OWNER_PHONE: "01011439841",
  OWNER_PHONE_INTL: "+201011439841",
  OWNER_WHATSAPP_URL: "https://wa.me/201011439841",
  OWNER_FACEBOOK_URL: "https://www.facebook.com/hmadh.bd.alftah.707265",

  // 3) النطاق الداخلي لربط رقم الهاتف بنظام تسجيل الدخول المجاني بدون SMS
  INTERNAL_AUTH_DOMAIN: "almaktabah.app",

  // 4) أقسام المكتبة
  CATEGORIES: {
    study: { label: "كتب دراسية", coverClass: "cover-study" },
    general: { label: "علوم عامة", coverClass: "cover-general" },
    religious: { label: "كتب دينية", coverClass: "cover-religious" }
  },

  // 5) قائمة الصفوف الدراسية + خيار الخريج
  GRADES: [
    "الأول الابتدائي",
    "الثاني الابتدائي",
    "الثالث الابتدائي",
    "الرابع الابتدائي",
    "الخامس الابتدائي",
    "السادس الابتدائي",
    "الأول الإعدادي",
    "الثاني الإعدادي",
    "الثالث الإعدادي",
    "الأول الثانوي",
    "الثاني الثانوي",
    "الثالث الثانوي",
    "خريج / قارئ عام"
  ]
};

/**
 * دوال مساعدة مشتركة وآمنة (منع ثغرات XSS + توحيد رقم الهاتف + الإشعارات)
 */
window.Almaktabah.Utils = {
  escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  sanitizeUrl(url) {
    if (!url) return "";
    const trimmed = String(url).trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return "";
  },

  normalizePhone(rawPhone) {
    if (!rawPhone) return "";
    // تحويل الأرقام العربية (٠١٢٣...) إلى إنجليزية وحذف المسافات والرموز
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    let cleaned = String(rawPhone)
      .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
      .replace(/[^\d]/g, "");

    // إزالة كود الدولة المصري 20 أو 0020 إن وجد لتوحيد الصيغة
    if (cleaned.startsWith("0020")) {
      cleaned = "0" + cleaned.slice(4);
    } else if (cleaned.startsWith("20") && cleaned.length === 12) {
      cleaned = "0" + cleaned.slice(2);
    }
    return cleaned;
  },

  isValidEgyptianPhone(phone) {
    return /^01[0125]\d{8}$/.test(phone);
  },

  phoneToAuthEmail(normalizedPhone) {
    return `${normalizedPhone}@${window.Almaktabah.CONFIG.INTERNAL_AUTH_DOMAIN}`;
  },

  showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "toast-error" : type === "warning" ? "toast-warning" : ""}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => toast.remove(), 250);
    }, 3800);
  }
};

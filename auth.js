/**
 * إدارة تسجيل الدخول وإنشاء الحسابات وجلب بيانات المستخدم
 */

window.Almaktabah = window.Almaktabah || {};

window.Almaktabah.Auth = (() => {
  const { Utils, DB } = window.Almaktabah;

  let currentUser = null;
  let currentProfile = null;

  function translateAuthError(message) {
    if (!message) return "حدث خطأ غير متوقع، حاول مرة أخرى.";
    const msg = message.toLowerCase();
    if (msg.includes("invalid login credentials")) {
      return "رقم الهاتف أو كلمة المرور غير صحيحة.";
    }
    if (msg.includes("user already registered") || msg.includes("already been registered")) {
      return "رقم الهاتف هذا مسجّل بالفعل. جرّب تسجيل الدخول.";
    }
    if (msg.includes("email not confirmed")) {
      return "يجب إيقاف خيار (Confirm email) من إعدادات Authentication في Supabase.";
    }
    if (msg.includes("password should be at least")) {
      return "كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل.";
    }
    if (msg.includes("rate limit") || msg.includes("too many requests")) {
      return "محاولات كثيرة متتالية، انتظر قليلاً ثم حاول مرة أخرى.";
    }
    return message;
  }

  async function fetchProfile(userId) {
    const supabase = DB.getClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }
    return data;
  }

  async function getSessionAndProfile() {
    const supabase = DB.getClient();
    if (!supabase) return { user: null, profile: null };

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      currentUser = null;
      currentProfile = null;
      return { user: null, profile: null };
    }

    currentUser = data.session.user;
    try {
      currentProfile = await fetchProfile(currentUser.id);
    } catch (err) {
      // في حال تأخر الـ trigger لحظة بعد إنشاء الحساب
      currentProfile = {
        id: currentUser.id,
        first_name: currentUser.user_metadata?.first_name || "مستخدم",
        last_name: currentUser.user_metadata?.last_name || "",
        phone: currentUser.user_metadata?.phone || "",
        contact_email: currentUser.user_metadata?.contact_email || "",
        grade: currentUser.user_metadata?.grade || "خريج / قارئ عام",
        role: "user"
      };
    }

    return { user: currentUser, profile: currentProfile };
  }

  async function signUp({ firstName, lastName, rawPhone, contactEmail, grade, password }) {
    const supabase = DB.getClient();
    if (!supabase) {
      throw new Error("الموقع غير مربوط بـ Supabase بعد. أضف المفتاح في js/config.js.");
    }

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const normalizedPhone = Utils.normalizePhone(rawPhone);
    const cleanEmail = (contactEmail || "").trim();

    if (!cleanFirst || !cleanLast) {
      throw new Error("يرجى إدخال الاسم الأول واسم العائلة.");
    }
    if (!Utils.isValidEgyptianPhone(normalizedPhone)) {
      throw new Error("يرجى إدخال رقم هاتف مصري صحيح مكوّن من 11 رقماً (يبدأ بـ 010 أو 011 أو 012 أو 015).");
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("صيغة البريد الإلكتروني غير صحيحة (أو اتركه فارغاً لأنه اختياري).");
    }
    if (!grade) {
      throw new Error("يرجى اختيار الصف الدراسي أو خريج.");
    }
    if (!password || password.length < 6) {
      throw new Error("كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل.");
    }

    const authEmail = Utils.phoneToAuthEmail(normalizedPhone);

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          first_name: cleanFirst,
          last_name: cleanLast,
          phone: normalizedPhone,
          contact_email: cleanEmail,
          grade
        }
      }
    });

    if (error) {
      throw new Error(translateAuthError(error.message));
    }

    if (!data.session) {
      throw new Error("تم إنشاء الحساب، لكن يرجى إيقاف خيار (Confirm email) من إعدادات Supabase Authentication للدخول الفوري.");
    }

    currentUser = data.user;
    // انتظار بسيط لضمان اكتمال إنشاء الصف في جدول profiles عبر الـ trigger
    await new Promise((r) => setTimeout(r, 350));
    try {
      currentProfile = await fetchProfile(currentUser.id);
    } catch {
      currentProfile = {
        id: currentUser.id,
        first_name: cleanFirst,
        last_name: cleanLast,
        phone: normalizedPhone,
        contact_email: cleanEmail,
        grade,
        role: normalizedPhone === window.Almaktabah.CONFIG.OWNER_PHONE ? "admin" : "user"
      };
    }

    return { user: currentUser, profile: currentProfile };
  }

  async function signIn({ rawPhone, password }) {
    const supabase = DB.getClient();
    if (!supabase) {
      throw new Error("الموقع غير مربوط بـ Supabase بعد. أضف المفتاح في js/config.js.");
    }

    const normalizedPhone = Utils.normalizePhone(rawPhone);
    if (!Utils.isValidEgyptianPhone(normalizedPhone)) {
      throw new Error("يرجى إدخال رقم هاتف صحيح مكوّن من 11 رقماً.");
    }
    if (!password) {
      throw new Error("يرجى إدخال كلمة المرور.");
    }

    const authEmail = Utils.phoneToAuthEmail(normalizedPhone);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password
    });

    if (error) {
      throw new Error(translateAuthError(error.message));
    }

    currentUser = data.user;
    currentProfile = await fetchProfile(currentUser.id);
    return { user: currentUser, profile: currentProfile };
  }

  async function signOut() {
    const supabase = DB.getClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    currentUser = null;
    currentProfile = null;
  }

  function getCurrentProfile() {
    return currentProfile;
  }

  function getCurrentUser() {
    return currentUser;
  }

  function isAdmin() {
    return Boolean(currentProfile && currentProfile.role === "admin");
  }

  return {
    getSessionAndProfile,
    signUp,
    signIn,
    signOut,
    getCurrentProfile,
    getCurrentUser,
    isAdmin
  };
})();

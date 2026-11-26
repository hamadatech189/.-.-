/**
 * تهيئة الاتصال الآمن مع Supabase
 */

window.Almaktabah = window.Almaktabah || {};

window.Almaktabah.DB = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.Almaktabah.CONFIG;

  function isConfigured() {
    return (
      Boolean(SUPABASE_URL) &&
      Boolean(SUPABASE_ANON_KEY) &&
      SUPABASE_ANON_KEY !== "PASTE_YOUR_SUPABASE_ANON_KEY_HERE"
    );
  }

  let client = null;

  function getClient() {
    if (!isConfigured()) {
      return null;
    }
    if (!client) {
      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("تعذر تحميل مكتبة Supabase. تأكد من اتصالك بالإنترنت.");
      }
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  return {
    isConfigured,
    getClient
  };
})();

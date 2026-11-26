/**
 * نقطة التشغيل الرئيسية لموقع «المكتبة»
 * تربط بين المصادقة وعرض الكتب ولوحة التحكم والوضع الليلي
 */

(() => {
  const { CONFIG, Utils, DB, Auth, Books, Admin } = window.Almaktabah;

  function populateGradeSelects() {
    const signupGrade = document.getElementById("signup-grade");
    const filterGrade = document.getElementById("grade-filter");
    const bookGrade = document.getElementById("book-grade");

    CONFIG.GRADES.forEach((grade) => {
      if (signupGrade) {
        const opt = document.createElement("option");
        opt.value = grade;
        opt.textContent = grade;
        signupGrade.appendChild(opt);
      }
      if (filterGrade) {
        const opt = document.createElement("option");
        opt.value = grade;
        opt.textContent = grade;
        filterGrade.appendChild(opt);
      }
      if (bookGrade) {
        const opt = document.createElement("option");
        opt.value = grade;
        opt.textContent = grade;
        bookGrade.appendChild(opt);
      }
    });

    if (filterGrade) {
      const generalOpt = document.createElement("option");
      generalOpt.value = "عام للجميع";
      generalOpt.textContent = "عام للجميع";
      filterGrade.appendChild(generalOpt);
    }
  }

  function applyContactLinks() {
    const phoneLink = document.getElementById("contact-phone-link");
    const waLink = document.getElementById("contact-whatsapp-link");
    const fbLink = document.getElementById("contact-facebook-link");

    if (phoneLink) phoneLink.href = `tel:${CONFIG.OWNER_PHONE_INTL}`;
    if (waLink) waLink.href = CONFIG.OWNER_WHATSAPP_URL;
    if (fbLink) fbLink.href = CONFIG.OWNER_FACEBOOK_URL;
  }

  function initTheme() {
    const savedTheme = localStorage.getItem("almaktabah_theme") || "light";
    setTheme(savedTheme);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("almaktabah_theme", theme);

    const moon = document.getElementById("theme-icon-moon");
    const sun = document.getElementById("theme-icon-sun");
    if (moon && sun) {
      moon.classList.toggle("hidden", theme === "dark");
      sun.classList.toggle("hidden", theme !== "dark");
    }
  }

  function showAuthView() {
    document.getElementById("auth-view").classList.remove("hidden");
    document.getElementById("app-view").classList.add("hidden");
  }

  async function showAppView(profile) {
    document.getElementById("auth-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");

    const greeting = document.getElementById("user-greeting");
    const gradeBadge = document.getElementById("user-grade-badge");
    const adminBtn = document.getElementById("open-admin-btn");

    if (greeting) {
      greeting.textContent = `أهلاً، ${profile.first_name || "قارئنا"}`;
    }
    if (gradeBadge) {
      gradeBadge.textContent = profile.grade || "";
    }
    if (adminBtn) {
      adminBtn.classList.toggle("hidden", profile.role !== "admin");
    }

    try {
      await Books.loadBooks();
    } catch (err) {
      Utils.showToast(err.message, "error");
    }
  }

  function bindEvents() {
    // التبديل بين تسجيل الدخول وإنشاء حساب
    const tabLogin = document.getElementById("tab-login");
    const tabSignup = document.getElementById("tab-signup");
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");

    tabLogin.addEventListener("click", () => {
      tabLogin.classList.add("active");
      tabSignup.classList.remove("active");
      tabLogin.setAttribute("aria-selected", "true");
      tabSignup.setAttribute("aria-selected", "false");
      loginForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
    });

    tabSignup.addEventListener("click", () => {
      tabSignup.classList.add("active");
      tabLogin.classList.remove("active");
      tabSignup.setAttribute("aria-selected", "true");
      tabLogin.setAttribute("aria-selected", "false");
      signupForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
    });

    // إرسال نموذج تسجيل الدخول
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("login-submit");
      btn.disabled = true;
      btn.textContent = "جاري الدخول...";

      try {
        const { profile } = await Auth.signIn({
          rawPhone: document.getElementById("login-phone").value,
          password: document.getElementById("login-password").value
        });
        Utils.showToast(`مرحباً بعودتك يا ${profile.first_name}!`);
        loginForm.reset();
        await showAppView(profile);
      } catch (err) {
        Utils.showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "دخول إلى المكتبة";
      }
    });

    // إرسال نموذج إنشاء حساب جديد
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("signup-submit");
      btn.disabled = true;
      btn.textContent = "جاري إنشاء الحساب...";

      try {
        const { profile } = await Auth.signUp({
          firstName: document.getElementById("signup-first-name").value,
          lastName: document.getElementById("signup-last-name").value,
          rawPhone: document.getElementById("signup-phone").value,
          contactEmail: document.getElementById("signup-email").value,
          grade: document.getElementById("signup-grade").value,
          password: document.getElementById("signup-password").value
        });
        Utils.showToast(`تم إنشاء حسابك بنجاح! أهلاً بك في المكتبة يا ${profile.first_name}.`);
        signupForm.reset();
        await showAppView(profile);
      } catch (err) {
        Utils.showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "إنشاء الحساب والدخول";
      }
    });

    // تسجيل الخروج
    document.getElementById("logout-btn").addEventListener("click", async () => {
      await Auth.signOut();
      Books.resetFilters();
      showAuthView();
      Utils.showToast("تم تسجيل الخروج بنجاح.");
    });

    // الوضع الليلي
    document.getElementById("theme-toggle").addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      setTheme(current === "dark" ? "light" : "dark");
    });

    // البحث والفلترة
    document.getElementById("book-search").addEventListener("input", (e) => {
      Books.setSearch(e.target.value);
    });

    document.getElementById("category-pills").addEventListener("click", (e) => {
      const pill = e.target.closest(".pill");
      if (!pill) return;
      document.querySelectorAll("#category-pills .pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      Books.setCategory(pill.dataset.category);
    });

    document.getElementById("grade-filter").addEventListener("change", (e) => {
      Books.setGrade(e.target.value);
    });

    document.getElementById("my-grade-btn").addEventListener("click", () => {
      const profile = Auth.getCurrentProfile();
      if (!profile || !profile.grade) return;
      const gradeSelect = document.getElementById("grade-filter");
      gradeSelect.value = profile.grade;
      Books.setGrade(profile.grade);
      Utils.showToast(`تم عرض الكتب المناسبة لـ: ${profile.grade}`);
    });

    document.getElementById("reset-filters-btn").addEventListener("click", () => {
      Books.resetFilters();
    });

    // فتح قارئ PDF عند الضغط على "قراءة الآن"
    document.getElementById("books-grid").addEventListener("click", (e) => {
      const readBtn = e.target.closest(".read-book-btn");
      if (readBtn) {
        Books.openReader(readBtn.dataset.bookId);
      }
    });

    // فتح لوحة تحكم المالك
    document.getElementById("open-admin-btn").addEventListener("click", () => {
      Admin.openDashboard();
    });

    // تبويبات لوحة التحكم
    document.querySelectorAll(".admin-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        Admin.switchAdminTab(tab.dataset.adminTab);
      });
    });

    // نموذج إضافة وتعديل الكتاب
    document.getElementById("book-form").addEventListener("submit", Admin.saveBook);
    document.getElementById("book-cancel-edit-btn").addEventListener("click", Admin.resetBookForm);

    // أزرار تعديل وحذف الكتب داخل جدول لوحة التحكم
    document.getElementById("admin-books-tbody").addEventListener("click", (e) => {
      const editBtn = e.target.closest(".edit-book-btn");
      if (editBtn) {
        Admin.startEditBook(editBtn.dataset.id);
        return;
      }
      const deleteBtn = e.target.closest(".delete-book-btn");
      if (deleteBtn) {
        Admin.deleteBook(deleteBtn.dataset.id);
      }
    });

    // إغلاق النوافذ المنبثقة (الضغط على X أو الخلفية أو زر Escape)
    document.addEventListener("click", (e) => {
      const closeTarget = e.target.closest("[data-close]");
      if (!closeTarget) return;
      const modalId = closeTarget.dataset.close;
      if (modalId === "reader-modal") Books.closeReader();
      if (modalId === "admin-modal") Admin.closeDashboard();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        Books.closeReader();
        Admin.closeDashboard();
      }
    });
  }

  async function init() {
    initTheme();
    populateGradeSelects();
    applyContactLinks();
    bindEvents();

    const loader = document.getElementById("app-loader");
    const configWarning = document.getElementById("config-warning");

    if (!DB.isConfigured()) {
      configWarning.classList.remove("hidden");
      showAuthView();
      loader.classList.add("hidden");
      return;
    }

    try {
      const { user, profile } = await Auth.getSessionAndProfile();
      if (user && profile) {
        await showAppView(profile);
      } else {
        showAuthView();
      }
    } catch (err) {
      Utils.showToast("تعذر التحقق من الجلسة: " + err.message, "error");
      showAuthView();
    } finally {
      loader.classList.add("hidden");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

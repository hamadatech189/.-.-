/**
 * لوحة تحكم المالك فقط (إضافة، تعديل، وحذف الكتب + عرض المستخدمين المسجلين)
 * محمية على مستوى السيرفر عبر قواعد RLS في Supabase
 */

window.Almaktabah = window.Almaktabah || {};

window.Almaktabah.Admin = (() => {
  const { CONFIG, Utils, DB, Auth, Books } = window.Almaktabah;

  let registeredUsers = [];

  async function openDashboard() {
    if (!Auth.isAdmin()) {
      Utils.showToast("هذه اللوحة مخصصة لمالك المكتبة فقط.", "error");
      return;
    }

    const modal = document.getElementById("admin-modal");
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    await refreshDashboardData();
  }

  function closeDashboard() {
    const modal = document.getElementById("admin-modal");
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    resetBookForm();
  }

  async function refreshDashboardData() {
    await Books.loadBooks();
    await loadUsers();
    renderStats();
    renderAdminBooksTable();
    renderUsersTable();
  }

  async function loadUsers() {
    const supabase = DB.getClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, contact_email, grade, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      Utils.showToast("تعذر تحميل قائمة المستخدمين: " + error.message, "error");
      return;
    }

    registeredUsers = data || [];
  }

  function renderStats() {
    const books = Books.getAllBooks();
    document.getElementById("stat-total-books").textContent = books.length;
    document.getElementById("stat-study-books").textContent = books.filter((b) => b.category === "study").length;
    document.getElementById("stat-general-books").textContent = books.filter((b) => b.category === "general").length;
    document.getElementById("stat-religious-books").textContent = books.filter((b) => b.category === "religious").length;
    document.getElementById("stat-total-users").textContent = registeredUsers.length;
  }

  function renderAdminBooksTable() {
    const tbody = document.getElementById("admin-books-tbody");
    const books = Books.getAllBooks();

    if (!books.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">لم تتم إضافة أي كتب بعد.</td></tr>`;
      return;
    }

    tbody.innerHTML = books
      .map((book) => {
        const cat = CONFIG.CATEGORIES[book.category]?.label || "عام";
        return `
          <tr>
            <td><strong>${Utils.escapeHtml(book.title)}</strong></td>
            <td>${Utils.escapeHtml(cat)}</td>
            <td>${Utils.escapeHtml(book.grade || "عام للجميع")}</td>
            <td>
              <div class="table-actions">
                <button type="button" class="btn btn-soft btn-sm edit-book-btn" data-id="${Utils.escapeHtml(book.id)}">تعديل</button>
                <button type="button" class="btn btn-danger btn-sm delete-book-btn" data-id="${Utils.escapeHtml(book.id)}">حذف</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderUsersTable() {
    const tbody = document.getElementById("admin-users-tbody");

    if (!registeredUsers.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">لا يوجد مستخدمون مسجلون بعد.</td></tr>`;
      return;
    }

    tbody.innerHTML = registeredUsers
      .map((u) => {
        const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
        const isOwner = u.role === "admin";
        return `
          <tr>
            <td><strong>${Utils.escapeHtml(fullName)}</strong></td>
            <td dir="ltr" style="text-align:right">${Utils.escapeHtml(u.phone)}</td>
            <td>${Utils.escapeHtml(u.grade)}</td>
            <td dir="ltr" style="text-align:right">${Utils.escapeHtml(u.contact_email || "—")}</td>
            <td>
              <span class="role-badge ${isOwner ? "role-admin" : "role-user"}">
                ${isOwner ? "المالك" : "عضو"}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function switchAdminTab(tabName) {
    document.querySelectorAll(".admin-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.adminTab === tabName);
    });
    document.querySelectorAll(".admin-panel").forEach((panel) => {
      panel.classList.toggle("hidden", panel.id !== `admin-tab-${tabName}`);
    });
  }

  function startEditBook(bookId) {
    const book = Books.getAllBooks().find((b) => b.id === bookId);
    if (!book) return;

    document.getElementById("book-id").value = book.id;
    document.getElementById("book-title").value = book.title || "";
    document.getElementById("book-author").value = book.author || "";
    document.getElementById("book-category").value = book.category || "study";
    document.getElementById("book-grade").value = book.grade || "عام للجميع";
    document.getElementById("book-drive-url").value = book.drive_url || "";
    document.getElementById("book-cover-url").value = book.cover_url || "";
    document.getElementById("book-description").value = book.description || "";

    document.getElementById("book-submit-btn").textContent = "حفظ التعديلات";
    document.getElementById("book-cancel-edit-btn").classList.remove("hidden");
    switchAdminTab("add-book");
  }

  function resetBookForm() {
    const form = document.getElementById("book-form");
    if (form) form.reset();
    document.getElementById("book-id").value = "";
    document.getElementById("book-submit-btn").textContent = "حفظ ونشر الكتاب";
    document.getElementById("book-cancel-edit-btn").classList.add("hidden");
  }

  async function saveBook(event) {
    event.preventDefault();
    if (!Auth.isAdmin()) {
      Utils.showToast("غير مصرح لك بهذا الإجراء.", "error");
      return;
    }

    const submitBtn = document.getElementById("book-submit-btn");
    const bookId = document.getElementById("book-id").value.trim();
    const title = document.getElementById("book-title").value.trim();
    const author = document.getElementById("book-author").value.trim();
    const category = document.getElementById("book-category").value;
    const grade = document.getElementById("book-grade").value || "عام للجميع";
    const driveUrl = Utils.sanitizeUrl(document.getElementById("book-drive-url").value);
    const coverUrl = Utils.sanitizeUrl(document.getElementById("book-cover-url").value);
    const description = document.getElementById("book-description").value.trim();

    if (!title) {
      Utils.showToast("يرجى كتابة اسم الكتاب.", "error");
      return;
    }
    if (!driveUrl) {
      Utils.showToast("يرجى إدخال رابط Google Drive صحيح يبدأ بـ https://", "error");
      return;
    }

    const supabase = DB.getClient();
    const user = Auth.getCurrentUser();
    const payload = {
      title,
      author,
      category,
      grade,
      drive_url: driveUrl,
      cover_url: coverUrl,
      description
    };

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "جاري الحفظ...";

    try {
      if (bookId) {
        const { error } = await supabase.from("books").update(payload).eq("id", bookId);
        if (error) throw error;
        Utils.showToast("تم تحديث بيانات الكتاب بنجاح.");
      } else {
        payload.created_by = user ? user.id : null;
        const { error } = await supabase.from("books").insert([payload]);
        if (error) throw error;
        Utils.showToast("تم نشر الكتاب في المكتبة بنجاح!");
      }

      resetBookForm();
      await refreshDashboardData();
    } catch (err) {
      Utils.showToast("حدث خطأ أثناء الحفظ: " + err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  async function deleteBook(bookId) {
    if (!Auth.isAdmin()) return;
    const book = Books.getAllBooks().find((b) => b.id === bookId);
    const confirmed = window.confirm(`هل أنت متأكد من حذف كتاب "${book ? book.title : ""}" نهائياً؟`);
    if (!confirmed) return;

    const supabase = DB.getClient();
    const { error } = await supabase.from("books").delete().eq("id", bookId);
    if (error) {
      Utils.showToast("تعذر حذف الكتاب: " + error.message, "error");
      return;
    }

    Utils.showToast("تم حذف الكتاب بنجاح.");
    await refreshDashboardData();
  }

  return {
    openDashboard,
    closeDashboard,
    switchAdminTab,
    startEditBook,
    resetBookForm,
    saveBook,
    deleteBook
  };
})();

/**
 * إدارة عرض الكتب والبحث والفلترة وتحويل روابط Google Drive لقراءة وتحميل PDF
 */

window.Almaktabah = window.Almaktabah || {};

window.Almaktabah.Books = (() => {
  const { CONFIG, Utils, DB } = window.Almaktabah;

  let allBooks = [];
  let activeCategory = "all";
  let activeGrade = "all";
  let searchQuery = "";

  /**
   * استخراج معرف ملف Google Drive وتحويله لرابط قراءة مباشرة ورابط تحميل مباشر
   */
  function parseDriveLinks(rawUrl) {
    const safeUrl = Utils.sanitizeUrl(rawUrl);
    if (!safeUrl) {
      return { previewUrl: "", downloadUrl: "", viewUrl: "" };
    }

    // الأنماط الشائعة لروابط Google Drive
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /[?&]id=([a-zA-Z0-9_-]+)/,
      /\/d\/([a-zA-Z0-9_-]+)/
    ];

    let fileId = "";
    if (safeUrl.includes("drive.google.com")) {
      for (const regex of patterns) {
        const match = safeUrl.match(regex);
        if (match && match[1]) {
          fileId = match[1];
          break;
        }
      }
    }

    if (fileId) {
      return {
        previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
        viewUrl: `https://drive.google.com/file/d/${fileId}/view`
      };
    }

    // في حال وضع رابط PDF مباشر من خارج Google Drive
    return {
      previewUrl: safeUrl,
      downloadUrl: safeUrl,
      viewUrl: safeUrl
    };
  }

  async function loadBooks() {
    const supabase = DB.getClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("تعذر تحميل الكتب: " + error.message);
    }

    allBooks = data || [];
    renderBooks();
    return allBooks;
  }

  function getAllBooks() {
    return allBooks;
  }

  function getFilteredBooks() {
    const q = searchQuery.trim().toLowerCase();

    return allBooks.filter((book) => {
      const matchCategory = activeCategory === "all" || book.category === activeCategory;
      const matchGrade = activeGrade === "all" || book.grade === activeGrade;
      const matchSearch =
        !q ||
        (book.title && book.title.toLowerCase().includes(q)) ||
        (book.author && book.author.toLowerCase().includes(q)) ||
        (book.description && book.description.toLowerCase().includes(q)) ||
        (book.grade && book.grade.toLowerCase().includes(q));

      return matchCategory && matchGrade && matchSearch;
    });
  }

  function renderBooks() {
    const grid = document.getElementById("books-grid");
    const emptyState = document.getElementById("empty-state");
    const emptyDesc = document.getElementById("empty-state-desc");
    const countEl = document.getElementById("books-count");
    const resetBtn = document.getElementById("reset-filters-btn");

    if (!grid) return;

    const filtered = getFilteredBooks();
    const hasFilter = activeCategory !== "all" || activeGrade !== "all" || searchQuery.trim() !== "";

    if (resetBtn) {
      resetBtn.classList.toggle("hidden", !hasFilter);
    }

    if (countEl) {
      countEl.textContent =
        allBooks.length === 0
          ? "لا توجد كتب مضافة بعد"
          : `عرض ${filtered.length} من أصل ${allBooks.length} كتاب`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = "";
      emptyState.classList.remove("hidden");
      emptyDesc.textContent =
        allBooks.length === 0
          ? "سيقوم مالك المكتبة بإضافة الكتب قريباً."
          : "جرّب تغيير كلمة البحث أو اختيار قسم أو صف آخر.";
      return;
    }

    emptyState.classList.add("hidden");

    grid.innerHTML = filtered
      .map((book) => {
        const catInfo = CONFIG.CATEGORIES[book.category] || {
          label: "عام",
          coverClass: "cover-study"
        };
        const links = parseDriveLinks(book.drive_url);
        const safeCover = Utils.sanitizeUrl(book.cover_url);
        const safeTitle = Utils.escapeHtml(book.title);
        const safeAuthor = Utils.escapeHtml(book.author);
        const safeGrade = Utils.escapeHtml(book.grade || "عام للجميع");
        const safeDesc = Utils.escapeHtml(book.description || "كتاب بصيغة PDF جاهز للقراءة والتحميل المباشر.");

        return `
          <article class="book-card">
            <div class="book-cover ${catInfo.coverClass}">
              ${safeCover ? `<img src="${Utils.escapeHtml(safeCover)}" alt="${safeTitle}" loading="lazy" />` : ""}
              <div class="book-cover-overlay">
                <span class="cover-badge">${Utils.escapeHtml(catInfo.label)}</span>
                <span class="cover-badge">${safeGrade}</span>
              </div>
              ${!safeCover ? `<div class="cover-title-preview">${safeTitle}</div>` : ""}
            </div>

            <div class="book-body">
              <h3 class="book-title">${safeTitle}</h3>
              ${safeAuthor ? `<p class="book-author">${safeAuthor}</p>` : ""}
              <p class="book-desc">${safeDesc}</p>

              <div class="book-actions">
                <button type="button" class="btn btn-primary btn-sm read-book-btn" data-book-id="${Utils.escapeHtml(book.id)}">
                  قراءة الآن
                </button>
                <a href="${Utils.escapeHtml(links.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-soft btn-sm">
                  تحميل PDF
                </a>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function openReader(bookId) {
    const book = allBooks.find((b) => b.id === bookId);
    if (!book) return;

    const links = parseDriveLinks(book.drive_url);
    if (!links.previewUrl) {
      Utils.showToast("رابط هذا الكتاب غير صالح.", "error");
      return;
    }

    const modal = document.getElementById("reader-modal");
    const titleEl = document.getElementById("reader-title");
    const subtitleEl = document.getElementById("reader-subtitle");
    const iframe = document.getElementById("reader-iframe");
    const downloadBtn = document.getElementById("reader-download-btn");
    const externalBtn = document.getElementById("reader-external-btn");

    const catInfo = CONFIG.CATEGORIES[book.category] || { label: "عام" };
    titleEl.textContent = book.title;
    subtitleEl.textContent = [catInfo.label, book.grade, book.author].filter(Boolean).join(" • ");
    iframe.src = links.previewUrl;
    downloadBtn.href = links.downloadUrl;
    externalBtn.href = links.viewUrl;

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeReader() {
    const modal = document.getElementById("reader-modal");
    const iframe = document.getElementById("reader-iframe");
    if (iframe) iframe.src = "";
    if (modal) modal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function setCategory(category) {
    activeCategory = category;
    renderBooks();
  }

  function setGrade(grade) {
    activeGrade = grade;
    renderBooks();
  }

  function setSearch(query) {
    searchQuery = query;
    renderBooks();
  }

  function resetFilters() {
    activeCategory = "all";
    activeGrade = "all";
    searchQuery = "";

    const searchInput = document.getElementById("book-search");
    const gradeSelect = document.getElementById("grade-filter");
    if (searchInput) searchInput.value = "";
    if (gradeSelect) gradeSelect.value = "all";

    document.querySelectorAll("#category-pills .pill").forEach((pill) => {
      pill.classList.toggle("active", pill.dataset.category === "all");
    });

    renderBooks();
  }

  return {
    loadBooks,
    getAllBooks,
    parseDriveLinks,
    renderBooks,
    openReader,
    closeReader,
    setCategory,
    setGrade,
    setSearch,
    resetFilters
  };
})();

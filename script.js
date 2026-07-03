// =============================================
// ANIME PULSE — Full Script with CRUD WilApps
// =============================================

let animeData = [];
let currentEditId = null;
let currentCharacters = [];
let currentDetailAnime = null;
let recentlyDeletedAnime = null;
let deleteTimeoutId = null;
let galleryImages = [];
let currentGalleryIndex = 0;
let zoomLevel = 1;
let slideTimer = null;

// Pagination variables
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalFranchises = 0;

// CRUD pagination
let crudCurrentPage = 1;
const CRUD_ITEMS_PER_PAGE = 15;
let crudTotalItems = 0;

// --- Placeholder image generator ---
function getPlaceholderImage(text = "No Image") {
  const cleanText = text.length > 20 ? text.substring(0, 18) + "…" : text;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280"><rect width="200" height="280" fill="#1a1a2e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="#6b6b7b">${cleanText}</text></svg>`)}`;
}

// --- IndexedDB ---
const DB_NAME = "AnimeTrackerDB";
const DB_VERSION = 2;
const STORE_NAME = "animeData";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function getAllAnimeData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAllAnimeData(animeArray) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.clear();
  animeArray.forEach((anime) => store.put(anime));
  return tx.done;
}

// --- Helpers ---
function getImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showToast(
  message,
  type = "info",
  duration = 3000,
  showUndo = false,
  undoCallback = null,
) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  if (showUndo && undoCallback) {
    const btn = document.createElement("button");
    btn.className = "undo-btn";
    btn.textContent = "Batalkan";
    btn.onclick = () => {
      clearTimeout(deleteTimeoutId);
      deleteTimeoutId = null;
      undoCallback();
      toast.remove();
      showToast("Penghapusan dibatalkan.", "info");
    };
    toast.appendChild(btn);
  }
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration + 400);
}

// =============================================
// NAVIGASI UTAMA
// =============================================
function hideAllSections() {
  document.querySelectorAll("section").forEach((s) => {
    if (s.id !== "heroSection") {
      s.style.display = "none";
    }
  });
  document.querySelector("main").style.display = "none";
}

function showMainPage() {
  document.querySelector("main").style.display = "block";
  const heroSection = document.getElementById("heroSection");
  if (heroSection) heroSection.style.display = "block";
  document.querySelectorAll("section").forEach((s) => {
    if (s.id !== "heroSection") {
      s.style.display = "none";
    }
  });
  resetActiveButtons();
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderAnimeList(
    getCurrentFilter(),
    document.getElementById("searchInput").value,
    document.getElementById("sortOption").value,
  );
}

function resetActiveButtons() {
  document
    .querySelectorAll(".header-right .btn-icon, .header-right .btn-primary")
    .forEach((b) => {
      b.classList.remove("active");
      b.style.background = "";
      b.style.color = "";
      b.style.borderColor = "";
    });
  document
    .querySelectorAll(".hero-actions .btn-accent, .hero-actions .btn-outline")
    .forEach((b) => {
      b.classList.remove("active");
    });
}

// --- Render ---
function updateAnimeStats() {
  const total = animeData.length;
  const ongoing = animeData.filter((a) => a.status === "On Going").length;
  const completed = animeData.filter((a) => a.status === "Completed").length;
  const planned = animeData.filter((a) => a.status === "Plan to Watch").length;
  const dropped = animeData.filter((a) => a.status === "Dropped").length;

  const watchedEps = animeData.reduce(
    (sum, a) => sum + (a.currentEpisodes || 0),
    0,
  );
  const totalMinutes = animeData.reduce(
    (sum, a) => sum + (a.duration || 24) * (a.currentEpisodes || 0),
    0,
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const rated = animeData.filter((a) => a.rating);
  const avgRating = rated.length
    ? (rated.reduce((s, a) => s + a.rating, 0) / rated.length).toFixed(2)
    : "N/A";

  // Header stats
  document.getElementById("totalCount").textContent = total;
  document.getElementById("ongoingCount").textContent = ongoing;
  document.getElementById("completedCount").textContent = completed;
  document.getElementById("plannedCount").textContent = planned;

  // Hero stats
  const totalHero = document.getElementById("totalCountHero");
  const ongoingHero = document.getElementById("ongoingCountHero");
  const completedHero = document.getElementById("completedCountHero");
  const plannedHero = document.getElementById("plannedCountHero");
  if (totalHero) totalHero.textContent = total;
  if (ongoingHero) ongoingHero.textContent = ongoing;
  if (completedHero) completedHero.textContent = completed;
  if (plannedHero) plannedHero.textContent = planned;

  document.getElementById("watchedCount").textContent = watchedEps;
  document.getElementById("watchedTime").textContent =
    `${hours} jam ${minutes} menit`;
  document.getElementById("avgRating").textContent = avgRating;

  document.getElementById("badgeAll").textContent = total;
  document.getElementById("badgeOngoing").textContent = ongoing;
  document.getElementById("badgeCompleted").textContent = completed;
  document.getElementById("badgePlanned").textContent = planned;
  document.getElementById("badgeDropped").textContent = dropped;

  const completion = total > 0 ? Math.round((completed / total) * 100) : 0;
  const ring = document.getElementById("progressRing");
  if (ring) {
    const offset = 100 - completion;
    ring.style.strokeDasharray = "100 100";
    ring.style.strokeDashoffset = offset;
  }
  document.getElementById("completionPercent").textContent = completion + "%";

  // Genre stats
  const genreList = document.getElementById("genreStats");
  if (genreList) {
    const genreCounts = {};
    animeData.forEach((a) => {
      if (a.description) {
        a.description
          .split(",")
          .map((g) => g.trim())
          .forEach((g) => {
            if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
          });
      }
    });
    genreList.innerHTML = "";
    Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([genre, count]) => {
        const li = document.createElement("li");
        li.textContent = `${genre} (${count})`;
        const hue = (Math.random() * 360 + 200) % 360;
        li.style.backgroundColor = `hsl(${hue}, 70%, 35%)`;
        li.addEventListener("click", () => {
          document.getElementById("searchInput").value = genre;
          currentPage = 1;
          renderAnimeList(
            getCurrentFilter(),
            genre,
            document.getElementById("sortOption").value,
          );
          showMainPage();
        });
        genreList.appendChild(li);
      });
  }
}

// =============================================
// PERBAIKAN UTAMA: Sorting franchise berdasarkan ID terbaru
// =============================================
function renderAnimeList(
  filterStatus = "All",
  searchTerm = "",
  sortOrder = "newest",
) {
  const container = document.getElementById("animeList");
  container.innerHTML = "";

  let filtered = [...animeData];
  if (searchTerm) {
    const s = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(s) ||
        (a.description && a.description.toLowerCase().includes(s)) ||
        (a.notes && a.notes.toLowerCase().includes(s)) ||
        (a.characters &&
          a.characters.some((c) => c.name.toLowerCase().includes(s))),
    );
  }
  if (filterStatus !== "All") {
    filtered = filtered.filter((a) => a.status === filterStatus);
  }

  // Sortir anime individual sesuai pilihan
  switch (sortOrder) {
    case "rating-desc":
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case "rating-asc":
      filtered.sort((a, b) => (a.rating || 0) - (b.rating || 0));
      break;
    case "title-asc":
      filtered.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "title-desc":
      filtered.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case "progress":
      filtered.sort(
        (a, b) =>
          (b.currentEpisodes || 0) / (b.totalEpisodes || 1) -
          (a.currentEpisodes || 0) / (a.totalEpisodes || 1),
      );
      break;
    case "newest":
    default:
      filtered.sort((a, b) => b.id - a.id);
      break;
  }

  if (filtered.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; color:var(--text-muted); padding:40px 0;">Tidak ada anime ditemukan.</p>';
    document.getElementById("paginationContainer").style.display = "none";
    return;
  }

  // Group by franchise
  const grouped = {};
  filtered.forEach((a) => {
    const key = a.franchise || a.title;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  // === PERBAIKAN: Buat array franchise dengan ID terbaru ===
  const franchiseEntries = Object.keys(grouped).map((franchise) => {
    const items = grouped[franchise];
    // Ambil ID terbesar (terbaru) di antara semua anime dalam franchise ini
    const latestId = Math.max(...items.map((a) => a.id));
    return { franchise, latestId, items };
  });

  // Urutkan berdasarkan latestId (terbaru di atas) untuk "newest", atau kebalikannya untuk "oldest"
  if (sortOrder === "newest" || sortOrder === "oldest") {
    const descending = sortOrder === "newest";
    franchiseEntries.sort((a, b) => {
      return descending ? b.latestId - a.latestId : a.latestId - b.latestId;
    });
  } else {
    // Untuk sortir lain (rating, title, progress), kita tetap urutkan berdasarkan nama franchise agar konsisten
    franchiseEntries.sort((a, b) => a.franchise.localeCompare(b.franchise));
  }

  totalFranchises = franchiseEntries.length;

  // Pagination
  const totalPages = Math.ceil(totalFranchises / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalFranchises);
  const pageEntries = franchiseEntries.slice(startIndex, endIndex);

  const isListView = document
    .getElementById("animeList")
    .classList.contains("list-view");

  pageEntries.forEach(({ franchise, items }) => {
    const wrapper = document.createElement("div");
    wrapper.className = "franchise-wrapper";

    const latestAnime = items.reduce((latest, current) => {
      return current.id > latest.id ? current : latest;
    }, items[0]);

    const totalEps = items.reduce((sum, a) => sum + (a.totalEpisodes || 1), 0);
    const watchedEps = items.reduce(
      (sum, a) => sum + (a.currentEpisodes || 0),
      0,
    );
    const franchiseProgress =
      totalEps > 0 ? Math.round((watchedEps / totalEps) * 100) : 0;
    const allCompleted = items.every((a) => a.status === "Completed");

    const header = document.createElement("div");
    header.className = "franchise-header";
    header.innerHTML = `
      <span class="toggle-icon ${allCompleted ? "" : "expanded"}">
        <i class="fas fa-chevron-right"></i>
      </span>
      <div class="franchise-cover">
        <img src="${latestAnime.imageData || getPlaceholderImage(franchise)}" alt="${franchise}" />
      </div>
      <span class="franchise-name">${franchise}</span>
      <span class="franchise-count">${items.length} anime</span>
      <div class="franchise-progress">
        <span>${franchiseProgress}%</span>
        <div class="franchise-bar">
          <div class="bar-fill" style="width:${franchiseProgress}%;"></div>
        </div>
      </div>
    `;

    const grid = document.createElement("div");
    grid.className = "franchise-grid";
    if (allCompleted && items.length > 1) {
      grid.classList.add("collapsed");
      header.querySelector(".toggle-icon i").className = "fas fa-chevron-right";
    }

    header.addEventListener("click", () => {
      grid.classList.toggle("collapsed");
      const icon = header.querySelector(".toggle-icon i");
      if (grid.classList.contains("collapsed")) {
        icon.className = "fas fa-chevron-right";
      } else {
        icon.className = "fas fa-chevron-down";
      }
    });

    items.forEach((anime) => {
      const card = document.createElement("div");
      card.className = "anime-card";
      card.dataset.id = anime.id;

      const cover = document.createElement("div");
      cover.className = "card-cover";
      const img = document.createElement("img");
      img.src =
        anime.imageData || getPlaceholderImage(anime.title || "No Image");
      img.alt = anime.title;
      img.loading = "lazy";
      cover.appendChild(img);

      const badge = document.createElement("div");
      badge.className = `status-badge ${anime.status === "On Going" ? "ongoing" : anime.status === "Completed" ? "completed" : anime.status === "Plan to Watch" ? "planned" : "dropped"}`;
      badge.textContent =
        anime.status === "On Going"
          ? "Sedang"
          : anime.status === "Completed"
            ? "Selesai"
            : anime.status === "Plan to Watch"
              ? "Rencana"
              : "Drop";
      cover.appendChild(badge);
      card.appendChild(cover);

      const body = document.createElement("div");
      body.className = "card-body";
      const title = document.createElement("h3");
      title.textContent = anime.title;
      body.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "card-meta";
      meta.innerHTML = `
        <span><i class="fas fa-star" style="color:#f4d03f;"></i> ${anime.rating || "N/A"}</span>
        <span><i class="fas fa-film"></i> ${anime.currentEpisodes || 0}/${anime.totalEpisodes || 0}</span>
        ${anime.releaseDay ? `<span><i class="fas fa-calendar"></i> ${anime.releaseDay}</span>` : ""}
      `;
      body.appendChild(meta);

      const progressDiv = document.createElement("div");
      progressDiv.className = "progress-tracker";
      const trackerRow = document.createElement("div");
      trackerRow.className = "tracker-row";
      const epsInput = document.createElement("input");
      epsInput.type = "number";
      epsInput.min = 0;
      epsInput.max = anime.totalEpisodes || 1;
      epsInput.value = anime.currentEpisodes || 0;
      const updateBtn = document.createElement("button");
      updateBtn.className = "update-progress-btn";
      updateBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
      trackerRow.appendChild(epsInput);
      trackerRow.appendChild(updateBtn);
      const progressBar = document.createElement("div");
      progressBar.className = "progress-bar-container";
      const fill = document.createElement("div");
      fill.className = "progress-bar-fill";
      const pct =
        anime.totalEpisodes > 0
          ? ((anime.currentEpisodes || 0) / anime.totalEpisodes) * 100
          : 0;
      fill.style.width = pct + "%";
      progressBar.appendChild(fill);
      trackerRow.appendChild(progressBar);
      progressDiv.appendChild(trackerRow);
      body.appendChild(progressDiv);

      updateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        let val = parseInt(epsInput.value);
        const total = anime.totalEpisodes || 1;
        if (isNaN(val) || val < 0) val = 0;
        if (val > total) val = total;
        epsInput.value = val;
        const idx = animeData.findIndex((a) => a.id === anime.id);
        if (idx !== -1) {
          animeData[idx].currentEpisodes = val;
          if (val === total && animeData[idx].status !== "Completed") {
            animeData[idx].status = "Completed";
            animeData[idx].endDate = new Date().toISOString().slice(0, 10);
            showToast(`🎉 ${animeData[idx].title} selesai!`, "success");
          } else if (val < total && animeData[idx].status === "Completed") {
            animeData[idx].status = "On Going";
            animeData[idx].endDate = "";
            showToast(
              `Status ${animeData[idx].title} diubah ke Sedang.`,
              "info",
            );
          }
          saveAllAnimeData(animeData);
          renderAnimeList(
            getCurrentFilter(),
            document.getElementById("searchInput").value,
            document.getElementById("sortOption").value,
          );
          updateAnimeStats();
          renderCrudTable(document.getElementById("crudSearchInput").value);
        }
      });

      const actions = document.createElement("div");
      actions.className = "card-actions";
      const detailBtn = document.createElement("button");
      detailBtn.className = "detail-btn";
      detailBtn.innerHTML = '<i class="fas fa-info-circle"></i> Detail';
      detailBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailModal(anime);
      });
      const editBtn = document.createElement("button");
      editBtn.className = "edit-btn";
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditModal(anime);
      });
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteAnime(anime);
      });
      actions.append(detailBtn, editBtn, delBtn);
      body.appendChild(actions);

      card.appendChild(body);
      grid.appendChild(card);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(grid);
    container.appendChild(wrapper);
  });

  updatePagination(totalPages);
  renderCrudTable(document.getElementById("crudSearchInput").value);
}

function updatePagination(totalPages) {
  const container = document.getElementById("paginationContainer");
  if (!container) return;
  if (totalFranchises <= ITEMS_PER_PAGE) {
    container.style.display = "none";
    return;
  }
  container.style.display = "flex";

  document.getElementById("pageInfo").textContent =
    `Halaman ${currentPage} dari ${totalPages}`;
  document.getElementById("totalFranchiseInfo").textContent =
    `Total ${totalFranchises} Franchise`;
  document.getElementById("prevPageBtn").disabled = currentPage === 1;
  document.getElementById("nextPageBtn").disabled = currentPage === totalPages;
}

function getCurrentFilter() {
  const active = document.querySelector(".tab-btn.active-filter");
  if (active) return active.dataset.filter;
  return "All";
}

// --- CRUD WILAPPS TABLE ---
function renderCrudTable(searchTerm = "") {
  const tbody = document.getElementById("crudTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let data = [...animeData];
  if (searchTerm) {
    const s = searchTerm.toLowerCase();
    data = data.filter(
      (a) =>
        a.title.toLowerCase().includes(s) ||
        (a.franchise && a.franchise.toLowerCase().includes(s)) ||
        (a.description && a.description.toLowerCase().includes(s)) ||
        (a.status && a.status.toLowerCase().includes(s)),
    );
  }

  data.sort((a, b) => b.id - a.id);
  crudTotalItems = data.length;

  const totalPages = Math.ceil(crudTotalItems / CRUD_ITEMS_PER_PAGE);
  if (crudCurrentPage > totalPages) crudCurrentPage = totalPages;
  if (crudCurrentPage < 1) crudCurrentPage = 1;

  const startIndex = (crudCurrentPage - 1) * CRUD_ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + CRUD_ITEMS_PER_PAGE, crudTotalItems);
  const pageData = data.slice(startIndex, endIndex);

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:30px; color:var(--text-muted);">Tidak ada data anime.</td></tr>`;
    const infoEl = document.getElementById("crudTableInfo");
    if (infoEl) infoEl.textContent = "Menampilkan 0 dari 0 anime";
    const pageInfoEl = document.getElementById("crudPageInfo");
    if (pageInfoEl) pageInfoEl.textContent = "Halaman 1";
    document.getElementById("crudPrevPage").disabled = true;
    document.getElementById("crudNextPage").disabled = true;
    return;
  }

  pageData.forEach((anime, index) => {
    const tr = document.createElement("tr");
    const pct =
      anime.totalEpisodes > 0
        ? ((anime.currentEpisodes || 0) / anime.totalEpisodes) * 100
        : 0;

    const statusClass =
      anime.status === "On Going"
        ? "ongoing"
        : anime.status === "Completed"
          ? "completed"
          : anime.status === "Plan to Watch"
            ? "planned"
            : "dropped";
    const statusLabel =
      anime.status === "On Going"
        ? "Sedang"
        : anime.status === "Completed"
          ? "Selesai"
          : anime.status === "Plan to Watch"
            ? "Rencana"
            : "Drop";

    tr.innerHTML = `
      <td>${startIndex + index + 1}</td>
      <td><img src="${anime.imageData || getPlaceholderImage(anime.title)}" alt="${anime.title}" class="table-cover" /></td>
      <td><strong>${anime.title}</strong></td>
      <td>${anime.franchise || anime.title}</td>
      <td><span class="status-badge-sm ${statusClass}">${statusLabel}</span></td>
      <td>
        <span class="progress-text">${anime.currentEpisodes || 0}/${anime.totalEpisodes || 0}</span>
        <div class="progress-bar-sm"><div class="fill" style="width:${pct}%;"></div></div>
      </td>
      <td>${anime.rating || "N/A"} ⭐</td>
      <td>${anime.releaseDay || "-"}</td>
      <td>
        <div class="table-actions">
          <button class="detail-btn-sm" onclick="openDetailModalById(${anime.id})" title="Detail"><i class="fas fa-eye"></i></button>
          <button class="edit-btn-sm" onclick="openEditModalById(${anime.id})" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="delete-btn-sm" onclick="deleteAnimeById(${anime.id})" title="Hapus"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const infoEl = document.getElementById("crudTableInfo");
  if (infoEl)
    infoEl.textContent = `Menampilkan ${pageData.length} dari ${crudTotalItems} anime`;
  const pageInfoEl = document.getElementById("crudPageInfo");
  if (pageInfoEl)
    pageInfoEl.textContent = `Halaman ${crudCurrentPage} dari ${totalPages || 1}`;
  document.getElementById("crudPrevPage").disabled = crudCurrentPage === 1;
  document.getElementById("crudNextPage").disabled =
    crudCurrentPage === totalPages || totalPages === 0;
}

// Global functions for CRUD actions
window.openDetailModalById = function (id) {
  const anime = animeData.find((a) => a.id === id);
  if (anime) {
    showMainPage();
    openDetailModal(anime);
  }
};

window.openEditModalById = function (id) {
  const anime = animeData.find((a) => a.id === id);
  if (anime) {
    closeDetailModal();
    openEditModal(anime);
  }
};

window.deleteAnimeById = function (id) {
  const anime = animeData.find((a) => a.id === id);
  if (anime) deleteAnime(anime);
};

// --- Detail Modal ---
function openDetailModal(anime) {
  currentDetailAnime = anime;
  const modal = document.getElementById("animeDetailModal");
  document.getElementById("detailTitle").textContent = anime.title;
  document.getElementById("detailImage").src =
    anime.imageData || getPlaceholderImage(anime.title || "Cover");
  document.getElementById("detailRating").textContent = anime.rating || "N/A";
  document.getElementById("detailTotalEpisodes").textContent =
    anime.totalEpisodes || 0;
  document.getElementById("detailDuration").textContent = anime.duration || 24;
  document.getElementById("detailStatus").textContent =
    anime.status === "On Going"
      ? "Sedang Ditonton"
      : anime.status === "Completed"
        ? "Selesai"
        : anime.status === "Plan to Watch"
          ? "Akan Ditonton"
          : "Drop";
  document.getElementById("detailReleaseDate").textContent =
    anime.releaseDate || "-";
  document.getElementById("detailStartDate").textContent =
    anime.startDate || "-";
  document.getElementById("detailEndDate").textContent = anime.endDate || "-";
  document.getElementById("detailDescription").textContent =
    anime.description || "-";
  document.getElementById("detailNotes").textContent = anime.notes || "-";

  const progressText = document.getElementById("detailProgressText");
  progressText.textContent = `${anime.currentEpisodes || 0}/${anime.totalEpisodes || 0}`;
  const pct =
    anime.totalEpisodes > 0
      ? ((anime.currentEpisodes || 0) / anime.totalEpisodes) * 100
      : 0;
  document.getElementById("detailProgressFill").style.width = pct + "%";

  const statusBadge = document.getElementById("detailStatusBadge");
  statusBadge.textContent =
    anime.status === "On Going"
      ? "Sedang"
      : anime.status === "Completed"
        ? "Selesai"
        : anime.status === "Plan to Watch"
          ? "Rencana"
          : "Drop";
  statusBadge.style.background =
    anime.status === "On Going"
      ? "var(--accent-ongoing)"
      : anime.status === "Completed"
        ? "var(--accent-completed)"
        : anime.status === "Plan to Watch"
          ? "var(--accent-planned)"
          : "var(--accent-dropped)";
  statusBadge.style.color = anime.status === "Plan to Watch" ? "#000" : "#fff";

  const charContainer = document.getElementById("detailCharactersList");
  charContainer.innerHTML = "";
  if (anime.characters && anime.characters.length) {
    anime.characters.forEach((c) => {
      const div = document.createElement("div");
      div.className = "char-item";
      const img = document.createElement("img");
      img.src = c.imageData || getPlaceholderImage("👤");
      img.alt = c.name;
      div.appendChild(img);
      const span = document.createElement("span");
      span.textContent = c.name;
      div.appendChild(span);
      charContainer.appendChild(div);
    });
  } else {
    charContainer.innerHTML =
      '<span style="color:var(--text-muted);">Tidak ada karakter.</span>';
  }

  modal.classList.add("show");
}

function closeDetailModal() {
  document.getElementById("animeDetailModal").classList.remove("show");
}

function openEditModal(anime) {
  currentEditId = anime.id;
  document.getElementById("modalTitle").textContent = "Edit Anime";
  document.getElementById("submitAnimeButton").style.display = "none";
  document.getElementById("updateAnimeButton").style.display = "inline-block";

  document.getElementById("title").value = anime.title || "";
  document.getElementById("franchise").value = anime.franchise || "";
  document.getElementById("videoType").value = anime.videoType || "TV";
  document.getElementById("releaseDay").value = anime.releaseDay || "";
  document.getElementById("totalEpisodes").value = anime.totalEpisodes || 1;
  document.getElementById("durationPerEpisode").value = anime.duration || 24;
  document.getElementById("description").value = anime.description || "";
  document.getElementById("notes").value = anime.notes || "";
  document.getElementById("tags").value = (anime.tags || []).join(", ");
  document.getElementById("status").value = anime.status || "On Going";
  document.getElementById("rating").value = anime.rating || 7;
  document.getElementById("releaseDate").value = anime.releaseDate || "";
  document.getElementById("startDate").value = anime.startDate || "";
  document.getElementById("endDate").value = anime.endDate || "";

  if (anime.imageData) {
    document.getElementById("currentImagePreview").src = anime.imageData;
    document.getElementById("currentImagePreview").style.display = "block";
  } else {
    document.getElementById("currentImagePreview").style.display = "none";
  }

  currentCharacters = anime.characters ? [...anime.characters] : [];
  renderCharactersInModal();

  document.getElementById("animeModal").classList.add("show");
}

function deleteAnime(anime) {
  if (!confirm(`Hapus anime "${anime.title}"?`)) return;
  if (deleteTimeoutId) clearTimeout(deleteTimeoutId);
  recentlyDeletedAnime = anime;
  animeData = animeData.filter((a) => a.id !== anime.id);
  renderAnimeList(
    getCurrentFilter(),
    document.getElementById("searchInput").value,
    document.getElementById("sortOption").value,
  );
  updateAnimeStats();
  renderCrudTable(document.getElementById("crudSearchInput").value);

  showToast(`"${anime.title}" dihapus.`, "info", 5000, true, () => {
    if (recentlyDeletedAnime) {
      animeData.push(recentlyDeletedAnime);
      animeData.sort((a, b) => b.id - a.id);
      recentlyDeletedAnime = null;
      saveAllAnimeData(animeData);
      renderAnimeList(
        getCurrentFilter(),
        document.getElementById("searchInput").value,
        document.getElementById("sortOption").value,
      );
      updateAnimeStats();
      renderCrudTable(document.getElementById("crudSearchInput").value);
    }
  });

  deleteTimeoutId = setTimeout(() => {
    if (recentlyDeletedAnime && recentlyDeletedAnime.id === anime.id) {
      saveAllAnimeData(animeData);
      recentlyDeletedAnime = null;
    }
    deleteTimeoutId = null;
  }, 5000);
}

function renderCharactersInModal() {
  const container = document.getElementById("favoriteCharactersList");
  container.innerHTML = "";
  if (!currentCharacters.length) {
    container.innerHTML =
      '<span style="color:var(--text-muted); font-size:0.75rem;">Belum ada karakter.</span>';
    return;
  }
  currentCharacters.forEach((c, idx) => {
    const pill = document.createElement("div");
    pill.className = "char-pill";
    const img = document.createElement("img");
    img.src = c.imageData || getPlaceholderImage("👤");
    pill.appendChild(img);
    const name = document.createElement("span");
    name.textContent = c.name;
    pill.appendChild(name);
    const del = document.createElement("button");
    del.className = "remove-char";
    del.innerHTML = "&times;";
    del.addEventListener("click", () => {
      currentCharacters.splice(idx, 1);
      renderCharactersInModal();
    });
    pill.appendChild(del);
    container.appendChild(pill);
  });
}

function showAnimeByGenre(genre) {
  showMainPage();
  const container = document.getElementById("animeList");
  container.innerHTML = "";
  const filtered = animeData.filter(
    (a) =>
      a.description &&
      a.description
        .split(",")
        .map((g) => g.trim())
        .includes(genre),
  );
  if (!filtered.length) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:40px 0;">Tidak ada anime dengan genre "${genre}".</p>`;
    return;
  }
  filtered.forEach((a) => {
    const card = document.createElement("div");
    card.className = "anime-card";
    card.style.width = "200px";
    card.innerHTML = `
      <div class="card-cover"><img src="${a.imageData || getPlaceholderImage(a.title)}" alt="${a.title}"></div>
      <div class="card-body"><h3>${a.title}</h3><p style="font-size:0.75rem; color:var(--text-secondary);">${a.description}</p></div>
    `;
    card.addEventListener("click", () => openDetailModal(a));
    container.appendChild(card);
  });
}

// --- RENDER KARAKTER FAVORIT ---
function renderAllFavoriteCharacters(filterGender = "all") {
  // ... (sama seperti sebelumnya, tidak diubah)
}

// --- KALENDER MINGGUAN ---
function renderWeeklyCalendar() {
  // ... (sama seperti sebelumnya, tidak diubah)
}

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", async () => {
  animeData = await getAllAnimeData();
  renderAnimeList();
  updateAnimeStats();

  // Tab filter
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active-filter"));
      btn.classList.add("active-filter");
      currentPage = 1;
      showMainPage();
      renderAnimeList(
        btn.dataset.filter,
        document.getElementById("searchInput").value,
        document.getElementById("sortOption").value,
      );
    });
  });

  // View toggle
  const gridViewBtn = document.getElementById("gridViewBtn");
  const listViewBtn = document.getElementById("listViewBtn");
  if (gridViewBtn && listViewBtn) {
    gridViewBtn.addEventListener("click", () => {
      document.getElementById("animeList").classList.remove("list-view");
      gridViewBtn.classList.add("active-view");
      listViewBtn.classList.remove("active-view");
      showMainPage();
      renderAnimeList(
        getCurrentFilter(),
        document.getElementById("searchInput").value,
        document.getElementById("sortOption").value,
      );
    });
    listViewBtn.addEventListener("click", () => {
      document.getElementById("animeList").classList.add("list-view");
      listViewBtn.classList.add("active-view");
      gridViewBtn.classList.remove("active-view");
      showMainPage();
      renderAnimeList(
        getCurrentFilter(),
        document.getElementById("searchInput").value,
        document.getElementById("sortOption").value,
      );
    });
  }

  // Search & sort
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentPage = 1;
      showMainPage();
      renderAnimeList(
        getCurrentFilter(),
        searchInput.value,
        document.getElementById("sortOption").value,
      );
    });
  }
  const sortOption = document.getElementById("sortOption");
  if (sortOption) {
    sortOption.addEventListener("change", () => {
      currentPage = 1;
      showMainPage();
      renderAnimeList(
        getCurrentFilter(),
        document.getElementById("searchInput").value,
        sortOption.value,
      );
    });
  }

  // Pagination
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        showMainPage();
        renderAnimeList(
          getCurrentFilter(),
          document.getElementById("searchInput").value,
          document.getElementById("sortOption").value,
        );
      }
    });
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      const totalPages = Math.ceil(totalFranchises / ITEMS_PER_PAGE);
      if (currentPage < totalPages) {
        currentPage++;
        showMainPage();
        renderAnimeList(
          getCurrentFilter(),
          document.getElementById("searchInput").value,
          document.getElementById("sortOption").value,
        );
      }
    });
  }

  // CRUD table search
  const crudSearchInput = document.getElementById("crudSearchInput");
  if (crudSearchInput) {
    crudSearchInput.addEventListener("input", () => {
      crudCurrentPage = 1;
      renderCrudTable(crudSearchInput.value);
    });
  }
  const crudRefreshBtn = document.getElementById("crudRefreshBtn");
  if (crudRefreshBtn) {
    crudRefreshBtn.addEventListener("click", () => {
      if (crudSearchInput) crudSearchInput.value = "";
      crudCurrentPage = 1;
      renderCrudTable();
      showToast("Tabel diperbarui.", "info");
    });
  }

  // CRUD pagination
  const crudPrevPage = document.getElementById("crudPrevPage");
  const crudNextPage = document.getElementById("crudNextPage");
  if (crudPrevPage) {
    crudPrevPage.addEventListener("click", () => {
      if (crudCurrentPage > 1) {
        crudCurrentPage--;
        renderCrudTable(crudSearchInput ? crudSearchInput.value : "");
      }
    });
  }
  if (crudNextPage) {
    crudNextPage.addEventListener("click", () => {
      const totalPages = Math.ceil(crudTotalItems / CRUD_ITEMS_PER_PAGE);
      if (crudCurrentPage < totalPages) {
        crudCurrentPage++;
        renderCrudTable(crudSearchInput ? crudSearchInput.value : "");
      }
    });
  }

  // CRUD Export
  const crudExportBtn = document.getElementById("crudExportBtn");
  if (crudExportBtn) {
    crudExportBtn.addEventListener("click", () => {
      const dataStr = JSON.stringify(animeData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anime_data_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Export berhasil!", "success");
    });
  }

  // Toggle CRUD section
  const toggleCrudBtn = document.getElementById("toggleCrudBtn");
  if (toggleCrudBtn) {
    toggleCrudBtn.addEventListener("click", () => {
      const section = document.getElementById("crudSection");
      if (!section) return;
      const isActive = toggleCrudBtn.classList.contains("active");
      if (isActive) {
        showMainPage();
        toggleCrudBtn.classList.remove("active");
        return;
      }
      hideAllSections();
      resetActiveButtons();
      toggleCrudBtn.classList.add("active");
      section.style.display = "block";
      renderCrudTable(crudSearchInput ? crudSearchInput.value : "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Open add modal
  const openAddBtn = document.getElementById("openAddAnimeModal");
  if (openAddBtn) {
    openAddBtn.addEventListener("click", () => {
      document.getElementById("modalTitle").textContent = "Tambah Anime";
      document.getElementById("submitAnimeButton").style.display =
        "inline-block";
      document.getElementById("updateAnimeButton").style.display = "none";
      document.getElementById("animeForm").reset();
      document.getElementById("currentImagePreview").style.display = "none";
      currentCharacters = [];
      renderCharactersInModal();
      currentEditId = null;
      document.getElementById("animeModal").classList.add("show");
    });
  }

  // Close modals
  document.querySelectorAll(".close-button, #cancelModal").forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("animeModal").classList.remove("show");
      document.getElementById("animeDetailModal").classList.remove("show");
    });
  });
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      document
        .querySelectorAll(".modal")
        .forEach((m) => m.classList.remove("show"));
    }
  });

  // Add character
  const addCharBtn = document.getElementById("addCharacterBtn");
  if (addCharBtn) {
    addCharBtn.addEventListener("click", async () => {
      const name = document.getElementById("charName").value.trim();
      if (!name) {
        showToast("Nama karakter harus diisi.", "error");
        return;
      }
      const gender = document.getElementById("charGender").value;
      const birthday = document.getElementById("charBirthday").value;
      let imageData = null;
      const file = document.getElementById("charImageUpload").files[0];
      if (file) imageData = await getImageDataUrl(file);
      currentCharacters.push({
        id: Date.now(),
        name,
        gender,
        birthday,
        imageData,
      });
      renderCharactersInModal();
      document.getElementById("charName").value = "";
      document.getElementById("charGender").value = "";
      document.getElementById("charBirthday").value = "";
      document.getElementById("charImageUpload").value = "";
      showToast(`Karakter "${name}" ditambahkan.`, "success");
    });
  }

  // Form submit
  document.getElementById("animeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    let imageData = null;
    const file = document.getElementById("imageUpload").files[0];
    if (file) imageData = await getImageDataUrl(file);
    else if (currentEditId) {
      const existing = animeData.find((a) => a.id === currentEditId);
      if (existing) imageData = existing.imageData;
    }

    const anime = {
      id: currentEditId || Date.now(),
      title: document.getElementById("title").value.trim(),
      franchise:
        document.getElementById("franchise").value.trim() ||
        document.getElementById("title").value.trim(),
      videoType: document.getElementById("videoType").value,
      imageData: imageData,
      releaseDay: document.getElementById("releaseDay").value,
      totalEpisodes:
        parseInt(document.getElementById("totalEpisodes").value) || 1,
      duration:
        parseInt(document.getElementById("durationPerEpisode").value) || 24,
      description: document.getElementById("description").value.trim(),
      notes: document.getElementById("notes").value.trim(),
      tags: document
        .getElementById("tags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status: document.getElementById("status").value,
      rating: parseInt(document.getElementById("rating").value) || 0,
      releaseDate: document.getElementById("releaseDate").value,
      startDate: document.getElementById("startDate").value,
      endDate: document.getElementById("endDate").value,
      characters: currentCharacters,
      currentEpisodes: currentEditId
        ? animeData.find((a) => a.id === currentEditId)?.currentEpisodes || 0
        : 0,
    };

    if (currentEditId) {
      const idx = animeData.findIndex((a) => a.id === currentEditId);
      if (idx !== -1) {
        anime.currentEpisodes = animeData[idx].currentEpisodes || 0;
        animeData[idx] = anime;
        showToast(`"${anime.title}" diperbarui.`, "success");
      }
    } else {
      animeData.push(anime);
      showToast(`"${anime.title}" ditambahkan.`, "success");
    }
    await saveAllAnimeData(animeData);
    currentPage = 1;
    showMainPage();
    renderAnimeList(
      getCurrentFilter(),
      document.getElementById("searchInput").value,
      document.getElementById("sortOption").value,
    );
    updateAnimeStats();
    renderCrudTable(document.getElementById("crudSearchInput").value);
    document.getElementById("animeModal").classList.remove("show");
  });

  // Watch next episode
  const watchBtn = document.getElementById("watchEpisodeBtn");
  if (watchBtn) {
    watchBtn.addEventListener("click", () => {
      if (!currentDetailAnime) return;
      const anime = currentDetailAnime;
      if (typeof anime.currentEpisodes !== "number") anime.currentEpisodes = 0;
      if (anime.currentEpisodes < anime.totalEpisodes) {
        anime.currentEpisodes++;
        if (anime.currentEpisodes >= anime.totalEpisodes) {
          anime.status = "Completed";
          anime.endDate = new Date().toISOString().slice(0, 10);
          showToast(`🎉 "${anime.title}" selesai!`, "success");
        } else {
          showToast(
            `Progres: ${anime.currentEpisodes}/${anime.totalEpisodes}`,
            "info",
          );
        }
        saveAllAnimeData(animeData);
        renderAnimeList(
          getCurrentFilter(),
          document.getElementById("searchInput").value,
          document.getElementById("sortOption").value,
        );
        updateAnimeStats();
        renderCrudTable(document.getElementById("crudSearchInput").value);
        openDetailModal(anime);
      } else {
        showToast("Semua episode sudah ditonton.", "info");
      }
    });
  }

  // Backup
  const backupBtn = document.getElementById("backupDataBtn");
  if (backupBtn) {
    backupBtn.addEventListener("click", () => {
      const dataStr = JSON.stringify(animeData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anime_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Backup berhasil!", "success");
    });
  }

  // Import
  const importBtn = document.getElementById("importDataBtn");
  const importInput = document.getElementById("importDataInput");
  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => {
      importInput.click();
    });
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data)) {
            if (confirm("Data saat ini akan diganti. Lanjutkan?")) {
              animeData = data;
              await saveAllAnimeData(animeData);
              currentPage = 1;
              showMainPage();
              renderAnimeList(
                getCurrentFilter(),
                document.getElementById("searchInput").value,
                document.getElementById("sortOption").value,
              );
              updateAnimeStats();
              renderCrudTable(document.getElementById("crudSearchInput").value);
              showToast("Impor berhasil!", "success");
            }
          } else {
            showToast("Format JSON tidak valid.", "error");
          }
        } catch (err) {
          showToast("Gagal membaca file.", "error");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  // Toggle Stats
  const statsBtn = document.getElementById("showStatsBtn");
  if (statsBtn) {
    statsBtn.addEventListener("click", () => {
      const section = document.getElementById("statsSection");
      if (!section) return;
      const isActive = statsBtn.classList.contains("active");
      if (isActive) {
        showMainPage();
        statsBtn.classList.remove("active");
        return;
      }
      hideAllSections();
      resetActiveButtons();
      statsBtn.classList.add("active");
      section.style.display = "block";
      renderCharts();
      updateStorageUsage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Toggle Gallery
  const galleryBtn = document.getElementById("toggleGalleryBtn");
  if (galleryBtn) {
    galleryBtn.addEventListener("click", () => {
      const section = document.getElementById("gallerySection");
      if (!section) return;
      const isActive = galleryBtn.classList.contains("active");
      if (isActive) {
        showMainPage();
        galleryBtn.classList.remove("active");
        return;
      }
      hideAllSections();
      resetActiveButtons();
      galleryBtn.classList.add("active");
      section.style.display = "block";
      renderGallery();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Toggle Characters
  const charsBtn = document.getElementById("toggleCharactersBtn");
  if (charsBtn) {
    charsBtn.addEventListener("click", () => {
      const section = document.getElementById("allFavoriteCharactersSection");
      if (!section) return;
      const isActive = charsBtn.classList.contains("active");
      if (isActive) {
        showMainPage();
        charsBtn.classList.remove("active");
        return;
      }
      hideAllSections();
      resetActiveButtons();
      charsBtn.classList.add("active");
      section.style.display = "block";
      renderAllFavoriteCharacters("all");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Toggle All Release
  const allReleaseBtn = document.getElementById("showAllReleaseBtn");
  if (allReleaseBtn) {
    allReleaseBtn.addEventListener("click", () => {
      const section = document.getElementById("allReleaseSection");
      if (!section) return;
      const isActive = allReleaseBtn.classList.contains("active");
      if (isActive) {
        showMainPage();
        allReleaseBtn.classList.remove("active");
        return;
      }
      hideAllSections();
      resetActiveButtons();
      allReleaseBtn.classList.add("active");
      section.style.display = "block";
      renderAllRelease();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function renderAllRelease() {
    const section = document.getElementById("allReleaseSection");
    const grid =
      document.getElementById("allReleaseGrid") ||
      document.createElement("div");
    grid.id = "allReleaseGrid";
    grid.className = "anime-grid";
    section.innerHTML = `<h2 class="section-title">📆 Semua Anime Tayang</h2>`;
    section.appendChild(grid);
    const today = new Date();
    const filtered = animeData.filter(
      (a) =>
        a.releaseDay &&
        a.status === "On Going" &&
        new Date(a.releaseDate) <= today,
    );
    grid.innerHTML = "";
    if (!filtered.length) {
      grid.innerHTML =
        '<p style="color:var(--text-muted);">Tidak ada anime tayang.</p>';
    } else {
      filtered.forEach((a) => {
        const card = document.createElement("div");
        card.className = "anime-card";
        card.style.width = "200px";
        card.innerHTML = `
          <div class="card-cover"><img src="${a.imageData || getPlaceholderImage(a.title)}" /></div>
          <div class="card-body"><h3>${a.title}</h3><p style="font-size:0.7rem;color:var(--text-secondary);">${a.releaseDay} · ${a.currentEpisodes || 0}/${a.totalEpisodes || 0}</p></div>
        `;
        card.addEventListener("click", () => openDetailModal(a));
        grid.appendChild(card);
      });
    }
  }

  // Toggle Weekly Calendar
  const weeklyBtn = document.getElementById("weeklyCalendarBtn");
  if (weeklyBtn) {
    weeklyBtn.addEventListener("click", () => {
      const section = document.getElementById("weeklyCalendarSection");
      if (!section) return;
      const isActive = weeklyBtn.classList.contains("active");
      if (isActive) {
        showMainPage();
        weeklyBtn.classList.remove("active");
        return;
      }
      hideAllSections();
      resetActiveButtons();
      weeklyBtn.classList.add("active");
      section.style.display = "block";
      renderWeeklyCalendar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Continue watching
  const continueBtn = document.getElementById("continueWatchBtn");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      showMainPage();
      const last = animeData
        .filter((a) => a.status === "On Going")
        .sort((a, b) => b.id - a.id)[0];
      if (last) openDetailModal(last);
      else showToast("Tidak ada anime yang sedang ditonton.", "info");
    });
  }

  // Fill from franchise
  const fillFranchiseBtn = document.getElementById("fillFromFranchiseBtn");
  if (fillFranchiseBtn) {
    fillFranchiseBtn.addEventListener("click", () => {
      const franchise = document.getElementById("franchise").value.trim();
      if (!franchise) {
        showToast("Isi franchise terlebih dahulu.", "error");
        return;
      }
      const currentId = currentEditId;
      const currentAnime = animeData.find((a) => a.id === currentId);
      if (!currentAnime) {
        showToast("Anime tidak ditemukan.", "error");
        return;
      }
      const others = animeData.filter(
        (a) =>
          a.franchise === franchise &&
          a.id !== currentId &&
          a.characters?.length,
      );
      const newChars = [];
      others.forEach((a) => {
        a.characters.forEach((c) => {
          if (!currentAnime.characters?.some((x) => x.name === c.name)) {
            newChars.push({ ...c });
          }
        });
      });
      if (!newChars.length) {
        showToast("Tidak ada karakter baru.", "info");
        return;
      }
      if (!currentAnime.characters) currentAnime.characters = [];
      currentAnime.characters.push(...newChars);
      currentCharacters = currentAnime.characters;
      renderCharactersInModal();
      saveAllAnimeData(animeData);
      showToast(
        `${newChars.length} karakter ditambahkan dari franchise.`,
        "success",
      );
    });
  }

  // Toggle Today Release
  const todayBtn = document.getElementById("showTodayReleaseBtn");
  if (todayBtn) {
    todayBtn.addEventListener("click", () => {
      const section = document.getElementById("todayReleaseSection");
      if (!section) return;
      const isActive = todayBtn.classList.contains("active");
      if (isActive) {
        showMainPage();
        todayBtn.classList.remove("active");
        return;
      }
      hideAllSections();
      resetActiveButtons();
      todayBtn.classList.add("active");
      section.style.display = "block";
      const today = new Date();
      const days = [
        "Minggu",
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu",
      ];
      const todayName = days[today.getDay()];
      const todaysAnime = animeData.filter((a) => a.releaseDay === todayName);
      section.innerHTML = `<h2 style="font-size:1rem; margin-bottom:10px;">📅 Tayang Hari Ini (${todayName})</h2><div class="anime-grid" id="todayAnimeList"></div>`;
      const grid = document.getElementById("todayAnimeList");
      if (!todaysAnime.length) {
        grid.innerHTML =
          '<p style="color:var(--text-muted);">Tidak ada anime tayang hari ini.</p>';
      } else {
        todaysAnime.forEach((a) => {
          const card = document.createElement("div");
          card.className = "anime-card";
          card.style.width = "200px";
          card.innerHTML = `
            <div class="card-cover"><img src="${a.imageData || getPlaceholderImage(a.title)}" alt="${a.title}"></div>
            <div class="card-body"><h3>${a.title}</h3><p style="font-size:0.7rem; color:var(--text-secondary);">${a.status} · ${a.currentEpisodes || 0}/${a.totalEpisodes || 0}</p></div>
          `;
          card.addEventListener("click", () => openDetailModal(a));
          grid.appendChild(card);
        });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Render charts
  function renderCharts() {
    updateAnimeStats();
    const statusCounts = {
      "On Going": animeData.filter((a) => a.status === "On Going").length,
      Completed: animeData.filter((a) => a.status === "Completed").length,
      "Plan to Watch": animeData.filter((a) => a.status === "Plan to Watch")
        .length,
      Dropped: animeData.filter((a) => a.status === "Dropped").length,
    };
    try {
      const canvas = document.getElementById("statusChart");
      if (canvas) {
        if (window._chartInstance) {
          window._chartInstance.destroy();
        }
        window._chartInstance = new Chart(canvas, {
          type: "doughnut",
          data: {
            labels: ["Sedang", "Selesai", "Rencana", "Drop"],
            datasets: [
              {
                data: [
                  statusCounts["On Going"],
                  statusCounts["Completed"],
                  statusCounts["Plan to Watch"],
                  statusCounts["Dropped"],
                ],
                backgroundColor: ["#e94560", "#4e9f3d", "#f4d03f", "#6c757d"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                position: "bottom",
                labels: { color: "#a8a8b8", font: { size: 11 } },
              },
            },
            cutout: "65%",
          },
        });
      }
    } catch (e) {
      console.error("Chart error:", e);
    }
  }

  async function updateStorageUsage() {
    const usageEl = document.getElementById("storageUsage");
    const progressEl = document.getElementById("storageProgress");
    if (!usageEl || !progressEl) {
      setTimeout(updateStorageUsage, 200);
      return;
    }
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate();
        const usedMB = (usage / (1024 * 1024)).toFixed(2);
        const quotaMB = (quota / (1024 * 1024)).toFixed(2);
        const pct = Math.min((usage / quota) * 100, 100).toFixed(2);
        usageEl.textContent = `${usedMB} MB / ${quotaMB} MB (${pct}%)`;
        progressEl.style.width = pct + "%";
        progressEl.className =
          "progress-fill " +
          (parseFloat(pct) < 60
            ? "green"
            : parseFloat(pct) < 85
              ? "yellow"
              : "red");
      } else {
        usageEl.textContent = "Storage API tidak didukung.";
      }
    } catch (err) {
      usageEl.textContent = "Tidak dapat mengakses storage.";
    }
  }

  const quotaBtn = document.getElementById("checkQuotaBtn");
  if (quotaBtn) {
    quotaBtn.addEventListener("click", updateStorageUsage);
  }

  // Initial render
  renderAnimeList("All", "", document.getElementById("sortOption").value);

  // ---- PWA Install Prompt ----
  let deferredPrompt;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  if (window.matchMedia("(display-mode: standalone)").matches) {
    console.log("Aplikasi berjalan sebagai PWA terinstall");
  }

  // ---- Service Worker (hanya jika protocol http/https) ----
  if (
    "serviceWorker" in navigator &&
    window.location.protocol.startsWith("http")
  ) {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(() => console.log("Service Worker terdaftar"))
      .catch((err) => console.error("Gagal register SW:", err));
  }
});
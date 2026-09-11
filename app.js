const API_BASE = "https://api.mangadex.org";
const COVER_BASE = "https://uploads.mangadex.org/covers";
const CONTENT_RATING = ["safe", "suggestive"];

const heroEl = document.getElementById("hero");
const gridEl = document.getElementById("mangaGrid");
const gridTitleEl = document.getElementById("gridTitle");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

function buildQuery(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => parts.push(`${key}[]=${encodeURIComponent(v)}`));
    } else {
      parts.push(`${key}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join("&");
}

function getTitle(manga) {
  const titles = manga.attributes.title;
  return titles.en || Object.values(titles)[0] || "Untitled";
}

function getDescription(manga) {
  const desc = manga.attributes.description;
  return desc?.en || Object.values(desc || {})[0] || "";
}

function getCoverUrl(manga, size = 256) {
  const coverRel = manga.relationships.find((r) => r.type === "cover_art");
  const fileName = coverRel?.attributes?.fileName;
  if (!fileName) return "";
  return `${COVER_BASE}/${manga.id}/${fileName}.${size}.jpg`;
}

async function fetchTrendingManga() {
  const query = buildQuery({
    limit: 20,
    "order[followedCount]": "desc",
    includes: ["cover_art"],
    contentRating: CONTENT_RATING,
  });
  const res = await fetch(`${API_BASE}/manga?${query}`);
  if (!res.ok) throw new Error("Failed to load trending manga");
  const json = await res.json();
  return json.data;
}

async function searchManga(term) {
  const query = buildQuery({
    title: term,
    limit: 20,
    includes: ["cover_art"],
    contentRating: CONTENT_RATING,
  });
  const res = await fetch(`${API_BASE}/manga?${query}`);
  if (!res.ok) throw new Error("Search failed");
  const json = await res.json();
  return json.data;
}

function renderHero(manga) {
  if (!manga) {
    heroEl.style.background = "var(--ink)";
    return;
  }
  const cover = getCoverUrl(manga, 512);
  heroEl.style.backgroundImage = cover ? `url('${cover}')` : "none";
  heroEl.innerHTML = `
    <div class="hero-content">
      <h1 class="hero-title">${getTitle(manga)}</h1>
      <p class="hero-desc">${getDescription(manga)}</p>
      <a class="hero-cta" href="#" data-manga-id="${manga.id}">View details</a>
    </div>
  `;
}

function renderGrid(mangaList) {
  gridEl.innerHTML = "";

  if (mangaList.length === 0) {
    gridEl.innerHTML = `<p class="status-msg">No results found.</p>`;
    return;
  }

  mangaList.forEach((manga) => {
    const card = document.createElement("div");
    card.className = "manga-card";
    card.dataset.mangaId = manga.id;

    const cover = getCoverUrl(manga, 256);
    card.innerHTML = `
      <img src="${cover}" alt="${getTitle(manga)} cover" loading="lazy" />
      <div class="card-title">${getTitle(manga)}</div>
    `;

    card.addEventListener("click", () => {
      console.log("Open detail page for manga:", manga.id);
    });

    gridEl.appendChild(card);
  });
}

function showStatus(message) {
  gridEl.innerHTML = `<p class="status-msg">${message}</p>`;
}

async function loadTrending() {
  gridTitleEl.textContent = "Trending now";
  showStatus("Loading manga…");
  try {
    const results = await fetchTrendingManga();
    renderHero(results[0]);
    renderGrid(results);
  } catch (err) {
    console.error(err);
    showStatus("Something went wrong loading manga. Try refreshing.");
  }
}

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const term = searchInput.value.trim();
  if (!term) return;

  gridTitleEl.textContent = `Results for "${term}"`;
  showStatus("Searching…");
  try {
    const results = await searchManga(term);
    renderGrid(results);
  } catch (err) {
    console.error(err);
    showStatus("Search failed. Try again.");
  }
});

loadTrending();

const API_BASE = "https://api.mangadex.org";
const COVER_BASE = "https://uploads.mangadex.org/covers";
const CONTENT_RATING = ["safe", "suggestive"];

const heroEl = document.getElementById("hero");
const gridEl = document.getElementById("mangaGrid");
const gridTitleEl = document.getElementById("gridTitle");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const genreFilterEl = document.getElementById("genreFilter");

async function apiFetch(pathAndQuery) {
  try {
    const res = await fetch(`/api/mangadex?path=${encodeURIComponent(pathAndQuery)}`);
    if (res.ok) return res;
  } catch (err) {}
  return fetch(`${API_BASE}${pathAndQuery}`);
}

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

let genreTagsCache = null;

async function fetchGenreTags() {
  if (genreTagsCache) return genreTagsCache;
  const res = await apiFetch(`/manga/tag`);
  const json = await res.json();
  genreTagsCache = json.data
    .filter((t) => t.attributes.group === "genre")
    .map((t) => ({ id: t.id, name: t.attributes.name.en }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return genreTagsCache;
}

async function populateGenreFilter() {
  try {
    const tags = await fetchGenreTags();
    tags.forEach((tag) => {
      const opt = document.createElement("option");
      opt.value = tag.id;
      opt.textContent = tag.name;
      genreFilterEl.appendChild(opt);
    });
  } catch (err) {
    console.error("Couldn't load genre list:", err);
  }
}

async function fetchManga({ title, tagId } = {}) {
  const params = {
    limit: 20,
    includes: ["cover_art"],
    contentRating: CONTENT_RATING,
  };

  if (title) {
    params.title = title;
  } else {
    params["order[followedCount]"] = "desc";
  }

  if (tagId) {
    params.includedTags = [tagId];
  }

  const query = buildQuery(params);
  const res = await apiFetch(`/manga?${query}`);
  if (!res.ok) throw new Error("Failed to load manga");
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
      <a class="hero-cta" href="detail.html?id=${manga.id}">View details</a>
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
      window.location.href = `detail.html?id=${manga.id}`;
    });

    gridEl.appendChild(card);
  });
}

function showStatus(message) {
  gridEl.innerHTML = `<p class="status-msg">${message}</p>`;
}

async function runView() {
  const term = searchInput.value.trim();
  const tagId = genreFilterEl.value || null;
  const selectedGenreName = tagId
    ? genreFilterEl.options[genreFilterEl.selectedIndex].textContent
    : null;

  if (term && selectedGenreName) {
    gridTitleEl.textContent = `"${term}" in ${selectedGenreName}`;
  } else if (term) {
    gridTitleEl.textContent = `Results for "${term}"`;
  } else if (selectedGenreName) {
    gridTitleEl.textContent = selectedGenreName;
  } else {
    gridTitleEl.textContent = "Trending now";
  }

  showStatus(term || tagId ? "Searching…" : "Loading manga…");

  try {
    const results = await fetchManga({ title: term || undefined, tagId });
    if (!term && !tagId) renderHero(results[0]);
    renderGrid(results);
  } catch (err) {
    console.error(err);
    showStatus("Something went wrong. Try again.");
  }
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  runView();
});

genreFilterEl.addEventListener("change", () => {
  runView();
});

const urlParams = new URLSearchParams(window.location.search);
const initialSearch = urlParams.get("search");
if (initialSearch) searchInput.value = initialSearch;

populateGenreFilter().then(runView);
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
    const res = await fetch(
      `/api/mangadex?path=${encodeURIComponent(pathAndQuery)}`
    );

    if (res.ok) {
      return res;
    }
  } catch (err) {}

  return fetch(`${API_BASE}${pathAndQuery}`);
}

function buildQuery(params) {
  const parts = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        parts.push(`${key}[]=${encodeURIComponent(item)}`);
      });
    } else {
      parts.push(`${key}=${encodeURIComponent(value)}`);
    }
  }

  return parts.join("&");
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char]
  );
}

function getTitle(manga) {
  const titles = manga.attributes.title || {};

  return titles.en || Object.values(titles)[0] || "Untitled";
}

function getDescription(manga) {
  const descriptions = manga.attributes.description || {};

  return descriptions.en || Object.values(descriptions)[0] || "";
}

function getDirectCoverUrl(manga, size = 256) {
  const coverRel = manga.relationships?.find(
    (relationship) => relationship.type === "cover_art"
  );

  const fileName = coverRel?.attributes?.fileName;

  if (!fileName) {
    return "";
  }

  return `${COVER_BASE}/${manga.id}/${fileName}.${size}.jpg`;
}

function proxyImageUrl(url) {
  if (!url) {
    return "";
  }

  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function loadCoverImage(img, directUrl) {
  if (!directUrl) {
    img.removeAttribute("src");
    return;
  }

  let triedDirect = false;

  img.addEventListener("error", () => {
    if (triedDirect) {
      return;
    }

    triedDirect = true;
    img.referrerPolicy = "no-referrer";
    img.src = directUrl;
  });

  img.src = proxyImageUrl(directUrl);
}

let genreTagsCache = null;

async function fetchGenreTags() {
  if (genreTagsCache) {
    return genreTagsCache;
  }

  const res = await apiFetch("/manga/tag");

  if (!res.ok) {
    throw new Error("Failed to load genre tags");
  }

  const json = await res.json();

  genreTagsCache = json.data
    .filter((tag) => tag.attributes.group === "genre")
    .map((tag) => ({
      id: tag.id,
      name: tag.attributes.name.en || Object.values(tag.attributes.name)[0],
    }))
    .filter((tag) => tag.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  return genreTagsCache;
}

async function populateGenreFilter() {
  try {
    const tags = await fetchGenreTags();

    tags.forEach((tag) => {
      const option = document.createElement("option");

      option.value = tag.id;
      option.textContent = tag.name;

      genreFilterEl.appendChild(option);
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
    availableTranslatedLanguage: ["en"],
    hasAvailableChapters: true,
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

  if (!res.ok) {
    throw new Error(`Failed to load manga: ${res.status}`);
  }

  const json = await res.json();

  return Array.isArray(json.data) ? json.data : [];
}

function renderHero(manga) {
  if (!manga) {
    heroEl.style.backgroundImage = "none";
    heroEl.style.backgroundColor = "var(--ink)";
    heroEl.innerHTML = "";
    return;
  }

  const directCover = getDirectCoverUrl(manga, 512);
  const cover = proxyImageUrl(directCover);

  heroEl.style.backgroundImage = cover ? `url("${cover}")` : "none";

  heroEl.innerHTML = `
    <div class="hero-content">
      <h1 class="hero-title">${escapeHtml(getTitle(manga))}</h1>
      <p class="hero-desc">${escapeHtml(getDescription(manga))}</p>
      <a class="hero-cta" href="detail.html?id=${encodeURIComponent(
        manga.id
      )}">View details</a>
    </div>
  `;
}

function renderGrid(mangaList) {
  gridEl.innerHTML = "";

  if (!mangaList.length) {
    gridEl.innerHTML = `
      <p class="status-msg">
        No readable English manga found.
      </p>
    `;

    return;
  }

  mangaList.forEach((manga) => {
    const card = document.createElement("div");
    const img = document.createElement("img");
    const title = document.createElement("div");

    card.className = "manga-card";
    card.dataset.mangaId = manga.id;

    img.alt = `${getTitle(manga)} cover`;
    img.loading = "lazy";

    title.className = "card-title";
    title.textContent = getTitle(manga);

    const directCover = getDirectCoverUrl(manga, 256);

    loadCoverImage(img, directCover);

    card.appendChild(img);
    card.appendChild(title);

    card.addEventListener("click", () => {
      window.location.href = `detail.html?id=${encodeURIComponent(manga.id)}`;
    });

    gridEl.appendChild(card);
  });
}

function showStatus(message) {
  gridEl.innerHTML = "";

  const status = document.createElement("p");

  status.className = "status-msg";
  status.textContent = message;

  gridEl.appendChild(status);
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
    const results = await fetchManga({
      title: term || undefined,
      tagId,
    });

    if (!term && !tagId) {
      renderHero(results[0]);
    }

    renderGrid(results);
  } catch (err) {
    console.error(err);

    showStatus("Something went wrong. Try again.");
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  runView();
});

genreFilterEl.addEventListener("change", () => {
  runView();
});

const urlParams = new URLSearchParams(window.location.search);
const initialSearch = urlParams.get("search");

if (initialSearch) {
  searchInput.value = initialSearch;
}

populateGenreFilter().then(runView);

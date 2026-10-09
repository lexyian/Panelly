const CONTENT_RATING = ["safe", "suggestive"];

const heroEl = document.getElementById("hero");
const gridEl = document.getElementById("mangaGrid");
const gridTitleEl = document.getElementById("gridTitle");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const genreFilterEl = document.getElementById("genreFilter");

async function apiFetch(pathAndQuery) {
  const res = await fetch(
    `/api/mangadex?path=${encodeURIComponent(pathAndQuery)}`
  );

  if (!res.ok) {
    throw new Error(`MangaDex request failed: ${res.status}`);
  }

  return res;
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
  const titles = manga.attributes?.title || {};

  return titles.en || Object.values(titles)[0] || "Untitled";
}

function getDescription(manga) {
  const descriptions = manga.attributes?.description || {};

  return descriptions.en || Object.values(descriptions)[0] || "";
}

function getCoverFile(manga) {
  const cover = manga.relationships?.find(
    (relationship) => relationship.type === "cover_art"
  );

  return cover?.attributes?.fileName || "";
}

function getCoverUrl(manga, size = 256) {
  const fileName = getCoverFile(manga);

  if (!fileName) {
    return "";
  }

  const directUrl =
    `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.${size}.jpg`;

  return `/api/proxy-image?url=${encodeURIComponent(directUrl)}`;
}

function createCoverImage(manga, size) {
  const img = document.createElement("img");

  img.alt = `${getTitle(manga)} cover`;
  img.loading = "lazy";

  const cover = getCoverUrl(manga, size);

  if (cover) {
    img.src = cover;
  }

  img.addEventListener("error", () => {
    img.style.opacity = "0.25";
  });

  return img;
}

let genreTagsCache = null;

async function fetchGenreTags() {
  if (genreTagsCache) {
    return genreTagsCache;
  }

  const res = await apiFetch("/manga/tag");
  const json = await res.json();

  genreTagsCache = (json.data || [])
    .filter((tag) => tag.attributes?.group === "genre")
    .map((tag) => ({
      id: tag.id,
      name:
        tag.attributes?.name?.en ||
        Object.values(tag.attributes?.name || {})[0],
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
    console.error("Genre error:", err);
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
    params["order[relevance]"] = "desc";
  } else {
    params["order[followedCount]"] = "desc";
  }

  if (tagId) {
    params.includedTags = [tagId];
  }

  const query = buildQuery(params);
  const res = await apiFetch(`/manga?${query}`);
  const json = await res.json();

  return Array.isArray(json.data) ? json.data : [];
}

function renderHero(manga) {
  if (!manga) {
    heroEl.style.backgroundImage = "none";
    heroEl.innerHTML = `
      <div class="hero-content">
        <h1 class="hero-title">Panelly</h1>
        <p class="hero-desc">Browse and read manga online.</p>
      </div>
    `;

    return;
  }

  const cover = getCoverUrl(manga, 512);

  heroEl.style.backgroundImage = cover
    ? `url("${cover}")`
    : "none";

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
        No manga found.
      </p>
    `;

    return;
  }

  mangaList.forEach((manga) => {
    const card = document.createElement("article");
    const img = createCoverImage(manga, 256);
    const title = document.createElement("div");

    card.className = "manga-card";

    title.className = "card-title";
    title.textContent = getTitle(manga);

    card.appendChild(img);
    card.appendChild(title);

    card.addEventListener("click", () => {
      window.location.href =
        `detail.html?id=${encodeURIComponent(manga.id)}`;
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
  const tagId = genreFilterEl.value || "";

  const selectedGenre = tagId
    ? genreFilterEl.options[
        genreFilterEl.selectedIndex
      ].textContent
    : "";

  if (term && selectedGenre) {
    gridTitleEl.textContent = `"${term}" in ${selectedGenre}`;
  } else if (term) {
    gridTitleEl.textContent = `Results for "${term}"`;
  } else if (selectedGenre) {
    gridTitleEl.textContent = selectedGenre;
  } else {
    gridTitleEl.textContent = "Trending now";
  }

  showStatus(term || tagId ? "Searching…" : "Loading manga…");

  try {
    const results = await fetchManga({
      title: term || undefined,
      tagId: tagId || undefined,
    });

    if (!term && !tagId) {
      renderHero(results[0]);
    }

    renderGrid(results);
  } catch (err) {
    console.error(err);
    showStatus("Couldn't load manga. Please try again.");
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runView();
});

genreFilterEl.addEventListener("change", () => {
  runView();
});

const params = new URLSearchParams(window.location.search);
const initialSearch = params.get("search");

if (initialSearch) {
  searchInput.value = initialSearch;
}

populateGenreFilter().then(runView);

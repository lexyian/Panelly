const CONTENT_RATING = ["safe", "suggestive"];
const BOOKMARK_KEY = "panellyBookmarks";
const CONTINUE_KEY = "panellyContinueReading";

const heroEl = document.getElementById("hero");
const gridEl = document.getElementById("mangaGrid");
const freshGridEl = document.getElementById("freshGrid");
const gridTitleEl = document.getElementById("gridTitle");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const genreFilterEl = document.getElementById("genreFilter");
const rouletteBtn = document.getElementById("rouletteBtn");
const mobileRouletteBtn = document.getElementById("mobileRouletteBtn");
const continueSection = document.getElementById("continueSection");
const continueGrid = document.getElementById("continueGrid");
const shelfSection = document.getElementById("shelfSection");
const shelfGrid = document.getElementById("shelfGrid");

let trendingPool = [];
let currentBrowsePool = [];

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
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        parts.push(
          `${key}[]=${encodeURIComponent(item)}`
        );
      });
    } else {
      parts.push(
        `${key}=${encodeURIComponent(value)}`
      );
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

  return (
    titles.en ||
    Object.values(titles)[0] ||
    "Untitled"
  );
}

function getDescription(manga) {
  const descriptions =
    manga.attributes?.description || {};

  return (
    descriptions.en ||
    Object.values(descriptions)[0] ||
    "No description available."
  );
}

function getTags(manga) {
  return (manga.attributes?.tags || [])
    .map(
      (tag) =>
        tag.attributes?.name?.en ||
        Object.values(
          tag.attributes?.name || {}
        )[0]
    )
    .filter(Boolean);
}

function getCoverFile(manga) {
  const cover =
    manga.relationships?.find(
      (relationship) =>
        relationship.type === "cover_art"
    );

  return cover?.attributes?.fileName || "";
}

function getCoverUrlFromFile(
  mangaId,
  fileName,
  size = 256
) {
  if (!mangaId || !fileName) {
    return "";
  }

  const directUrl =
    `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.${size}.jpg`;

  return `/api/proxy-image?url=${encodeURIComponent(
    directUrl
  )}`;
}

function getCoverUrl(manga, size = 256) {
  return getCoverUrlFromFile(
    manga.id,
    getCoverFile(manga),
    size
  );
}

function getStoredCoverUrl(item, size = 256) {
  if (item.coverFile) {
    return getCoverUrlFromFile(
      item.mangaId || item.id,
      item.coverFile,
      size
    );
  }

  if (
    item.coverUrl &&
    item.coverUrl.startsWith("/api/")
  ) {
    return item.coverUrl;
  }

  if (
    item.coverUrl &&
    item.coverUrl.startsWith("https://")
  ) {
    return `/api/proxy-image?url=${encodeURIComponent(
      item.coverUrl
    )}`;
  }

  return "";
}

function getPrimaryGenre(manga) {
  const tags = getTags(manga);

  return tags[0] || "Manga";
}

function imageMarkup(url, alt) {
  if (!url) {
    return `<div class="image-fallback"></div>`;
  }

  return `<img src="${escapeHtml(
    url
  )}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
}

async function fetchGenreTags() {
  const res = await apiFetch("/manga/tag");
  const json = await res.json();

  return (json.data || [])
    .filter(
      (tag) =>
        tag.attributes?.group === "genre"
    )
    .map((tag) => ({
      id: tag.id,
      name:
        tag.attributes?.name?.en ||
        Object.values(
          tag.attributes?.name || {}
        )[0],
    }))
    .filter((tag) => tag.name)
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    );
}

async function populateGenres() {
  try {
    const genres = await fetchGenreTags();

    genres.forEach((genre) => {
      const option =
        document.createElement("option");

      option.value = genre.id;
      option.textContent = genre.name;

      genreFilterEl.appendChild(option);
    });
  } catch (err) {
    console.error("Genre error:", err);
  }
}

async function fetchManga({
  title,
  tagId,
  limit = 18,
  order = "followedCount",
} = {}) {
  const params = {
    limit,
    includes: ["cover_art"],
    contentRating: CONTENT_RATING,
    availableTranslatedLanguage: ["en"],
    hasAvailableChapters: true,
  };

  if (title) {
    params.title = title;
    params["order[relevance]"] = "desc";
  } else {
    params[`order[${order}]`] = "desc";
  }

  if (tagId) {
    params.includedTags = [tagId];
  }

  const res = await apiFetch(
    `/manga?${buildQuery(params)}`
  );

  const json = await res.json();

  return Array.isArray(json.data)
    ? json.data
    : [];
}

function renderHero(manga, number = 1) {
  if (!manga) {
    heroEl.innerHTML = `
      <div class="hero-loading">
        No featured manga available.
      </div>
    `;

    return;
  }

  const title = getTitle(manga);
  const description = getDescription(manga);
  const tags = getTags(manga).slice(0, 4);
  const cover = getCoverUrl(manga, 512);

  heroEl.innerHTML = `
    <div class="hero-copy">
      <span class="hero-series-label">
        FEATURED SERIES
      </span>

      <h1 class="hero-title">
        ${escapeHtml(title)}
      </h1>

      <div class="hero-meta">
        ${tags
          .map(
            (tag) =>
              `<span class="hero-tag">${escapeHtml(
                tag
              )}</span>`
          )
          .join("")}
      </div>

      <p class="hero-description">
        ${escapeHtml(description)}
      </p>

      <div class="hero-actions">
        <a
          class="hero-primary"
          href="detail.html?id=${encodeURIComponent(
            manga.id
          )}"
        >
          Open Series File →
        </a>

        <a
          class="hero-secondary"
          href="#browseSection"
        >
          Browse More
        </a>
      </div>
    </div>

    <div class="hero-art">
      ${
        cover
          ? `<img src="${escapeHtml(
              cover
            )}" alt="${escapeHtml(
              title
            )} cover">`
          : ""
      }

      <span class="hero-number">
        ${String(number).padStart(2, "0")}
      </span>
    </div>
  `;
}

function createMangaCard(manga, index) {
  const card = document.createElement("article");

  card.className = "manga-card";
  card.tabIndex = 0;

  const title = getTitle(manga);
  const cover = getCoverUrl(manga, 256);
  const genre = getPrimaryGenre(manga);

  card.innerHTML = `
    <div class="card-cover-wrap">
      <span class="card-number">
        PANEL ${String(index + 1).padStart(2, "0")}
      </span>

      ${
        cover
          ? `<img src="${escapeHtml(
              cover
            )}" alt="${escapeHtml(
              title
            )} cover" loading="lazy">`
          : ""
      }
    </div>

    <div class="card-info">
      <h3 class="card-title">
        ${escapeHtml(title)}
      </h3>

      <div class="card-meta">
        <span class="card-genre">
          ${escapeHtml(genre)}
        </span>

        <span class="card-arrow">→</span>
      </div>
    </div>
  `;

  const openManga = () => {
    window.location.href =
      `detail.html?id=${encodeURIComponent(
        manga.id
      )}`;
  };

  card.addEventListener("click", openManga);

  card.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openManga();
    }
  });

  return card;
}

function renderBrowse(mangaList) {
  gridEl.innerHTML = "";

  currentBrowsePool = mangaList;

  if (!mangaList.length) {
    gridEl.innerHTML = `
      <p class="status-msg">
        No readable manga found.
      </p>
    `;

    return;
  }

  mangaList.forEach((manga, index) => {
    gridEl.appendChild(
      createMangaCard(manga, index)
    );
  });
}

function renderFresh(mangaList) {
  freshGridEl.innerHTML = "";

  if (!mangaList.length) {
    freshGridEl.innerHTML = `
      <p class="status-msg">
        No recent updates found.
      </p>
    `;

    return;
  }

  mangaList.forEach((manga, index) => {
    const title = getTitle(manga);
    const cover = getCoverUrl(manga, 256);

    const card =
      document.createElement("a");

    card.className = "fresh-card";
    card.href =
      `detail.html?id=${encodeURIComponent(
        manga.id
      )}`;

    card.innerHTML = `
      ${
        cover
          ? `<img src="${escapeHtml(
              cover
            )}" alt="${escapeHtml(
              title
            )} cover" loading="lazy">`
          : ""
      }

      <div class="fresh-info">
        <span class="fresh-label">
          FRESH INK ${String(
            index + 1
          ).padStart(2, "0")}
        </span>

        <span class="fresh-title">
          ${escapeHtml(title)}
        </span>

        <span class="fresh-action">
          VIEW SERIES →
        </span>
      </div>
    `;

    freshGridEl.appendChild(card);
  });
}

function readStorage(key) {
  try {
    const data = JSON.parse(
      localStorage.getItem(key) || "[]"
    );

    if (Array.isArray(data)) {
      return data;
    }

    if (
      data &&
      typeof data === "object"
    ) {
      return Object.values(data);
    }

    return [];
  } catch {
    return [];
  }
}

function renderContinueReading() {
  const items = readStorage(CONTINUE_KEY)
    .sort(
      (a, b) =>
        Number(b.updatedAt || 0) -
        Number(a.updatedAt || 0)
    )
    .slice(0, 6);

  if (!items.length) {
    continueSection.classList.add(
      "hidden-section"
    );
    return;
  }

  continueSection.classList.remove(
    "hidden-section"
  );

  continueGrid.innerHTML = "";

  items.forEach((item) => {
    const mangaId =
      item.mangaId || item.id;

    const title =
      item.mangaTitle ||
      item.title ||
      "Untitled";

    const chapterLabel =
      item.chapterLabel ||
      item.chapterTitle ||
      "Continue chapter";

    const cover = getStoredCoverUrl(
      item,
      256
    );

    const card =
      document.createElement("a");

    card.className = "continue-card";

    if (item.chapterId) {
      card.href =
        `reader.html?chapterId=${encodeURIComponent(
          item.chapterId
        )}`;
    } else {
      card.href =
        `detail.html?id=${encodeURIComponent(
          mangaId
        )}`;
    }

    card.innerHTML = `
      ${
        cover
          ? `<img src="${escapeHtml(
              cover
            )}" alt="${escapeHtml(
              title
            )} cover">`
          : ""
      }

      <div class="continue-info">
        <span class="continue-label">
          CONTINUE READING
        </span>

        <span class="continue-title">
          ${escapeHtml(title)}
        </span>

        <span class="continue-chapter">
          ${escapeHtml(chapterLabel)} →
        </span>

        <div class="reading-line">
          <span></span>
        </div>
      </div>
    `;

    continueGrid.appendChild(card);
  });
}

function renderShelf() {
  const bookmarks = readStorage(
    BOOKMARK_KEY
  )
    .sort(
      (a, b) =>
        Number(b.savedAt || 0) -
        Number(a.savedAt || 0)
    )
    .slice(0, 10);

  if (!bookmarks.length) {
    shelfSection.classList.add(
      "hidden-section"
    );
    return;
  }

  shelfSection.classList.remove(
    "hidden-section"
  );

  shelfGrid.innerHTML = "";

  bookmarks.forEach((item) => {
    const mangaId =
      item.mangaId || item.id;

    const title =
      item.mangaTitle ||
      item.title ||
      "Untitled";

    const cover = getStoredCoverUrl(
      item,
      256
    );

    const card =
      document.createElement("a");

    card.className = "shelf-card";
    card.href =
      `detail.html?id=${encodeURIComponent(
        mangaId
      )}`;

    card.innerHTML = `
      ${
        cover
          ? `<img src="${escapeHtml(
              cover
            )}" alt="${escapeHtml(
              title
            )} cover">`
          : ""
      }

      <div class="shelf-info">
        <div class="shelf-title">
          ${escapeHtml(title)}
        </div>

        <div class="shelf-label">
          SAVED TO SHELF
        </div>
      </div>
    `;

    shelfGrid.appendChild(card);
  });
}

async function loadBrowse() {
  const term = searchInput.value.trim();
  const tagId =
    genreFilterEl.value || "";

  const selectedGenre = tagId
    ? genreFilterEl.options[
        genreFilterEl.selectedIndex
      ].textContent
    : "";

  if (term && selectedGenre) {
    gridTitleEl.textContent =
      `"${term}" · ${selectedGenre}`;
  } else if (term) {
    gridTitleEl.textContent =
      `Search: ${term}`;
  } else if (selectedGenre) {
    gridTitleEl.textContent =
      selectedGenre;
  } else {
    gridTitleEl.textContent =
      "Trending Panels";
  }

  gridEl.innerHTML = `
    <div class="loading-panel">
      Loading panels...
    </div>
  `;

  try {
    const mangaList = await fetchManga({
      title: term || undefined,
      tagId: tagId || undefined,
      limit: 10,
      order: "followedCount",
    });

    renderBrowse(mangaList);

    if (!term && !tagId) {
      trendingPool = mangaList;

      if (mangaList[0]) {
        renderHero(mangaList[0], 1);
      }
    }
  } catch (err) {
    console.error(err);

    gridEl.innerHTML = `
      <p class="status-msg">
        Couldn't load manga right now.
      </p>
    `;
  }
}

async function loadFresh() {
  try {
    const mangaList = await fetchManga({
      limit: 7,
      order: "latestUploadedChapter",
    });

    renderFresh(mangaList);
  } catch (err) {
    console.error(err);

    freshGridEl.innerHTML = `
      <p class="status-msg">
        Couldn't load recent updates.
      </p>
    `;
  }
}

function runRoulette() {
  const pool = currentBrowsePool.length
    ? currentBrowsePool
    : trendingPool;

  if (!pool.length) {
    return;
  }

  const randomIndex = Math.floor(
    Math.random() * pool.length
  );

  const manga = pool[randomIndex];

  renderHero(
    manga,
    randomIndex + 1
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

searchForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();
    loadBrowse();

    document
      .getElementById("browseSection")
      .scrollIntoView({
        behavior: "smooth",
      });
  }
);

genreFilterEl.addEventListener(
  "change",
  () => {
    loadBrowse();
  }
);

rouletteBtn.addEventListener(
  "click",
  runRoulette
);

mobileRouletteBtn.addEventListener(
  "click",
  runRoulette
);

const params = new URLSearchParams(
  window.location.search
);

const initialSearch =
  params.get("search");

if (initialSearch) {
  searchInput.value = initialSearch;
}

renderContinueReading();
renderShelf();

loadBrowse();
loadFresh();
populateGenres();

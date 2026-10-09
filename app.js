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
const freshSectionEl = document.getElementById("freshSection");

let trendingPool = [];
let currentBrowsePool = [];
let browseRequestId = 0;
let freshLoaded = false;

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
  );
}

function stripText(value) {
  if (!value) {
    return "";
  }

  const parser = new DOMParser();

  const doc = parser.parseFromString(
    value,
    "text/html"
  );

  return (
    doc.body.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getTitle(manga) {
  return (
    manga?.title?.english ||
    manga?.title?.romaji ||
    manga?.title?.native ||
    "Untitled"
  );
}

function getDescription(manga) {
  return (
    stripText(
      manga?.description
    ) ||
    "No description available."
  );
}

function getCoverUrl(manga) {
  return (
    manga?.coverImage?.extraLarge ||
    manga?.coverImage?.large ||
    manga?.coverImage?.medium ||
    ""
  );
}

function getGenres(manga) {
  return Array.isArray(
    manga?.genres
  )
    ? manga.genres
    : [];
}

function getPrimaryGenre(manga) {
  return (
    getGenres(manga)[0] ||
    "Manga"
  );
}

async function fetchAniList(params = {}) {
  const query =
    new URLSearchParams();

  query.set(
    "mode",
    "browse"
  );

  query.set(
    "perPage",
    String(params.limit || 8)
  );

  if (params.search) {
    query.set(
      "search",
      params.search
    );
  }

  if (params.genre) {
    query.set(
      "genre",
      params.genre
    );
  }

  if (params.sort) {
    query.set(
      "sort",
      params.sort
    );
  }

  const response =
    await fetch(
      `/api/anilist?${query.toString()}`
    );

  if (!response.ok) {
    throw new Error(
      `AniList request failed: ${response.status}`
    );
  }

  const json =
    await response.json();

  return Array.isArray(
    json.manga
  )
    ? json.manga
    : [];
}

async function populateGenres() {
  try {
    const response =
      await fetch(
        "/api/anilist?mode=genres"
      );

    if (!response.ok) {
      throw new Error(
        "Couldn't load genres"
      );
    }

    const json =
      await response.json();

    const genres =
      Array.isArray(json.genres)
        ? json.genres
        : [];

    genres
      .sort(
        (a, b) =>
          a.localeCompare(b)
      )
      .forEach((genre) => {
        const option =
          document.createElement(
            "option"
          );

        option.value = genre;
        option.textContent =
          genre;

        genreFilterEl.appendChild(
          option
        );
      });
  } catch (error) {
    console.error(
      "Genre error:",
      error
    );
  }
}

function renderHero(
  manga,
  number = 1
) {
  if (!manga) {
    heroEl.innerHTML = `
      <div class="hero-loading">
        No featured manga available.
      </div>
    `;

    return;
  }

  const title =
    getTitle(manga);

  const description =
    getDescription(manga);

  const genres =
    getGenres(manga).slice(
      0,
      4
    );

  const cover =
    getCoverUrl(manga);

  heroEl.innerHTML = `
    <div class="hero-copy">

      <span class="hero-series-label">
        FEATURED SERIES
      </span>

      <h1 class="hero-title">
        ${escapeHtml(title)}
      </h1>

      <div class="hero-meta">
        ${genres
          .map(
            (genre) =>
              `<span class="hero-tag">${escapeHtml(
                genre
              )}</span>`
          )
          .join("")}
      </div>

      <p class="hero-description">
        ${escapeHtml(
          description
        )}
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
          ? `<img
              src="${escapeHtml(
                cover
              )}"
              alt="${escapeHtml(
                title
              )} cover"
              loading="eager"
              decoding="async"
              fetchpriority="high"
            >`
          : ""
      }

      <span class="hero-number">
        ${String(
          number
        ).padStart(
          2,
          "0"
        )}
      </span>

    </div>
  `;
}

function createMangaCard(
  manga,
  index
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "manga-card";

  card.tabIndex = 0;

  const title =
    getTitle(manga);

  const cover =
    getCoverUrl(manga);

  const genre =
    getPrimaryGenre(
      manga
    );

  const loading =
    index < 2
      ? "eager"
      : "lazy";

  const priority =
    index < 2
      ? "high"
      : "auto";

  card.innerHTML = `
    <div class="card-cover-wrap">

      <span class="card-number">
        PANEL ${String(
          index + 1
        ).padStart(
          2,
          "0"
        )}
      </span>

      ${
        cover
          ? `<img
              src="${escapeHtml(
                cover
              )}"
              alt="${escapeHtml(
                title
              )} cover"
              loading="${loading}"
              decoding="async"
              fetchpriority="${priority}"
            >`
          : ""
      }

    </div>

    <div class="card-info">

      <h3 class="card-title">
        ${escapeHtml(title)}
      </h3>

      <div class="card-meta">

        <span class="card-genre">
          ${escapeHtml(
            genre
          )}
        </span>

        <span class="card-arrow">
          →
        </span>

      </div>

    </div>
  `;

  const openManga = () => {
    window.location.href =
      `detail.html?id=${encodeURIComponent(
        manga.id
      )}`;
  };

  card.addEventListener(
    "click",
    openManga
  );

  card.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openManga();
      }
    }
  );

  return card;
}

function renderBrowse(
  mangaList
) {
  gridEl.innerHTML = "";

  currentBrowsePool =
    mangaList;

  if (!mangaList.length) {
    gridEl.innerHTML = `
      <p class="status-msg">
        No manga found.
      </p>
    `;

    return;
  }

  mangaList.forEach(
    (manga, index) => {
      gridEl.appendChild(
        createMangaCard(
          manga,
          index
        )
      );
    }
  );
}

function renderFresh(
  mangaList
) {
  freshGridEl.innerHTML =
    "";

  if (!mangaList.length) {
    freshGridEl.innerHTML = `
      <p class="status-msg">
        No recent titles found.
      </p>
    `;

    return;
  }

  mangaList.forEach(
    (manga, index) => {
      const title =
        getTitle(manga);

      const cover =
        getCoverUrl(manga);

      const card =
        document.createElement(
          "a"
        );

      card.className =
        "fresh-card";

      card.href =
        `detail.html?id=${encodeURIComponent(
          manga.id
        )}`;

      card.innerHTML = `
        ${
          cover
            ? `<img
                src="${escapeHtml(
                  cover
                )}"
                alt="${escapeHtml(
                  title
                )} cover"
                loading="lazy"
                decoding="async"
              >`
            : ""
        }

        <div class="fresh-info">

          <span class="fresh-label">
            FRESH INK ${String(
              index + 1
            ).padStart(
              2,
              "0"
            )}
          </span>

          <span class="fresh-title">
            ${escapeHtml(
              title
            )}
          </span>

          <span class="fresh-action">
            VIEW SERIES →
          </span>

        </div>
      `;

      freshGridEl.appendChild(
        card
      );
    }
  );
}

function readStorage(key) {
  try {
    const data =
      JSON.parse(
        localStorage.getItem(
          key
        ) || "[]"
      );

    if (
      Array.isArray(data)
    ) {
      return data;
    }

    if (
      data &&
      typeof data ===
        "object"
    ) {
      return Object.values(
        data
      );
    }

    return [];
  } catch {
    return [];
  }
}

function getStoredMediaId(
  item
) {
  const value =
    item.anilistId ??
    item.mediaId ??
    item.id ??
    item.mangaId;

  const id =
    Number(value);

  return Number.isInteger(id) &&
    id > 0
    ? id
    : null;
}

function renderContinueReading() {
  const items =
    readStorage(
      CONTINUE_KEY
    )
      .sort(
        (a, b) =>
          Number(
            b.updatedAt ||
              0
          ) -
          Number(
            a.updatedAt ||
              0
          )
      )
      .slice(
        0,
        6
      );

  const validItems =
    items.filter(
      (item) =>
        getStoredMediaId(
          item
        )
    );

  if (!validItems.length) {
    continueSection.classList.add(
      "hidden-section"
    );

    return;
  }

  continueSection.classList.remove(
    "hidden-section"
  );

  continueGrid.innerHTML =
    "";

  validItems.forEach(
    (item) => {
      const mediaId =
        getStoredMediaId(
          item
        );

      const title =
        item.mangaTitle ||
        item.title ||
        "Untitled";

      const cover =
        item.coverUrl ||
        "";

      const chapterLabel =
        item.chapterLabel ||
        "Continue reading";

      const card =
        document.createElement(
          "a"
        );

      card.className =
        "continue-card";

      if (item.chapterId) {
        card.href =
          `reader.html?chapterId=${encodeURIComponent(
            item.chapterId
          )}&mediaId=${encodeURIComponent(
            mediaId
          )}`;
      } else {
        card.href =
          `detail.html?id=${encodeURIComponent(
            mediaId
          )}`;
      }

      card.innerHTML = `
        ${
          cover
            ? `<img
                src="${escapeHtml(
                  cover
                )}"
                alt="${escapeHtml(
                  title
                )} cover"
                loading="lazy"
                decoding="async"
              >`
            : ""
        }

        <div class="continue-info">

          <span class="continue-label">
            CONTINUE READING
          </span>

          <span class="continue-title">
            ${escapeHtml(
              title
            )}
          </span>

          <span class="continue-chapter">
            ${escapeHtml(
              chapterLabel
            )} →
          </span>

          <div class="reading-line">
            <span></span>
          </div>

        </div>
      `;

      continueGrid.appendChild(
        card
      );
    }
  );
}

function renderShelf() {
  const bookmarks =
    readStorage(
      BOOKMARK_KEY
    )
      .sort(
        (a, b) =>
          Number(
            b.savedAt ||
              0
          ) -
          Number(
            a.savedAt ||
              0
          )
      )
      .slice(
        0,
        10
      );

  const validBookmarks =
    bookmarks.filter(
      (item) =>
        getStoredMediaId(
          item
        )
    );

  if (
    !validBookmarks.length
  ) {
    shelfSection.classList.add(
      "hidden-section"
    );

    return;
  }

  shelfSection.classList.remove(
    "hidden-section"
  );

  shelfGrid.innerHTML = "";

  validBookmarks.forEach(
    (item) => {
      const mediaId =
        getStoredMediaId(
          item
        );

      const title =
        item.mangaTitle ||
        item.title ||
        "Untitled";

      const cover =
        item.coverUrl ||
        "";

      const card =
        document.createElement(
          "a"
        );

      card.className =
        "shelf-card";

      card.href =
        `detail.html?id=${encodeURIComponent(
          mediaId
        )}`;

      card.innerHTML = `
        ${
          cover
            ? `<img
                src="${escapeHtml(
                  cover
                )}"
                alt="${escapeHtml(
                  title
                )} cover"
                loading="lazy"
                decoding="async"
              >`
            : ""
        }

        <div class="shelf-info">

          <div class="shelf-title">
            ${escapeHtml(
              title
            )}
          </div>

          <div class="shelf-label">
            SAVED TO SHELF
          </div>

        </div>
      `;

      shelfGrid.appendChild(
        card
      );
    }
  );
}

async function loadBrowse() {
  const requestId =
    ++browseRequestId;

  const term =
    searchInput.value.trim();

  const genre =
    genreFilterEl.value ||
    "";

  if (
    term &&
    genre
  ) {
    gridTitleEl.textContent =
      `"${term}" · ${genre}`;
  } else if (term) {
    gridTitleEl.textContent =
      `Search: ${term}`;
  } else if (genre) {
    gridTitleEl.textContent =
      genre;
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
    const mangaList =
      await fetchAniList({
        search:
          term ||
          undefined,
        genre:
          genre ||
          undefined,
        sort:
          "trending",
        limit:
          8
      });

    if (
      requestId !==
      browseRequestId
    ) {
      return;
    }

    renderBrowse(
      mangaList
    );

    if (
      !term &&
      !genre
    ) {
      trendingPool =
        mangaList;

      if (
        mangaList[0]
      ) {
        renderHero(
          mangaList[0],
          1
        );
      }
    }
  } catch (error) {
    if (
      requestId !==
      browseRequestId
    ) {
      return;
    }

    console.error(error);

    gridEl.innerHTML = `
      <p class="status-msg">
        Couldn't load manga right now.
      </p>
    `;
  }
}

async function loadFresh() {
  try {
    freshGridEl.innerHTML = `
      <div class="loading-panel">
        Loading fresh releases...
      </div>
    `;

    const mangaList =
      await fetchAniList({
        sort:
          "fresh",
        limit:
          6
      });

    renderFresh(
      mangaList
    );
  } catch (error) {
    console.error(error);

    freshGridEl.innerHTML = `
      <p class="status-msg">
        Couldn't load recent titles.
      </p>
    `;
  }
}

function runRoulette() {
  const pool =
    currentBrowsePool.length
      ? currentBrowsePool
      : trendingPool;

  if (!pool.length) {
    return;
  }

  const randomIndex =
    Math.floor(
      Math.random() *
        pool.length
    );

  renderHero(
    pool[randomIndex],
    randomIndex + 1
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

searchForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    loadBrowse();

    document
      .getElementById(
        "browseSection"
      )
      .scrollIntoView({
        behavior:
          "smooth"
      });
  }
);

genreFilterEl.addEventListener(
  "change",
  loadBrowse
);

rouletteBtn?.addEventListener(
  "click",
  runRoulette
);

mobileRouletteBtn?.addEventListener(
  "click",
  runRoulette
);

const params =
  new URLSearchParams(
    window.location.search
  );

const initialSearch =
  params.get("search");

if (initialSearch) {
  searchInput.value =
    initialSearch;
}

renderContinueReading();
renderShelf();
loadBrowse();

const idleLoad =
  window.requestIdleCallback ||
  function (callback) {
    setTimeout(
      callback,
      1000
    );
  };

idleLoad(
  populateGenres
);

if (
  freshSectionEl &&
  "IntersectionObserver" in window
) {
  const observer =
    new IntersectionObserver(
      (entries) => {
        if (
          entries[0]
            .isIntersecting &&
          !freshLoaded
        ) {
          freshLoaded =
            true;

          loadFresh();

          observer.disconnect();
        }
      },
      {
        rootMargin:
          "500px"
      }
    );

  observer.observe(
    freshSectionEl
  );
} else {
  freshLoaded = true;
  loadFresh();
}

const BOOKMARK_KEY = "panellyBookmarks";
const CONTINUE_KEY = "panellyContinueReading";

const heroEl = document.getElementById("hero");
const gridEl = document.getElementById("mangaGrid");
const freshGridEl = document.getElementById("freshGrid");
const gridTitleEl = document.getElementById("gridTitle");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const categoryFilterEl = document.getElementById("categoryFilter");
const originFilterEl = document.getElementById("originFilter");
const genreFilterEl = document.getElementById("genreFilter");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const rouletteBtn = document.getElementById("rouletteBtn");
const mobileRouletteBtn = document.getElementById("mobileRouletteBtn");
const continueSection = document.getElementById("continueSection");
const continueGrid = document.getElementById("continueGrid");
const shelfSection = document.getElementById("shelfSection");
const shelfGrid = document.getElementById("shelfGrid");
const glRow = document.getElementById("glRow");
const blRow = document.getElementById("blRow");
const manhwaRow = document.getElementById("manhwaRow");
const manhuaRow = document.getElementById("manhuaRow");

let trendingPool = [];
let currentBrowsePool = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function stripText(value) {
  if (!value) return "";

  const parser = new DOMParser();

  const parsed = parser.parseFromString(
    value,
    "text/html"
  );

  return (
    parsed.body.textContent || ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(manga) {
  return (
    manga?.title?.english ||
    manga?.title?.romaji ||
    manga?.title?.native ||
    "Untitled"
  );
}

function descriptionOf(manga) {
  return (
    stripText(
      manga?.description
    ) ||
    "No description available."
  );
}

function coverOf(manga) {
  return (
    manga?.coverImage?.extraLarge ||
    manga?.coverImage?.large ||
    manga?.coverImage?.medium ||
    ""
  );
}

function tagsOf(manga) {
  const genres =
    Array.isArray(
      manga?.genres
    )
      ? manga.genres
      : [];

  const tags =
    Array.isArray(
      manga?.tags
    )
      ? manga.tags
          .filter(
            tag =>
              !tag.isAdult &&
              !tag.isGeneralSpoiler &&
              !tag.isMediaSpoiler &&
              Number(
                tag.rank || 0
              ) >= 60
          )
          .map(
            tag =>
              tag.name
          )
      : [];

  return [
    ...new Set([
      ...genres,
      ...tags
    ])
  ];
}

function originLabel(manga) {
  const country =
    manga?.countryOfOrigin;

  if (country === "KR") {
    return "Manhwa · KR";
  }

  if (
    country === "CN" ||
    country === "TW"
  ) {
    return "Manhua · CN";
  }

  if (country === "JP") {
    return "Manga · JP";
  }

  return "Comic";
}

function primaryGenre(manga) {
  return (
    manga?.genres?.[0] ||
    tagsOf(manga)[0] ||
    "Manga"
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

    return Array.isArray(
      data
    )
      ? data
      : Object.values(
          data || {}
        );
  } catch {
    return [];
  }
}

async function fetchAniList({
  search = "",
  genre = "",
  tag = "",
  country = "",
  sort = "TRENDING_DESC",
  perPage = 15
} = {}) {
  const params =
    new URLSearchParams({
      mode:
        "search",

      perPage:
        String(
          perPage
        ),

      sort
    });

  if (search) {
    params.set(
      "search",
      search
    );
  }

  if (genre) {
    params.set(
      "genre",
      genre
    );
  }

  if (tag) {
    params.set(
      "tag",
      tag
    );
  }

  if (country) {
    params.set(
      "country",
      country
    );
  }

  const response =
    await fetch(
      `/api/anilist?${params.toString()}`
    );

  if (!response.ok) {
    throw new Error(
      "AniList request failed"
    );
  }

  const json =
    await response.json();

  return Array.isArray(
    json.items
  )
    ? json.items
    : [];
}

function currentFilterState() {
  const search =
    searchInput
      ?.value
      ?.trim() ||
    "";

  const category =
    categoryFilterEl
      ?.value ||
    "";

  const origin =
    originFilterEl
      ?.value ||
    "";

  const genreText =
    genreFilterEl &&
    genreFilterEl.selectedIndex >= 0
      ? String(
          genreFilterEl.options[
            genreFilterEl.selectedIndex
          ]?.textContent ||
          ""
        ).trim()
      : "";

  let tag = "";

  if (
    category === "gl"
  ) {
    tag = "Yuri";
  }

  if (
    category === "bl"
  ) {
    tag =
      "Boys' Love";
  }

  let country = "";

  if (
    origin === "manga"
  ) {
    country = "JP";
  }

  if (
    origin === "manhwa"
  ) {
    country = "KR";
  }

  if (
    origin === "manhua"
  ) {
    country = "CN";
  }

  const genre =
    /all genres|genre/i
      .test(
        genreText
      )
      ? ""
      : genreText;

  return {
    search,
    genre,
    tag,
    country,
    category,
    origin
  };
}

function renderHero(
  manga,
  number = 1
) {
  if (!heroEl) {
    return;
  }

  if (!manga) {
    heroEl.innerHTML = `
      <div class="hero-loading">
        No featured title found.
      </div>
    `;

    return;
  }

  const title =
    titleOf(
      manga
    );

  const description =
    descriptionOf(
      manga
    );

  const tags =
    tagsOf(
      manga
    ).slice(
      0,
      4
    );

  const cover =
    coverOf(
      manga
    );

  heroEl.innerHTML = `
    <div class="hero-inner">

      <div class="hero-copy">

        <span class="hero-series-label">
          ISSUE 001 / MULTI-SOURCE / ${escapeHtml(
            originLabel(
              manga
            )
          )}
        </span>

        <h1 class="hero-title">
          ${escapeHtml(
            title
          )}
        </h1>

        <div class="hero-meta">

          ${tags
            .map(
              tag =>
                `<span class="hero-tag">${escapeHtml(
                  tag
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
            ? `
              <img
                src="${escapeHtml(
                  cover
                )}"
                alt="${escapeHtml(
                  title
                )} cover"
              >
            `
            : `
              <div class="image-fallback"></div>
            `
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

  card.tabIndex =
    0;

  const title =
    titleOf(
      manga
    );

  const cover =
    coverOf(
      manga
    );

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
          ? `
            <img
              src="${escapeHtml(
                cover
              )}"
              alt="${escapeHtml(
                title
              )} cover"
              loading="lazy"
              decoding="async"
            >
          `
          : `
            <div class="image-fallback"></div>
          `
      }

      <span class="card-readable">
        MULTI-SOURCE
      </span>

    </div>

    <div class="card-info">

      <h3 class="card-title">
        ${escapeHtml(
          title
        )}
      </h3>

      <div class="card-meta">

        <span class="card-meta-left">

          <span>
            ${escapeHtml(
              primaryGenre(
                manga
              )
            )}
          </span>

          <span class="card-origin">
            ${escapeHtml(
              originLabel(
                manga
              )
            )}
          </span>

        </span>

        <span class="card-arrow">
          →
        </span>

      </div>

    </div>
  `;

  const open = () => {
    window.location.href =
      `detail.html?id=${encodeURIComponent(
        manga.id
      )}`;
  };

  card.addEventListener(
    "click",
    open
  );

  card.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
          "Enter" ||
        event.key ===
          " "
      ) {
        event.preventDefault();
        open();
      }
    }
  );

  return card;
}

function createSpotlightCard(
  manga
) {
  const card =
    document.createElement(
      "a"
    );

  card.className =
    "spotlight-card";

  card.href =
    `detail.html?id=${encodeURIComponent(
      manga.id
    )}`;

  const title =
    titleOf(
      manga
    );

  const cover =
    coverOf(
      manga
    );

  card.innerHTML = `
    <div class="spotlight-cover">

      ${
        cover
          ? `
            <img
              src="${escapeHtml(
                cover
              )}"
              alt="${escapeHtml(
                title
              )} cover"
              loading="lazy"
            >
          `
          : `
            <div class="image-fallback"></div>
          `
      }

      <span class="spotlight-readable">
        MULTI-SOURCE
      </span>

    </div>

    <div class="spotlight-info">

      <strong>
        ${escapeHtml(
          title
        )}
      </strong>

      <span>
        ${escapeHtml(
          originLabel(
            manga
          )
        )} · VIEW SERIES →
      </span>

    </div>
  `;

  return card;
}

function renderBrowse(
  items
) {
  if (!gridEl) {
    return;
  }

  currentBrowsePool =
    items;

  gridEl.innerHTML =
    "";

  if (!items.length) {
    gridEl.innerHTML = `
      <p class="status-msg">
        No titles matched these filters.
      </p>
    `;

    return;
  }

  items.forEach(
    (
      manga,
      index
    ) =>
      gridEl.appendChild(
        createMangaCard(
          manga,
          index
        )
      )
  );
}

function renderSpotlight(
  element,
  items,
  emptyMessage
) {
  if (!element) {
    return;
  }

  element.innerHTML =
    "";

  if (!items.length) {
    element.innerHTML = `
      <div class="shelf-loading">
        ${escapeHtml(
          emptyMessage
        )}
      </div>
    `;

    return;
  }

  items.forEach(
    manga =>
      element.appendChild(
        createSpotlightCard(
          manga
        )
      )
  );
}

function renderFresh(
  items
) {
  if (!freshGridEl) {
    return;
  }

  freshGridEl.innerHTML =
    "";

  if (!items.length) {
    freshGridEl.innerHTML = `
      <p class="status-msg">
        No recent updates found.
      </p>
    `;

    return;
  }

  items.forEach(
    (
      manga,
      index
    ) => {
      const title =
        titleOf(
          manga
        );

      const cover =
        coverOf(
          manga
        );

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
            ? `
              <img
                src="${escapeHtml(
                  cover
                )}"
                alt="${escapeHtml(
                  title
                )} cover"
                loading="lazy"
              >
            `
            : `
              <div class="image-fallback"></div>
            `
        }

        <div class="fresh-info">

          <span class="fresh-label">
            FRESH INK ${String(
              index + 1
            ).padStart(
              2,
              "0"
            )} · ${escapeHtml(
              originLabel(
                manga
              )
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

function renderContinueReading() {
  if (
    !continueSection ||
    !continueGrid
  ) {
    return;
  }

  const items =
    readStorage(
      CONTINUE_KEY
    )
      .filter(
        item =>
          Number(
            item.mediaId
          ) > 0
      )
      .sort(
        (
          a,
          b
        ) =>
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

  if (!items.length) {
    continueSection
      .classList.add(
        "hidden-section"
      );

    return;
  }

  continueSection
    .classList.remove(
      "hidden-section"
    );

  continueGrid.innerHTML =
    "";

  items.forEach(
    item => {
      const card =
        document.createElement(
          "a"
        );

      card.className =
        "continue-card";

      card.href =
        item.chapterId
          ? `reader.html?source=${encodeURIComponent(
              item.source ||
              "mangadex"
            )}&chapterId=${encodeURIComponent(
              item.chapterId
            )}&mangaId=${encodeURIComponent(
              item.mangaId ||
              ""
            )}&mediaId=${encodeURIComponent(
              item.mediaId
            )}`
          : `detail.html?id=${encodeURIComponent(
              item.mediaId
            )}`;

      const progress =
        Math.max(
          0,
          Math.min(
            100,
            Number(
              item.progress ||
              0
            )
          )
        );

      card.innerHTML = `
        ${
          item.coverUrl
            ? `
              <img
                src="${escapeHtml(
                  item.coverUrl
                )}"
                alt="${escapeHtml(
                  item.mangaTitle ||
                  "Series"
                )} cover"
              >
            `
            : ""
        }

        <div class="continue-info">

          <span class="continue-label">
            CONTINUE READING
          </span>

          <span class="continue-title">
            ${escapeHtml(
              item.mangaTitle ||
              "Untitled"
            )}
          </span>

          <span class="continue-chapter">
            ${escapeHtml(
              item.chapterLabel ||
              "Continue"
            )} →
          </span>

          <div class="reading-line">

            <span
              style="width:${progress}%"
            ></span>

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
  if (
    !shelfSection ||
    !shelfGrid
  ) {
    return;
  }

  const items =
    readStorage(
      BOOKMARK_KEY
    )
      .filter(
        item =>
          Number(
            item.mediaId ||
            item.id
          ) > 0
      )
      .sort(
        (
          a,
          b
        ) =>
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
        12
      );

  if (!items.length) {
    shelfSection
      .classList.add(
        "hidden-section"
      );

    return;
  }

  shelfSection
    .classList.remove(
      "hidden-section"
    );

  shelfGrid.innerHTML =
    "";

  items.forEach(
    item => {
      const mediaId =
        Number(
          item.mediaId ||
          item.id
        );

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
          item.coverUrl
            ? `
              <img
                src="${escapeHtml(
                  item.coverUrl
                )}"
                alt="${escapeHtml(
                  item.mangaTitle ||
                  item.title ||
                  "Untitled"
                )} cover"
              >
            `
            : ""
        }

        <div class="shelf-info">

          <div class="shelf-title">
            ${escapeHtml(
              item.mangaTitle ||
              item.title ||
              "Untitled"
            )}
          </div>

          <div class="shelf-label">
            SAVED TO PANEL SHELF
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
  const state =
    currentFilterState();

  if (gridTitleEl) {
    const pieces = [];

    if (
      state.search
    ) {
      pieces.push(
        `“${state.search}”`
      );
    }

    if (
      state.genre
    ) {
      pieces.push(
        state.genre
      );
    }

    if (
      state.category ===
      "gl"
    ) {
      pieces.push(
        "Girls' Love"
      );
    }

    if (
      state.category ===
      "bl"
    ) {
      pieces.push(
        "Boys' Love"
      );
    }

    if (
      state.origin
    ) {
      pieces.push(
        originFilterEl.options[
          originFilterEl.selectedIndex
        ]?.textContent ||
        state.origin
      );
    }

    gridTitleEl.textContent =
      pieces.length
        ? pieces.join(
            " · "
          )
        : "Trending Panels";
  }

  if (gridEl) {
    gridEl.innerHTML = `
      <div class="loading-panel">
        Loading panels...
      </div>
    `;
  }

  try {
    const items =
      await fetchAniList({
        search:
          state.search,

        genre:
          state.genre,

        tag:
          state.tag,

        country:
          state.country,

        sort:
          state.search
            ? "POPULARITY_DESC"
            : "TRENDING_DESC",

        perPage:
          18
      });

    renderBrowse(
      items
    );
  } catch (error) {
    console.error(
      error
    );

    if (gridEl) {
      gridEl.innerHTML = `
        <p class="status-msg">
          Couldn't load titles right now.
        </p>
      `;
    }
  }
}

async function loadHomeSections() {
  const jobs =
    await Promise.allSettled([
      fetchAniList({
        sort:
          "TRENDING_DESC",
        perPage:
          12
      }),

      fetchAniList({
        sort:
          "UPDATED_AT_DESC",
        perPage:
          8
      }),

      fetchAniList({
        tag:
          "Yuri",
        sort:
          "POPULARITY_DESC",
        perPage:
          8
      }),

      fetchAniList({
        tag:
          "Boys' Love",
        sort:
          "POPULARITY_DESC",
        perPage:
          8
      }),

      fetchAniList({
        country:
          "KR",
        sort:
          "POPULARITY_DESC",
        perPage:
          8
      }),

      fetchAniList({
        country:
          "CN",
        sort:
          "POPULARITY_DESC",
        perPage:
          8
      })
    ]);

  const value =
    index =>
      jobs[index].status ===
      "fulfilled"
        ? jobs[index].value
        : [];

  trendingPool =
    value(
      0
    );

  renderHero(
    trendingPool[0] ||
    null
  );

  renderFresh(
    value(
      1
    )
  );

  renderSpotlight(
    glRow,
    value(
      2
    ),
    "No GL titles found."
  );

  renderSpotlight(
    blRow,
    value(
      3
    ),
    "No BL titles found."
  );

  renderSpotlight(
    manhwaRow,
    value(
      4
    ),
    "No manhwa titles found."
  );

  renderSpotlight(
    manhuaRow,
    value(
      5
    ),
    "No manhua titles found."
  );
}

function randomManga() {
  const pool =
    currentBrowsePool.length
      ? currentBrowsePool
      : trendingPool;

  if (!pool.length) {
    return;
  }

  const manga =
    pool[
      Math.floor(
        Math.random() *
        pool.length
      )
    ];

  window.location.href =
    `detail.html?id=${encodeURIComponent(
      manga.id
    )}`;
}

function applyUrlSearch() {
  const query =
    new URLSearchParams(
      window.location.search
    ).get(
      "search"
    );

  if (
    query &&
    searchInput
  ) {
    searchInput.value =
      query;
  }
}

if (searchForm) {
  searchForm.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      loadBrowse();
    }
  );
}

[
  categoryFilterEl,
  originFilterEl,
  genreFilterEl
]
  .filter(Boolean)
  .forEach(
    element => {
      element.addEventListener(
        "change",
        loadBrowse
      );
    }
  );

if (
  clearFiltersButton
) {
  clearFiltersButton.addEventListener(
    "click",
    () => {
      if (searchInput) {
        searchInput.value =
          "";
      }

      if (
        categoryFilterEl
      ) {
        categoryFilterEl.value =
          "";
      }

      if (
        originFilterEl
      ) {
        originFilterEl.value =
          "";
      }

      if (
        genreFilterEl
      ) {
        genreFilterEl.selectedIndex =
          0;
      }

      loadBrowse();
    }
  );
}

rouletteBtn?.addEventListener(
  "click",
  randomManga
);

mobileRouletteBtn?.addEventListener(
  "click",
  randomManga
);

async function init() {
  applyUrlSearch();
  renderContinueReading();
  renderShelf();

  await Promise.allSettled([
    loadHomeSections(),
    loadBrowse()
  ]);
}

init();

const BOOKMARK_KEY = "panellyBookmarks";
const CONTINUE_KEY = "panellyContinueReading";

const heroEl = document.getElementById("hero");
const gridEl = document.getElementById("grid");
const freshGridEl = document.getElementById("freshGrid");

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

const genreFilter = document.getElementById("genreFilter");

const continueSection = document.getElementById("continueSection");
const continueGrid = document.getElementById("continueGrid");

const shelfSection = document.getElementById("shelfSection");
const shelfGrid = document.getElementById("shelfGrid");

const rouletteBtn = document.getElementById("rouletteBtn");

let browseItems = [];
let freshItems = [];

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

function stripHtml(value) {
  if (!value) {
    return "";
  }

  const parser = new DOMParser();

  const documentValue = parser.parseFromString(
    value,
    "text/html"
  );

  return (
    documentValue.body.textContent || ""
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

function getCover(manga) {
  return (
    manga?.coverImage?.extraLarge ||
    manga?.coverImage?.large ||
    manga?.coverImage?.medium ||
    ""
  );
}

function getYear(manga) {
  return manga?.startDate?.year || "—";
}

function getPrimaryGenre(manga) {
  return (
    manga?.genres?.[0] ||
    "Manga"
  );
}

function getScore(manga) {
  const score = Number(
    manga?.averageScore
  );

  return score
    ? `${score}%`
    : "NEW";
}

async function fetchAniList(params = {}) {
  const query =
    new URLSearchParams({
      mode: "browse"
    });

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        query.set(key, value);
      }
    }
  );

  const response = await fetch(
    `/api/anilist?${query.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      `AniList request failed: ${response.status}`
    );
  }

  return response.json();
}

async function fetchGenres() {
  const response = await fetch(
    "/api/anilist?mode=genres"
  );

  if (!response.ok) {
    throw new Error(
      "Genre request failed"
    );
  }

  return response.json();
}

function createPanelCard(
  manga,
  index
) {
  const title = getTitle(manga);
  const cover = getCover(manga);
  const genre = getPrimaryGenre(manga);
  const year = getYear(manga);
  const score = getScore(manga);

  const number =
    String(index + 1).padStart(
      2,
      "0"
    );

  return `
    <a
      class="panel-card ${
        index === 0
          ? "panel-card-wide"
          : ""
      }"
      href="detail.html?id=${encodeURIComponent(
        manga.id
      )}"
    >

      <div class="panel-card-image">

        ${
          cover
            ? `<img
                src="${escapeHtml(cover)}"
                alt="${escapeHtml(title)} cover"
                loading="${
                  index < 2
                    ? "eager"
                    : "lazy"
                }"
                decoding="async"
                ${
                  index < 2
                    ? 'fetchpriority="high"'
                    : ""
                }
              >`
            : `<div class="missing-cover">
                NO COVER
              </div>`
        }

        <span class="panel-index">
          PANEL ${number}
        </span>

        <span class="score-badge">
          ${escapeHtml(score)}
        </span>

      </div>

      <div class="panel-card-copy">

        <span class="panel-card-meta">
          ${escapeHtml(genre)}
          <b>•</b>
          ${escapeHtml(year)}
        </span>

        <h3>
          ${escapeHtml(title)}
        </h3>

        <span class="open-file">
          OPEN SERIES
          <b>→</b>
        </span>

      </div>

    </a>
  `;
}

function renderHero(manga) {
  if (!manga) {
    heroEl.innerHTML = `
      <div class="empty-panel">
        NO FEATURED SERIES FOUND
      </div>
    `;

    return;
  }

  const title = getTitle(manga);
  const cover = getCover(manga);

  const description =
    stripHtml(
      manga.description
    ) ||
    "Open the series file to learn more.";

  const genres =
    Array.isArray(manga.genres)
      ? manga.genres.slice(0, 4)
      : [];

  heroEl.innerHTML = `
    <div class="feature-art">

      ${
        cover
          ? `<img
              src="${escapeHtml(cover)}"
              alt="${escapeHtml(title)} cover"
              fetchpriority="high"
            >`
          : `<div class="missing-cover">
              NO COVER
            </div>`
      }

      <div class="feature-halftone"></div>

      <span class="feature-label">
        FEATURED SERIES
      </span>

    </div>

    <div class="feature-copy">

      <span class="feature-kicker">
        THIS WEEK'S MAIN PANEL
      </span>

      <h1>
        ${escapeHtml(title)}
      </h1>

      <div class="feature-tags">
        ${genres
          .map(
            (genre) =>
              `<span>${escapeHtml(
                genre
              )}</span>`
          )
          .join("")}
      </div>

      <p>
        ${escapeHtml(
          description.length > 320
            ? `${description.slice(
                0,
                320
              )}...`
            : description
        )}
      </p>

      <div class="feature-bottom">

        <a
          class="primary-cta"
          href="detail.html?id=${encodeURIComponent(
            manga.id
          )}"
        >
          OPEN SERIES FILE
          <b>→</b>
        </a>

        <div class="feature-stat">
          <span>
            SCORE
          </span>

          <strong>
            ${escapeHtml(
              getScore(manga)
            )}
          </strong>
        </div>

      </div>

    </div>
  `;
}

function safeStorageArray(key) {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) ||
      "[]"
    );

    return Array.isArray(value)
      ? value
      : [];
  } catch {
    return [];
  }
}

function getStoredMediaId(item) {
  const id =
    Number(
      item?.anilistId ??
      item?.mediaId ??
      item?.id
    );

  return Number.isInteger(id)
    ? id
    : null;
}

function renderContinueReading() {
  const items =
    safeStorageArray(
      CONTINUE_KEY
    )
      .filter(
        (item) =>
          getStoredMediaId(item) &&
          item.chapterId
      )
      .slice(0, 5);

  if (!items.length) {
    continueSection.classList.add(
      "hidden"
    );

    return;
  }

  continueSection.classList.remove(
    "hidden"
  );

  continueGrid.innerHTML =
    items
      .map((item, index) => {
        const mediaId =
          getStoredMediaId(item);

        const title =
          item.mangaTitle ||
          item.title ||
          "Untitled";

        const chapter =
          item.chapterLabel ||
          "Continue reading";

        const cover =
          item.coverUrl || "";

        return `
          <a
            class="continue-card"
            href="reader.html?chapterId=${encodeURIComponent(
              item.chapterId
            )}&mediaId=${encodeURIComponent(
              mediaId
            )}"
          >

            <div class="continue-number">
              ${String(
                index + 1
              ).padStart(
                2,
                "0"
              )}
            </div>

            <div class="continue-cover">

              ${
                cover
                  ? `<img
                      src="${escapeHtml(
                        cover
                      )}"
                      alt="${escapeHtml(
                        title
                      )}"
                      loading="lazy"
                    >`
                  : ""
              }

            </div>

            <div class="continue-copy">

              <span>
                CONTINUE
              </span>

              <strong>
                ${escapeHtml(title)}
              </strong>

              <small>
                ${escapeHtml(chapter)}
              </small>

            </div>

            <b class="continue-arrow">
              →
            </b>

          </a>
        `;
      })
      .join("");
}

function renderShelf() {
  const items =
    safeStorageArray(
      BOOKMARK_KEY
    )
      .filter(
        (item) =>
          getStoredMediaId(item)
      )
      .slice(0, 8);

  if (!items.length) {
    shelfSection.classList.add(
      "hidden"
    );

    return;
  }

  shelfSection.classList.remove(
    "hidden"
  );

  shelfGrid.innerHTML =
    items
      .map((item, index) => {
        const mediaId =
          getStoredMediaId(item);

        const title =
          item.mangaTitle ||
          item.title ||
          "Untitled";

        const cover =
          item.coverUrl || "";

        return `
          <a
            class="shelf-card"
            href="detail.html?id=${encodeURIComponent(
              mediaId
            )}"
          >

            <span class="shelf-number">
              ${String(
                index + 1
              ).padStart(
                2,
                "0"
              )}
            </span>

            <div class="shelf-cover">

              ${
                cover
                  ? `<img
                      src="${escapeHtml(
                        cover
                      )}"
                      alt="${escapeHtml(
                        title
                      )}"
                      loading="lazy"
                    >`
                  : ""
              }

            </div>

            <strong>
              ${escapeHtml(title)}
            </strong>

          </a>
        `;
      })
      .join("");
}

async function populateGenres() {
  try {
    const json =
      await fetchGenres();

    const genres =
      Array.isArray(json.genres)
        ? json.genres
        : [];

    genreFilter.innerHTML = `
      <option value="">
        All genres
      </option>

      ${genres
        .map(
          (genre) =>
            `<option value="${escapeHtml(
              genre
            )}">
              ${escapeHtml(
                genre
              )}
            </option>`
        )
        .join("")}
    `;
  } catch (error) {
    console.error(error);
  }
}

async function loadBrowse() {
  gridEl.innerHTML = `
    <div class="loading-block">
      <span>LOADING PANELS...</span>
    </div>
  `;

  const params = {
    perPage: 10,
    sort: "trending"
  };

  const search =
    searchInput.value.trim();

  const genre =
    genreFilter.value;

  if (search) {
    params.search = search;
  }

  if (genre) {
    params.genre = genre;
  }

  try {
    const json =
      await fetchAniList(
        params
      );

    browseItems =
      Array.isArray(json.manga)
        ? json.manga
        : [];

    if (!browseItems.length) {
      renderHero(null);

      gridEl.innerHTML = `
        <div class="empty-panel">
          NO PANELS FOUND
        </div>
      `;

      return;
    }

    renderHero(
      browseItems[0]
    );

    gridEl.innerHTML =
      browseItems
        .slice(1)
        .map(
          (manga, index) =>
            createPanelCard(
              manga,
              index
            )
        )
        .join("");
  } catch (error) {
    console.error(error);

    heroEl.innerHTML = `
      <div class="empty-panel">
        COULDN'T LOAD FEATURED SERIES
      </div>
    `;

    gridEl.innerHTML = `
      <div class="empty-panel">
        COULDN'T LOAD MANGA RIGHT NOW
      </div>
    `;
  }
}

async function loadFresh() {
  try {
    const json =
      await fetchAniList({
        perPage: 8,
        sort: "fresh"
      });

    freshItems =
      Array.isArray(json.manga)
        ? json.manga
        : [];

    if (!freshItems.length) {
      freshGridEl.innerHTML = `
        <div class="empty-panel">
          NO RECENT TITLES FOUND
        </div>
      `;

      return;
    }

    freshGridEl.innerHTML =
      freshItems
        .map(
          (manga, index) =>
            createPanelCard(
              manga,
              index
            )
        )
        .join("");
  } catch (error) {
    console.error(error);

    freshGridEl.innerHTML = `
      <div class="empty-panel">
        COULDN'T LOAD RECENT TITLES
      </div>
    `;
  }
}

function setupFreshObserver() {
  const section =
    document.getElementById(
      "freshPrint"
    );

  if (
    !section ||
    !("IntersectionObserver" in window)
  ) {
    loadFresh();
    return;
  }

  const observer =
    new IntersectionObserver(
      (entries) => {
        if (
          entries[0]
            .isIntersecting
        ) {
          observer.disconnect();
          loadFresh();
        }
      },
      {
        rootMargin: "500px"
      }
    );

  observer.observe(section);
}

function handleUrlSearch() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const search =
    params.get("search");

  if (search) {
    searchInput.value =
      search;
  }
}

searchForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    const value =
      searchInput.value.trim();

    const url =
      new URL(
        window.location.href
      );

    if (value) {
      url.searchParams.set(
        "search",
        value
      );
    } else {
      url.searchParams.delete(
        "search"
      );
    }

    window.history.replaceState(
      {},
      "",
      url
    );

    loadBrowse();
  }
);

genreFilter.addEventListener(
  "change",
  () => {
    loadBrowse();
  }
);

rouletteBtn.addEventListener(
  "click",
  () => {
    const pool = [
      ...browseItems,
      ...freshItems
    ];

    const unique =
      Array.from(
        new Map(
          pool.map(
            (item) => [
              item.id,
              item
            ]
          )
        ).values()
      );

    if (!unique.length) {
      return;
    }

    const manga =
      unique[
        Math.floor(
          Math.random() *
          unique.length
        )
      ];

    window.location.href =
      `detail.html?id=${encodeURIComponent(
        manga.id
      )}`;
  }
);

handleUrlSearch();

renderContinueReading();
renderShelf();

loadBrowse();

if (
  "requestIdleCallback" in
  window
) {
  requestIdleCallback(
    populateGenres
  );
} else {
  setTimeout(
    populateGenres,
    300
  );
}

setupFreshObserver();

window.addEventListener(
  "storage",
  () => {
    renderContinueReading();
    renderShelf();
  }
);

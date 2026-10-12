const CONTENT_RATING = [
  "safe",
  "suggestive"
];

const BOOKMARK_KEY =
  "panellyBookmarks";

const CONTINUE_KEY =
  "panellyContinueReading";

const heroEl =
  document.getElementById(
    "hero"
  );

const gridEl =
  document.getElementById(
    "mangaGrid"
  );

const freshGridEl =
  document.getElementById(
    "freshGrid"
  );

const gridTitleEl =
  document.getElementById(
    "gridTitle"
  );

const searchForm =
  document.getElementById(
    "searchForm"
  );

const searchInput =
  document.getElementById(
    "searchInput"
  );

const genreFilterEl =
  document.getElementById(
    "genreFilter"
  );

const rouletteBtn =
  document.getElementById(
    "rouletteBtn"
  );

const mobileRouletteBtn =
  document.getElementById(
    "mobileRouletteBtn"
  );

const continueSection =
  document.getElementById(
    "continueSection"
  );

const continueGrid =
  document.getElementById(
    "continueGrid"
  );

const shelfSection =
  document.getElementById(
    "shelfSection"
  );

const shelfGrid =
  document.getElementById(
    "shelfGrid"
  );

let trendingPool = [];
let currentBrowsePool = [];

function escapeHtml(value) {
  return String(
    value ?? ""
  ).replace(
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

  const parser =
    new DOMParser();

  const documentValue =
    parser.parseFromString(
      value,
      "text/html"
    );

  return (
    documentValue.body
      .textContent || ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

async function apiFetch(
  pathAndQuery
) {
  const response =
    await fetch(
      `/api/mangadex?path=${encodeURIComponent(
        pathAndQuery
      )}`
    );

  if (!response.ok) {
    throw new Error(
      `MangaDex request failed: ${response.status}`
    );
  }

  return response;
}

function buildQuery(params) {
  const parts = [];

  for (
    const [key, value]
    of Object.entries(params)
  ) {
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
          `${key}[]=${encodeURIComponent(
            item
          )}`
        );
      });
    } else {
      parts.push(
        `${key}=${encodeURIComponent(
          value
        )}`
      );
    }
  }

  return parts.join("&");
}

function getTitle(manga) {
  const titles =
    manga?.attributes?.title ||
    {};

  return (
    titles.en ||
    Object.values(titles)[0] ||
    "Untitled"
  );
}

function getDescription(
  manga
) {
  const descriptions =
    manga?.attributes
      ?.description ||
    {};

  return stripText(
    descriptions.en ||
    Object.values(
      descriptions
    )[0] ||
    ""
  ) ||
    "No description available.";
}

function getTags(manga) {
  return (
    manga?.attributes?.tags ||
    []
  )
    .map(
      (tag) =>
        tag?.attributes
          ?.name?.en ||
        Object.values(
          tag?.attributes
            ?.name ||
          {}
        )[0]
    )
    .filter(Boolean);
}

function getCoverFile(manga) {
  const relationship =
    manga?.relationships
      ?.find(
        (item) =>
          item.type ===
          "cover_art"
      );

  return (
    relationship
      ?.attributes
      ?.fileName ||
    ""
  );
}

function coverUrl(
  mangaId,
  fileName,
  size = 256
) {
  if (
    !mangaId ||
    !fileName
  ) {
    return "";
  }

  const original =
    `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.${size}.jpg`;

  return `/api/proxy-image?url=${encodeURIComponent(
    original
  )}`;
}

function getMangaCover(
  manga,
  size = 256
) {
  return coverUrl(
    manga.id,
    getCoverFile(manga),
    size
  );
}

function getPrimaryGenre(
  manga
) {
  return (
    getTags(manga)[0] ||
    "Manga"
  );
}

function validMangaDexId(
  id
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      String(id || "")
    );
}

function readStorage(key) {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(
          key
        ) ||
        "[]"
      );

    if (
      Array.isArray(value)
    ) {
      return value;
    }

    return [];
  } catch {
    return [];
  }
}

async function fetchGenres() {
  const response =
    await apiFetch(
      "/manga/tag"
    );

  const json =
    await response.json();

  return (
    json.data || []
  )
    .filter(
      (tag) =>
        tag?.attributes
          ?.group ===
        "genre"
    )
    .map(
      (tag) => ({
        id: tag.id,
        name:
          tag?.attributes
            ?.name?.en ||
          Object.values(
            tag?.attributes
              ?.name ||
            {}
          )[0]
      })
    )
    .filter(
      (tag) =>
        tag.name
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name
        )
    );
}

async function populateGenres() {
  try {
    const genres =
      await fetchGenres();

    genres.forEach(
      (genre) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          genre.id;

        option.textContent =
          genre.name;

        genreFilterEl.appendChild(
          option
        );
      }
    );
  } catch (error) {
    console.error(
      "Genre loading failed:",
      error
    );
  }
}

async function fetchManga({
  title,
  tagId,
  limit = 15,
  order = "followedCount"
} = {}) {
  const params = {
    limit,
    includes: [
      "cover_art"
    ],
    contentRating:
      CONTENT_RATING,
    availableTranslatedLanguage:
      ["en"],
    hasAvailableChapters:
      true
  };

  if (title) {
    params.title = title;
    params[
      "order[relevance]"
    ] = "desc";
  } else {
    params[
      `order[${order}]`
    ] = "desc";
  }

  if (tagId) {
    params.includedTags = [
      tagId
    ];
  }

  const response =
    await apiFetch(
      `/manga?${buildQuery(
        params
      )}`
    );

  const json =
    await response.json();

  return Array.isArray(
    json.data
  )
    ? json.data
    : [];
}

function renderHero(
  manga,
  number = 1
) {
  if (!manga) {
    heroEl.innerHTML = `
      <div class="hero-loading">
        No readable featured manga found.
      </div>
    `;

    return;
  }

  const title =
    getTitle(manga);

  const description =
    getDescription(manga);

  const tags =
    getTags(manga)
      .slice(0, 4);

  const cover =
    getMangaCover(
      manga,
      512
    );

  heroEl.innerHTML = `
    <div class="hero-inner">

      <div class="hero-copy">

        <span class="hero-series-label">
          ISSUE 001 / READABLE NOW
        </span>

        <h1 class="hero-title">
          ${escapeHtml(title)}
        </h1>

        <div class="hero-meta">
          ${tags
            .map(
              (tag) => `
                <span class="hero-tag">
                  ${escapeHtml(tag)}
                </span>
              `
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

  card.tabIndex = 0;

  const title =
    getTitle(manga);

  const cover =
    getMangaCover(
      manga,
      256
    );

  const genre =
    getPrimaryGenre(
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
        READABLE
      </span>

    </div>

    <div class="card-info">

      <h3 class="card-title">
        ${escapeHtml(title)}
      </h3>

      <div class="card-meta">

        <span>
          ${escapeHtml(genre)}
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
    (event) => {
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

function renderBrowse(
  mangaList
) {
  gridEl.innerHTML = "";

  currentBrowsePool =
    mangaList;

  if (!mangaList.length) {
    gridEl.innerHTML = `
      <p class="status-msg">
        No readable manga matched your search.
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
        No recent readable updates found.
      </p>
    `;

    return;
  }

  mangaList.forEach(
    (manga, index) => {
      const title =
        getTitle(manga);

      const cover =
        getMangaCover(
          manga,
          256
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

function storedCover(
  item
) {
  if (
    item.coverFile &&
    validMangaDexId(
      item.mangaId
    )
  ) {
    return coverUrl(
      item.mangaId,
      item.coverFile,
      256
    );
  }

  return "";
}

function renderContinueReading() {
  const items =
    readStorage(
      CONTINUE_KEY
    )
      .filter(
        (item) =>
          validMangaDexId(
            item.mangaId
          )
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
      .slice(0, 6);

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
    (item) => {
      const card =
        document.createElement(
          "a"
        );

      card.className =
        "continue-card";

      card.href =
        item.chapterId
          ? `reader.html?chapterId=${encodeURIComponent(
              item.chapterId
            )}&mangaId=${encodeURIComponent(
              item.mangaId
            )}`
          : `detail.html?id=${encodeURIComponent(
              item.mangaId
            )}`;

      const cover =
        storedCover(item);

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
          cover
            ? `
              <img
                src="${escapeHtml(
                  cover
                )}"
                alt="${escapeHtml(
                  item.mangaTitle ||
                  "Manga"
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

      continueGrid
        .appendChild(card);
    }
  );
}

function renderShelf() {
  const items =
    readStorage(
      BOOKMARK_KEY
    )
      .filter(
        (item) =>
          validMangaDexId(
            item.mangaId
          )
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
      .slice(0, 9);

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

  shelfGrid.innerHTML = "";

  items.forEach(
    (item) => {
      const card =
        document.createElement(
          "a"
        );

      card.className =
        "shelf-card";

      card.href =
        `detail.html?id=${encodeURIComponent(
          item.mangaId
        )}`;

      const cover =
        storedCover(item);

      card.innerHTML = `
        ${
          cover
            ? `
              <img
                src="${escapeHtml(
                  cover
                )}"
                alt="${escapeHtml(
                  item.mangaTitle ||
                  "Manga"
                )} cover"
              >
            `
            : ""
        }

        <div class="shelf-info">

          <div class="shelf-title">
            ${escapeHtml(
              item.mangaTitle ||
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
  const term =
    searchInput.value
      .trim();

  const tagId =
    genreFilterEl.value ||
    "";

  const genreName =
    tagId
      ? genreFilterEl.options[
          genreFilterEl
            .selectedIndex
        ].textContent
      : "";

  if (
    term &&
    genreName
  ) {
    gridTitleEl.textContent =
      `"${term}" · ${genreName}`;
  } else if (term) {
    gridTitleEl.textContent =
      `Search: ${term}`;
  } else if (
    genreName
  ) {
    gridTitleEl.textContent =
      genreName;
  } else {
    gridTitleEl.textContent =
      "Main Panels";
  }

  gridEl.innerHTML = `
    <div class="loading-panel">
      Looking for readable manga...
    </div>
  `;

  try {
    const mangaList =
      await fetchManga({
        title:
          term ||
          undefined,
        tagId:
          tagId ||
          undefined,
        limit: 15,
        order:
          "followedCount"
      });

    renderBrowse(
      mangaList
    );

    if (
      !term &&
      !tagId
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
    console.error(error);

    gridEl.innerHTML = `
      <p class="status-msg">
        Panelly couldn't load manga right now.
        Please try again.
      </p>
    `;

    if (
      !trendingPool.length
    ) {
      heroEl.innerHTML = `
        <div class="hero-loading">
          Couldn't load the featured series.
        </div>
      `;
    }
  }
}

async function loadFresh() {
  try {
    const mangaList =
      await fetchManga({
        limit: 8,
        order:
          "latestUploadedChapter"
      });

    renderFresh(
      mangaList
    );
  } catch (error) {
    console.error(error);

    freshGridEl.innerHTML = `
      <p class="status-msg">
        Couldn't load recent updates.
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

  const index =
    Math.floor(
      Math.random() *
      pool.length
    );

  renderHero(
    pool[index],
    index + 1
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
        behavior: "smooth"
      });
  }
);

genreFilterEl.addEventListener(
  "change",
  loadBrowse
);

rouletteBtn.addEventListener(
  "click",
  runRoulette
);

mobileRouletteBtn
  .addEventListener(
    "click",
    runRoulette
  );

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const initialSearch =
  urlParams.get(
    "search"
  );

if (initialSearch) {
  searchInput.value =
    initialSearch;
}

renderContinueReading();
renderShelf();

Promise.allSettled([
  populateGenres(),
  loadBrowse(),
  loadFresh()
]);

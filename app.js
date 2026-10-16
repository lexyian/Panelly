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

const categoryFilterEl =
  document.getElementById(
    "categoryFilter"
  );

const originFilterEl =
  document.getElementById(
    "originFilter"
  );

const genreFilterEl =
  document.getElementById(
    "genreFilter"
  );

const clearFiltersButton =
  document.getElementById(
    "clearFiltersButton"
  );

const rouletteBtn =
  document.getElementById(
    "rouletteBtn"
@@ -74,22 +89,48 @@
    "shelfGrid"
  );

const glRow =
  document.getElementById(
    "glRow"
  );

const blRow =
  document.getElementById(
    "blRow"
  );

const manhwaRow =
  document.getElementById(
    "manhwaRow"
  );

const manhuaRow =
  document.getElementById(
    "manhuaRow"
  );

let trendingPool = [];

let currentBrowsePool = [];

let specialTags = {
  gl: "",
  bl: ""
};

function escapeHtml(value) {
  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    (char) =>
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
      })[character]
  );
}

@@ -101,15 +142,15 @@
  const parser =
    new DOMParser();

  const documentValue =
  const parsed =
    parser.parseFromString(
      value,
      "text/html"
    );

  return (
    documentValue.body
      .textContent || ""
    parsed.body.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
@@ -150,13 +191,15 @@
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        parts.push(
          `${key}[]=${encodeURIComponent(
            item
          )}`
        );
      });
      value.forEach(
        (item) => {
          parts.push(
            `${key}[]=${encodeURIComponent(
              item
            )}`
          );
        }
      );
    } else {
      parts.push(
        `${key}=${encodeURIComponent(
@@ -189,14 +232,16 @@
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
  return (
    stripText(
      descriptions.en ||
      Object.values(
        descriptions
      )[0] ||
      ""
    ) ||
    "No description available."
  );
}

function getTags(manga) {
@@ -217,18 +262,19 @@
    .filter(Boolean);
}

function getCoverFile(manga) {
  const relationship =
function getCoverFile(
  manga
) {
  const cover =
    manga?.relationships
      ?.find(
        (item) =>
          item.type ===
        (relationship) =>
          relationship.type ===
          "cover_art"
      );

  return (
    relationship
      ?.attributes
    cover?.attributes
      ?.fileName ||
    ""
  );
@@ -246,11 +292,11 @@
    return "";
  }

  const original =
  const direct =
    `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.${size}.jpg`;

  return `/api/proxy-image?url=${encodeURIComponent(
    original
    direct
  )}`;
}

@@ -268,18 +314,83 @@
function getPrimaryGenre(
  manga
) {
  const tags =
    getTags(manga);

  const ignored = [
    "Girls' Love",
    "Boys' Love"
  ];

  return (
    getTags(manga)[0] ||
    tags.find(
      (tag) =>
        !ignored.includes(tag)
    ) ||
    tags[0] ||
    "Manga"
  );
}

function getOriginKey(
  manga
) {
  const language =
    manga?.attributes
      ?.originalLanguage;

  if (language === "ja") {
    return "manga";
  }

  if (language === "ko") {
    return "manhwa";
  }

  if (
    language === "zh" ||
    language === "zh-hk"
  ) {
    return "manhua";
  }

  return "other";
}

function getOriginLabel(
  manga
) {
  const key =
    getOriginKey(
      manga
    );

  const labels = {
    manga:
      "Manga · JP",

    manhwa:
      "Manhwa · KR",

    manhua:
      "Manhua · CN",

    other:
      "Comic"
  };

  return labels[key];
}

function validMangaDexId(
  id
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      String(id || "")
      String(
        id ||
        ""
      )
    );
}

@@ -293,19 +404,15 @@
        "[]"
      );

    if (
      Array.isArray(value)
    ) {
      return value;
    }

    return [];
    return Array.isArray(value)
      ? value
      : [];
  } catch {
    return [];
  }
}

async function fetchGenres() {
async function fetchAllTags() {
  const response =
    await apiFetch(
      "/manga/tag"
@@ -314,44 +421,101 @@
  const json =
    await response.json();

  return (
    json.data || []
  return Array.isArray(
    json.data
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
    ? json.data
    : [];
}

function findTagId(
  tags,
  expectedName
) {
  const normalizedExpected =
    expectedName
      .toLowerCase()
      .trim();

  const result =
    tags.find(
      (tag) => {
        const names =
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
          )
            .filter(Boolean)
            .map(
              (name) =>
                String(name)
                  .toLowerCase()
                  .trim()
            );

        return names.includes(
          normalizedExpected
        );
      }
    );

  return result?.id ||
    "";
}

async function populateGenres() {
async function populateGenresAndTags() {
  try {
    const tags =
      await fetchAllTags();

    specialTags.gl =
      findTagId(
        tags,
        "Girls' Love"
      );

    specialTags.bl =
      findTagId(
        tags,
        "Boys' Love"
      );

    const genres =
      await fetchGenres();
      tags
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
          (genre) =>
            genre.name &&
            genre.name !==
              "Girls' Love" &&
            genre.name !==
              "Boys' Love"
        )
        .sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        );

    genres.forEach(
      (genre) => {
@@ -366,25 +530,80 @@
        option.textContent =
          genre.name;

        genreFilterEl.appendChild(
          option
        );
        genreFilterEl
          .appendChild(
            option
          );
      }
    );
  } catch (error) {
    console.error(
      "Genre loading failed:",
      "Tag loading failed:",
      error
    );
  }
}

function originLanguages(
  origin
) {
  if (
    origin === "manga"
  ) {
    return ["ja"];
  }

  if (
    origin === "manhwa"
  ) {
    return ["ko"];
  }

  if (
    origin === "manhua"
  ) {
    return [
      "zh",
      "zh-hk"
    ];
  }

  return [];
}

async function fetchManga({
  title,
  category,
  tagId,
  origin,
  limit = 15,
  order = "followedCount"
} = {}) {
  const includedTags =
    [];

  if (
    category &&
    specialTags[category]
  ) {
    includedTags.push(
      specialTags[
        category
      ]
    );
  }

  if (tagId) {
    includedTags.push(
      tagId
    );
  }

  const uniqueTags =
    [...new Set(
      includedTags
    )];

  const params = {
    limit,
    includes: [
@@ -398,8 +617,28 @@
      true
  };

  if (
    uniqueTags.length
  ) {
    params.includedTags =
      uniqueTags;
  }

  const languages =
    originLanguages(
      origin
    );

  if (
    languages.length
  ) {
    params.originalLanguage =
      languages;
  }

  if (title) {
    params.title = title;

    params[
      "order[relevance]"
    ] = "desc";
@@ -409,12 +648,6 @@
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
@@ -439,52 +672,73 @@
  if (!manga) {
    heroEl.innerHTML = `
      <div class="hero-loading">
        No readable featured manga found.
        No readable featured title found.
      </div>
    `;

    return;
  }

  const title =
    getTitle(manga);
    getTitle(
      manga
    );

  const description =
    getDescription(manga);
    getDescription(
      manga
    );

  const tags =
    getTags(manga)
      .slice(0, 4);
    getTags(
      manga
    ).slice(
      0,
      4
    );

  const cover =
    getMangaCover(
      manga,
      512
    );

  const origin =
    getOriginLabel(
      manga
    );

  heroEl.innerHTML = `
    <div class="hero-inner">

      <div class="hero-copy">

        <span class="hero-series-label">
          ISSUE 001 / READABLE NOW
          ISSUE 001 / READABLE NOW / ${escapeHtml(
            origin
          )}
        </span>

        <h1 class="hero-title">
          ${escapeHtml(title)}
          ${escapeHtml(
            title
          )}
        </h1>

        <div class="hero-meta">

          ${tags
            .map(
              (tag) => `
                <span class="hero-tag">
                  ${escapeHtml(tag)}
                  ${escapeHtml(
                    tag
                  )}
                </span>
              `
            )
            .join("")}

        </div>

        <p class="hero-description">
@@ -564,7 +818,9 @@
  card.tabIndex = 0;

  const title =
    getTitle(manga);
    getTitle(
      manga
    );

  const cover =
    getMangaCover(
@@ -577,6 +833,11 @@
      manga
    );

  const origin =
    getOriginLabel(
      manga
    );

  card.innerHTML = `
    <div class="card-cover-wrap">

@@ -617,13 +878,27 @@
    <div class="card-info">

      <h3 class="card-title">
        ${escapeHtml(title)}
        ${escapeHtml(
          title
        )}
      </h3>

      <div class="card-meta">

        <span>
          ${escapeHtml(genre)}
        <span class="card-meta-left">

          <span>
            ${escapeHtml(
              genre
            )}
          </span>

          <span class="card-origin">
            ${escapeHtml(
              origin
            )}
          </span>

        </span>

        <span class="card-arrow">
@@ -635,16 +910,17 @@
    </div>
  `;

  const open = () => {
    window.location.href =
      `detail.html?id=${encodeURIComponent(
        manga.id
      )}`;
  };
  const openManga =
    () => {
      window.location.href =
        `detail.html?id=${encodeURIComponent(
          manga.id
        )}`;
    };

  card.addEventListener(
    "click",
    open
    openManga
  );

  card.addEventListener(
@@ -657,34 +933,120 @@
          " "
      ) {
        event.preventDefault();
        open();

        openManga();
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
    getTitle(
      manga
    );

  const cover =
    getMangaCover(
      manga,
      256
    );

  const origin =
    getOriginLabel(
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
        READABLE
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
          origin
        )} · VIEW SERIES →
      </span>

    </div>
  `;

  return card;
}

function renderBrowse(
  mangaList
) {
  gridEl.innerHTML = "";
  gridEl.innerHTML =
    "";

  currentBrowsePool =
    mangaList;

  if (!mangaList.length) {
  if (
    !mangaList.length
  ) {
    gridEl.innerHTML = `
      <p class="status-msg">
        No readable manga matched your search.
        No readable titles matched these filters.
      </p>
    `;

    return;
  }

  mangaList.forEach(
    (manga, index) => {
    (
      manga,
      index
    ) => {
      gridEl.appendChild(
        createMangaCard(
          manga,
@@ -695,13 +1057,47 @@
  );
}

function renderSpotlight(
  element,
  mangaList,
  emptyMessage
) {
  element.innerHTML = "";

  if (
    !mangaList.length
  ) {
    element.innerHTML = `
      <div class="shelf-loading">
        ${escapeHtml(
          emptyMessage
        )}
      </div>
    `;

    return;
  }

  mangaList.forEach(
    (manga) => {
      element.appendChild(
        createSpotlightCard(
          manga
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
  if (
    !mangaList.length
  ) {
    freshGridEl.innerHTML = `
      <p class="status-msg">
        No recent readable updates found.
@@ -712,16 +1108,26 @@
  }

  mangaList.forEach(
    (manga, index) => {
    (
      manga,
      index
    ) => {
      const title =
        getTitle(manga);
        getTitle(
          manga
        );

      const cover =
        getMangaCover(
          manga,
          256
        );

      const origin =
        getOriginLabel(
          manga
        );

      const card =
        document.createElement(
          "a"
@@ -762,6 +1168,8 @@
            ).padStart(
              2,
              "0"
            )} · ${escapeHtml(
              origin
            )}
          </span>

@@ -778,9 +1186,10 @@
        </div>
      `;

      freshGridEl.appendChild(
        card
      );
      freshGridEl
        .appendChild(
          card
        );
    }
  );
}
@@ -826,9 +1235,14 @@
            0
          )
      )
      .slice(0, 6);
      .slice(
        0,
        6
      );

  if (!items.length) {
  if (
    !items.length
  ) {
    continueSection
      .classList.add(
        "hidden-section"
@@ -867,7 +1281,9 @@
            )}`;

      const cover =
        storedCover(item);
        storedCover(
          item
        );

      const progress =
        Math.max(
@@ -891,7 +1307,7 @@
                )}"
                alt="${escapeHtml(
                  item.mangaTitle ||
                  "Manga"
                  "Series"
                )} cover"
              >
            `
@@ -919,16 +1335,20 @@
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
        .appendChild(
          card
        );
    }
  );
}
@@ -955,9 +1375,14 @@
            0
          )
      )
      .slice(0, 9);
      .slice(
        0,
        12
      );

  if (!items.length) {
  if (
    !items.length
  ) {
    shelfSection
      .classList.add(
        "hidden-section"
@@ -971,7 +1396,8 @@
      "hidden-section"
    );

  shelfGrid.innerHTML = "";
  shelfGrid.innerHTML =
    "";

  items.forEach(
    (item) => {
@@ -989,7 +1415,9 @@
        )}`;

      const cover =
        storedCover(item);
        storedCover(
          item
        );

      card.innerHTML = `
        ${
@@ -1001,7 +1429,7 @@
                )}"
                alt="${escapeHtml(
                  item.mangaTitle ||
                  "Manga"
                  "Series"
                )} cover"
              >
            `
@@ -1024,65 +1452,144 @@
        </div>
      `;

      shelfGrid.appendChild(
        card
      );
      shelfGrid
        .appendChild(
          card
        );
    }
  );
}

async function loadBrowse() {
function currentCategoryName() {
  const value =
    categoryFilterEl.value;

  if (
    value === "gl"
  ) {
    return "Girls' Love";
  }

  if (
    value === "bl"
  ) {
    return "Boys' Love";
  }

  return "";
}

function currentOriginName() {
  const value =
    originFilterEl.value;

  if (
    value === "manga"
  ) {
    return "Manga";
  }

  if (
    value === "manhwa"
  ) {
    return "Manhwa";
  }

  if (
    value === "manhua"
  ) {
    return "Manhua";
  }

  return "";
}

function updateBrowseTitle() {
  const parts = [];

  const term =
    searchInput.value
      .trim();

  const tagId =
    genreFilterEl.value ||
    "";
  const category =
    currentCategoryName();

  const genreName =
    tagId
  const origin =
    currentOriginName();

  const genre =
    genreFilterEl.value
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
  if (term) {
    parts.push(
      `"${term}"`
    );
  }

  if (category) {
    parts.push(
      category
    );
  }

  if (origin) {
    parts.push(
      origin
    );
  }

  if (genre) {
    parts.push(
      genre
    );
  }

  gridTitleEl.textContent =
    parts.length
      ? parts.join(" · ")
      : "Main Panels";
}

async function loadBrowse() {
  updateBrowseTitle();

  gridEl.innerHTML = `
    <div class="loading-panel">
      Looking for readable manga...
      Looking for readable titles...
    </div>
  `;

  try {
    const mangaList =
      await fetchManga({
        title:
          term ||
          searchInput.value
            .trim() ||
          undefined,

        category:
          categoryFilterEl
            .value ||
          undefined,

        tagId:
          tagId ||
          genreFilterEl
            .value ||
          undefined,

        origin:
          originFilterEl
            .value ||
          undefined,
        limit: 15,

        limit:
          15,

        order:
          "followedCount"
      });
@@ -1091,10 +1598,17 @@
      mangaList
    );

    if (
      !term &&
      !tagId
    ) {
    const noFilters =
      !searchInput.value
        .trim() &&
      !categoryFilterEl
        .value &&
      !originFilterEl
        .value &&
      !genreFilterEl
        .value;

    if (noFilters) {
      trendingPool =
        mangaList;

@@ -1108,24 +1622,15 @@
      }
    }
  } catch (error) {
    console.error(error);
    console.error(
      error
    );

    gridEl.innerHTML = `
      <p class="status-msg">
        Panelly couldn't load manga right now.
        Please try again.
        Panelly couldn't load these titles right now.
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

@@ -1142,7 +1647,9 @@
      mangaList
    );
  } catch (error) {
    console.error(error);
    console.error(
      error
    );

    freshGridEl.innerHTML = `
      <p class="status-msg">
@@ -1152,13 +1659,121 @@
  }
}

async function loadSpotlights() {
  const jobs = [
    {
      element:
        glRow,

      options: {
        category:
          "gl",
        limit:
          10,
        order:
          "followedCount"
      },

      empty:
        "No readable GL titles found."
    },

    {
      element:
        blRow,

      options: {
        category:
          "bl",
        limit:
          10,
        order:
          "followedCount"
      },

      empty:
        "No readable BL titles found."
    },

    {
      element:
        manhwaRow,

      options: {
        origin:
          "manhwa",
        limit:
          10,
        order:
          "followedCount"
      },

      empty:
        "No readable Manhwa found."
    },

    {
      element:
        manhuaRow,

      options: {
        origin:
          "manhua",
        limit:
          10,
        order:
          "followedCount"
      },

      empty:
        "No readable Manhua found."
    }
  ];

  await Promise.allSettled(
    jobs.map(
      async (
        job
      ) => {
        try {
          const mangaList =
            await fetchManga(
              job.options
            );

          renderSpotlight(
            job.element,
            mangaList,
            job.empty
          );
        } catch (
          error
        ) {
          console.error(
            error
          );

          renderSpotlight(
            job.element,
            [],
            "Couldn't load this shelf."
          );
        }
      }
    )
  );
}

function runRoulette() {
  const pool =
    currentBrowsePool.length
    currentBrowsePool
      .length
      ? currentBrowsePool
      : trendingPool;

  if (!pool.length) {
  if (
    !pool.length
  ) {
    return;
  }

@@ -1179,59 +1794,206 @@
  });
}

function scrollToBrowse() {
  document
    .getElementById(
      "browseSection"
    )
    .scrollIntoView({
      behavior:
        "smooth"
    });
}

function applyCategory(
  category
) {
  categoryFilterEl.value =
    category;

  searchInput.value = "";

  loadBrowse();

  scrollToBrowse();
}

function applyOrigin(
  origin
) {
  originFilterEl.value =
    origin;

  searchInput.value = "";

  loadBrowse();

  scrollToBrowse();
}

function clearFilters() {
  searchInput.value = "";

  categoryFilterEl.value =
    "";

  originFilterEl.value =
    "";

  genreFilterEl.value =
    "";

  loadBrowse();
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
    scrollToBrowse();
  }
);

genreFilterEl.addEventListener(
  "change",
  loadBrowse
);
categoryFilterEl
  .addEventListener(
    "change",
    loadBrowse
  );

rouletteBtn.addEventListener(
  "click",
  runRoulette
);
originFilterEl
  .addEventListener(
    "change",
    loadBrowse
  );

genreFilterEl
  .addEventListener(
    "change",
    loadBrowse
  );

clearFiltersButton
  .addEventListener(
    "click",
    clearFilters
  );

rouletteBtn
  .addEventListener(
    "click",
    runRoulette
  );

mobileRouletteBtn
  .addEventListener(
    "click",
    runRoulette
  );

const urlParams =
document
  .querySelectorAll(
    "[data-quick-category]"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          applyCategory(
            button.dataset
              .quickCategory
          );
        }
      );
    }
  );

document
  .querySelectorAll(
    "[data-quick-origin]"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          applyOrigin(
            button.dataset
              .quickOrigin
          );
        }
      );
    }
  );

document
  .querySelectorAll(
    "[data-show-category]"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          applyCategory(
            button.dataset
              .showCategory
          );
        }
      );
    }
  );

document
  .querySelectorAll(
    "[data-show-origin]"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          applyOrigin(
            button.dataset
              .showOrigin
          );
        }
      );
    }
  );

const params =
  new URLSearchParams(
    window.location.search
  );

const initialSearch =
  urlParams.get(
  params.get(
    "search"
  );

if (initialSearch) {
if (
  initialSearch
) {
  searchInput.value =
    initialSearch;
}

renderContinueReading();
renderShelf();
async function initializePanelly() {
  renderContinueReading();

  renderShelf();

  await populateGenresAndTags();

  await Promise.allSettled([
    loadBrowse(),
    loadFresh(),
    loadSpotlights()
  ]);
}

Promise.allSettled([
  populateGenres(),
  loadBrowse(),
  loadFresh()
]);
initializePanelly();

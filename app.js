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
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
  );
}

function stripText(value) {
  if (!value) {
    return "";
  }

  const parser =
    new DOMParser();

  const parsed =
    parser.parseFromString(
      value,
      "text/html"
    );

  return (
    parsed.body.textContent ||
    ""
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

function getCoverFile(
  manga
) {
  const cover =
    manga?.relationships
      ?.find(
        (relationship) =>
          relationship.type ===
          "cover_art"
      );

  return (
    cover?.attributes
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

  const direct =
    `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.${size}.jpg`;

  return `/api/proxy-image?url=${encodeURIComponent(
    direct
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
  const tags =
    getTags(manga);

  const ignored = [
    "Girls' Love",
    "Boys' Love"
  ];

  return (
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
      String(
        id ||
        ""
      )
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

    return Array.isArray(value)
      ? value
      : [];
  } catch {
    return [];
  }
}

async function fetchAllTags() {
  const response =
    await apiFetch(
      "/manga/tag"
    );

  const json =
    await response.json();

  return Array.isArray(
    json.data
  )
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
        const option =
          document.createElement(
            "option"
          );

        option.value =
          genre.id;

        option.textContent =
          genre.name;

        genreFilterEl
          .appendChild(
            option
          );
      }
    );
  } catch (error) {
    console.error(
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
      "cover_art"
    ],
    contentRating:
      CONTENT_RATING,
    availableTranslatedLanguage:
      ["en"],
    hasAvailableChapters:
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
  } else {
    params[
      `order[${order}]`
    ] = "desc";
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
        No readable featured title found.
      </div>
    `;

    return;
  }

  const title =
    getTitle(
      manga
    );

  const description =
    getDescription(
      manga
    );

  const tags =
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
          ISSUE 001 / READABLE NOW / ${escapeHtml(
            origin
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
              (tag) => `
                <span class="hero-tag">
                  ${escapeHtml(
                    tag
                  )}
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
    getTitle(
      manga
    );

  const cover =
    getMangaCover(
      manga,
      256
    );

  const genre =
    getPrimaryGenre(
      manga
    );

  const origin =
    getOriginLabel(
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
        ${escapeHtml(
          title
        )}
      </h3>

      <div class="card-meta">

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
          →
        </span>

      </div>

    </div>
  `;

  const openManga =
    () => {
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
        event.key ===
          "Enter" ||
        event.key ===
          " "
      ) {
        event.preventDefault();

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
  gridEl.innerHTML =
    "";

  currentBrowsePool =
    mangaList;

  if (
    !mangaList.length
  ) {
    gridEl.innerHTML = `
      <p class="status-msg">
        No readable titles matched these filters.
      </p>
    `;

    return;
  }

  mangaList.forEach(
    (
      manga,
      index
    ) => {
      gridEl.appendChild(
        createMangaCard(
          manga,
          index
        )
      );
    }
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

  if (
    !mangaList.length
  ) {
    freshGridEl.innerHTML = `
      <p class="status-msg">
        No recent readable updates found.
      </p>
    `;

    return;
  }

  mangaList.forEach(
    (
      manga,
      index
    ) => {
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
              origin
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

      freshGridEl
        .appendChild(
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
      .slice(
        0,
        6
      );

  if (
    !items.length
  ) {
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
        storedCover(
          item
        );

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

      continueGrid
        .appendChild(
          card
        );
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
      .slice(
        0,
        12
      );

  if (
    !items.length
  ) {
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
        storedCover(
          item
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
                  "Series"
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

      shelfGrid
        .appendChild(
          card
        );
    }
  );
}

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

  const category =
    currentCategoryName();

  const origin =
    currentOriginName();

  const genre =
    genreFilterEl.value
      ? genreFilterEl.options[
          genreFilterEl
            .selectedIndex
        ].textContent
      : "";

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
      Looking for readable titles...
    </div>
  `;

  try {
    const mangaList =
      await fetchManga({
        title:
          searchInput.value
            .trim() ||
          undefined,

        category:
          categoryFilterEl
            .value ||
          undefined,

        tagId:
          genreFilterEl
            .value ||
          undefined,

        origin:
          originFilterEl
            .value ||
          undefined,

        limit:
          15,

        order:
          "followedCount"
      });

    renderBrowse(
      mangaList
    );

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
    console.error(
      error
    );

    gridEl.innerHTML = `
      <p class="status-msg">
        Panelly couldn't load these titles right now.
      </p>
    `;
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
    console.error(
      error
    );

    freshGridEl.innerHTML = `
      <p class="status-msg">
        Couldn't load recent updates.
      </p>
    `;
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
    currentBrowsePool
      .length
      ? currentBrowsePool
      : trendingPool;

  if (
    !pool.length
  ) {
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

    scrollToBrowse();
  }
);

categoryFilterEl
  .addEventListener(
    "change",
    loadBrowse
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
  params.get(
    "search"
  );

if (
  initialSearch
) {
  searchInput.value =
    initialSearch;
}

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

initializePanelly();

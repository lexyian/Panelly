const CONTENT_RATING = [
  "safe",
  "suggestive"
];

const BOOKMARK_KEY =
  "panellyBookmarks";

const detailEl =
  document.getElementById(
    "detail"
  );

const chapterListEl =
  document.getElementById(
    "chapterList"
  );

const chapterCountEl =
  document.getElementById(
    "chapterCount"
  );

const searchForm =
  document.getElementById(
    "searchForm"
  );

const searchInput =
  document.getElementById(
    "searchInput"
  );

let currentManga = null;
let currentChapters = [];
let renderedChapterCount = 0;
let chapterObserver = null;

const CHAPTER_BATCH_SIZE = 100;

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

    if (
      Array.isArray(value)
    ) {
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

function getMangaId() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const id =
    params.get("id");

  if (
    !id ||
    !validMangaDexId(id)
  ) {
    return null;
  }

  return id;
}

function validMangaDexId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      String(
        id || ""
      )
    );
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
  size = 512
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

function getCreators(manga) {
  const relationships =
    manga?.relationships ||
    [];

  const creators =
    relationships
      .filter(
        (relationship) =>
          relationship.type ===
            "author" ||
          relationship.type ===
            "artist"
      )
      .map(
        (relationship) =>
          relationship
            ?.attributes
            ?.name
      )
      .filter(Boolean);

  return (
    [...new Set(creators)]
      .join(", ") ||
    "Unknown creator"
  );
}

function formatStatus(value) {
  if (!value) {
    return "unknown";
  }

  return String(value)
    .replace(/_/g, " ")
    .toLowerCase();
}

async function fetchManga(
  mangaId
) {
  const query =
    buildQuery({
      includes: [
        "cover_art",
        "author",
        "artist"
      ]
    });

  const response =
    await apiFetch(
      `/manga/${encodeURIComponent(
        mangaId
      )}?${query}`
    );

  const json =
    await response.json();

  return json.data || null;
}

async function fetchAllChapters(
  mangaId
) {
  const chapters = [];

  let offset = 0;
  let total = Infinity;

  const limit = 500;

  while (
    offset < total
  ) {
    const query =
      buildQuery({
        limit,
        offset,

        translatedLanguage: [
          "en"
        ],

        contentRating:
          CONTENT_RATING,

        includes: [
          "scanlation_group"
        ],

        "order[chapter]":
          "desc",

        "order[volume]":
          "desc"
      });

    const response =
      await apiFetch(
        `/manga/${encodeURIComponent(
          mangaId
        )}/feed?${query}`
      );

    const json =
      await response.json();

    const batch =
      Array.isArray(
        json.data
      )
        ? json.data
        : [];

    chapters.push(
      ...batch
    );

    total =
      Number(
        json.total ??
        chapters.length
      );

    if (!batch.length) {
      break;
    }

    offset +=
      batch.length;
  }

  return chapters;
}

function safeExternalUrl(
  value
) {
  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(value);

    if (
      url.protocol === "https:" ||
      url.protocol === "http:"
    ) {
      return url.toString();
    }
  } catch {}

  return null;
}

function getExternalName(
  url
) {
  if (!url) {
    return "External source";
  }

  try {
    const hostname =
      new URL(url)
        .hostname
        .replace(
          /^www\./,
          ""
        );

    if (
      hostname.includes(
        "mangaplus"
      )
    ) {
      return "MANGA Plus";
    }

    if (
      hostname.includes(
        "viz.com"
      )
    ) {
      return "VIZ";
    }

    if (
      hostname.includes(
        "webtoons"
      )
    ) {
      return "WEBTOON";
    }

    if (
      hostname.includes(
        "tapas"
      )
    ) {
      return "Tapas";
    }

    if (
      hostname.includes(
        "tappytoon"
      )
    ) {
      return "Tappytoon";
    }

    if (
      hostname.includes(
        "lezhin"
      )
    ) {
      return "Lezhin";
    }

    if (
      hostname.includes(
        "comikey"
      )
    ) {
      return "Comikey";
    }

    if (
      hostname.includes(
        "pocketcomics"
      )
    ) {
      return "Pocket Comics";
    }

    if (
      hostname.includes(
        "azuki"
      )
    ) {
      return "Azuki";
    }

    return hostname;
  } catch {
    return "External source";
  }
}

function getGroupName(
  chapter
) {
  const group =
    chapter?.relationships
      ?.find(
        (relationship) =>
          relationship.type ===
          "scanlation_group"
      );

  return (
    group?.attributes?.name ||
    "Community release"
  );
}

function chapterIsHosted(
  chapter
) {
  return !safeExternalUrl(
    chapter?.attributes
      ?.externalUrl
  );
}

function normalizeChapterNumber(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function chooseBetterChapter(
  existing,
  current
) {
  if (!existing) {
    return current;
  }

  const existingHosted =
    chapterIsHosted(
      existing
    );

  const currentHosted =
    chapterIsHosted(
      current
    );

  if (
    currentHosted &&
    !existingHosted
  ) {
    return current;
  }

  if (
    existingHosted &&
    !currentHosted
  ) {
    return existing;
  }

  const existingDate =
    new Date(
      existing
        ?.attributes
        ?.publishAt ||
      existing
        ?.attributes
        ?.createdAt ||
      0
    ).getTime();

  const currentDate =
    new Date(
      current
        ?.attributes
        ?.publishAt ||
      current
        ?.attributes
        ?.createdAt ||
      0
    ).getTime();

  return (
    currentDate >
    existingDate
  )
    ? current
    : existing;
}

function prepareChapters(
  chapters
) {
  const numericMap =
    new Map();

  const specials = [];

  chapters.forEach(
    (chapter) => {
      const number =
        normalizeChapterNumber(
          chapter
            ?.attributes
            ?.chapter
        );

      if (
        number === null
      ) {
        specials.push(
          chapter
        );

        return;
      }

      const key =
        String(number);

      numericMap.set(
        key,
        chooseBetterChapter(
          numericMap.get(key),
          chapter
        )
      );
    }
  );

  const numeric =
    Array.from(
      numericMap.entries()
    )
      .map(
        (
          [number, chapter]
        ) => ({
          number:
            Number(number),

          chapter,

          special:
            false
        })
      )
      .sort(
        (a, b) =>
          b.number -
          a.number
      );

  specials
    .sort(
      (a, b) =>
        new Date(
          b?.attributes
            ?.publishAt ||
          0
        ) -
        new Date(
          a?.attributes
            ?.publishAt ||
          0
        )
    )
    .forEach(
      (chapter) => {
        numeric.push({
          number:
            null,

          chapter,

          special:
            true
        });
      }
    );

  return numeric;
}

function readBookmarks() {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(
          BOOKMARK_KEY
        ) ||
        "[]"
      );

    return Array.isArray(
      value
    )
      ? value
      : [];
  } catch {
    return [];
  }
}

function saveBookmarks(
  items
) {
  localStorage.setItem(
    BOOKMARK_KEY,
    JSON.stringify(
      items
    )
  );
}

function isBookmarked() {
  if (!currentManga) {
    return false;
  }

  return readBookmarks()
    .some(
      (item) =>
        String(
          item.mangaId ||
          item.id ||
          ""
        ) ===
        String(
          currentManga.id
        )
    );
}

function updateBookmarkButton() {
  const button =
    document.getElementById(
      "bookmarkBtn"
    );

  if (!button) {
    return;
  }

  const saved =
    isBookmarked();

  button.textContent =
    saved
      ? "✓ Saved to Panel Shelf"
      : "+ Add to Panel Shelf";

  button.classList.toggle(
    "saved",
    saved
  );
}

function toggleBookmark() {
  if (!currentManga) {
    return;
  }

  const bookmarks =
    readBookmarks();

  const index =
    bookmarks.findIndex(
      (item) =>
        String(
          item.mangaId ||
          item.id ||
          ""
        ) ===
        String(
          currentManga.id
        )
    );

  if (
    index !== -1
  ) {
    bookmarks.splice(
      index,
      1
    );
  } else {
    bookmarks.unshift({
      mangaId:
        currentManga.id,

      mangaTitle:
        getTitle(
          currentManga
        ),

      title:
        getTitle(
          currentManga
        ),

      coverFile:
        getCoverFile(
          currentManga
        ),

      savedAt:
        Date.now()
    });
  }

  saveBookmarks(
    bookmarks
  );

  updateBookmarkButton();
}

function renderDetail(
  manga
) {
  currentManga =
    manga;

  const title =
    getTitle(manga);

  const description =
    getDescription(
      manga
    );

  const coverFile =
    getCoverFile(
      manga
    );

  const cover =
    coverUrl(
      manga.id,
      coverFile,
      512
    );

  const creators =
    getCreators(
      manga
    );

  const tags =
    getTags(
      manga
    );

  const status =
    formatStatus(
      manga?.attributes
        ?.status
    );

  const year =
    manga?.attributes
      ?.year;

  detailEl.innerHTML = `
    <div class="series-cover-panel">

      ${
        cover
          ? `
            <img
              class="detail-cover series-cover"
              src="${escapeHtml(
                cover
              )}"
              alt="${escapeHtml(
                title
              )} cover"
              decoding="async"
              fetchpriority="high"
            >
          `
          : `
            <div class="series-cover-placeholder">
              NO COVER
            </div>
          `
      }

      <span class="series-file-label">
        SERIES FILE
      </span>

    </div>

    <div class="detail-info series-info">

      <div class="series-topline">

        <span class="status-pill series-status">
          ${escapeHtml(
            status
          )}
        </span>

        ${
          year
            ? `
              <span class="series-year">
                ${escapeHtml(
                  year
                )}
              </span>
            `
            : ""
        }

      </div>

      <h1 class="detail-title series-title">
        ${escapeHtml(
          title
        )}
      </h1>

      <p class="detail-meta series-creator">
        ${escapeHtml(
          creators
        )}
      </p>

      <div class="tag-list series-tags">

        ${tags
          .slice(
            0,
            12
          )
          .map(
            (tag) => `
              <span class="tag">
                ${escapeHtml(
                  tag
                )}
              </span>
            `
          )
          .join("")}

      </div>

      <p class="detail-desc series-description">
        ${escapeHtml(
          description
        )}
      </p>

      <div class="series-actions">

        <a
          class="series-read-btn disabled"
          id="readNowBtn"
        >
          Checking chapters...
        </a>

        <button
          class="series-shelf-btn"
          id="bookmarkBtn"
          type="button"
        >
          + Add to Panel Shelf
        </button>

      </div>

    </div>
  `;

  document
    .getElementById(
      "bookmarkBtn"
    )
    ?.addEventListener(
      "click",
      toggleBookmark
    );

  updateBookmarkButton();

  document.title =
    `${title} — Panelly`;
}

function getChapterLabel(
  chapter,
  fallbackNumber
) {
  if (!chapter) {
    return (
      fallbackNumber !==
      null
        ? `Chapter ${fallbackNumber}`
        : "Special"
    );
  }

  const number =
    chapter?.attributes
      ?.chapter;

  const title =
    chapter?.attributes
      ?.title;

  let label =
    number
      ? `Chapter ${number}`
      : "Special";

  if (title) {
    label +=
      ` — ${title}`;
  }

  return label;
}

function updateChapterCount() {
  if (!chapterCountEl) {
    return;
  }

  const hosted =
    currentChapters
      .filter(
        (row) =>
          chapterIsHosted(
            row.chapter
          )
      )
      .length;

  const external =
    currentChapters
      .filter(
        (row) =>
          !chapterIsHosted(
            row.chapter
          )
      )
      .length;

  if (
    currentChapters.length
  ) {
    chapterCountEl
      .textContent =
      `${hosted} Panelly · ${external} external · ${currentChapters.length} available`;
  } else {
    chapterCountEl
      .textContent =
      "No MangaDex chapters";
  }
}

function updateReadButton() {
  const button =
    document.getElementById(
      "readNowBtn"
    );

  if (!button) {
    return;
  }

  const hosted =
    currentChapters
      .find(
        (row) =>
          chapterIsHosted(
            row.chapter
          )
      );

  if (hosted) {
    button.href =
      `reader.html?chapterId=${encodeURIComponent(
        hosted.chapter.id
      )}&mangaId=${encodeURIComponent(
        currentManga.id
      )}`;

    button.removeAttribute(
      "target"
    );

    button.removeAttribute(
      "rel"
    );

    button.textContent =
      "Start Reading →";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  const external =
    currentChapters
      .find(
        (row) =>
          safeExternalUrl(
            row.chapter
              ?.attributes
              ?.externalUrl
          )
      );

  const externalUrl =
    safeExternalUrl(
      external
        ?.chapter
        ?.attributes
        ?.externalUrl
    );

  if (externalUrl) {
    button.href =
      externalUrl;

    button.target =
      "_blank";

    button.rel =
      "noopener noreferrer";

    button.textContent =
      "Read on Source ↗";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  button.href =
    "https://www.komix.to/browse";

  button.target =
    "_blank";

  button.rel =
    "noopener noreferrer";

  button.textContent =
    "Search on Komix ↗";

  button.classList.remove(
    "disabled"
  );
}

function createChapterRow(
  row,
  index
) {
  const chapter =
    row.chapter;

  const externalUrl =
    safeExternalUrl(
      chapter?.attributes
        ?.externalUrl
    );

  const element =
    document.createElement(
      "a"
    );

  element.className =
    "chapter-row chapter-card-new";

  if (externalUrl) {
    element.href =
      externalUrl;

    element.target =
      "_blank";

    element.rel =
      "noopener noreferrer";
  } else {
    element.href =
      `reader.html?chapterId=${encodeURIComponent(
        chapter.id
      )}&mangaId=${encodeURIComponent(
        currentManga.id
      )}`;
  }

  const source =
    externalUrl
      ? getExternalName(
          externalUrl
        )
      : getGroupName(
          chapter
        );

  element.innerHTML = `
    <span class="chapter-index">

      ${String(
        index + 1
      ).padStart(
        2,
        "0"
      )}

    </span>

    <span class="chapter-main">

      <strong class="chapter-label">

        ${escapeHtml(
          getChapterLabel(
            chapter,
            row.number
          )
        )}

      </strong>

      <small class="chapter-group">

        ${
          externalUrl
            ? `${escapeHtml(
                source
              )} · External release`
            : `${escapeHtml(
                source
              )} · Panelly reader`
        }

      </small>

    </span>

    <span class="chapter-read">

      ${
        externalUrl
          ? "SOURCE ↗"
          : "READ →"
      }

    </span>
  `;

  return element;
}

function createKomixRow() {
  const element =
    document.createElement(
      "a"
    );

  element.className =
    "chapter-row chapter-card-new source-fallback-row";

  element.href =
    "https://www.komix.to/browse";

  element.target =
    "_blank";

  element.rel =
    "noopener noreferrer";

  element.innerHTML = `
    <span class="chapter-index">
      +
    </span>

    <span class="chapter-main">

      <strong class="chapter-label">
        Search more chapters on Komix
      </strong>

      <small class="chapter-group">
        External fallback source
      </small>

    </span>

    <span class="chapter-read">
      OPEN ↗
    </span>
  `;

  return element;
}

function appendChapterBatch() {
  const end =
    Math.min(
      renderedChapterCount +
        CHAPTER_BATCH_SIZE,
      currentChapters.length
    );

  const fragment =
    document.createDocumentFragment();

  for (
    let index =
      renderedChapterCount;
    index < end;
    index += 1
  ) {
    const row =
      currentChapters[
        index
      ];

    fragment.appendChild(
      createChapterRow(
        row,
        index
      )
    );
  }

  chapterListEl
    .appendChild(
      fragment
    );

  renderedChapterCount =
    end;

  setupChapterSentinel();
}

function setupChapterSentinel() {
  const oldSentinel =
    document.getElementById(
      "chapterLoadSentinel"
    );

  if (oldSentinel) {
    oldSentinel.remove();
  }

  if (chapterObserver) {
    chapterObserver.disconnect();
    chapterObserver = null;
  }

  if (
    renderedChapterCount >=
    currentChapters.length
  ) {
    chapterListEl
      .appendChild(
        createKomixRow()
      );

    return;
  }

  const sentinel =
    document.createElement(
      "div"
    );

  sentinel.id =
    "chapterLoadSentinel";

  sentinel.style.height =
    "2px";

  chapterListEl
    .appendChild(
      sentinel
    );

  if (
    "IntersectionObserver" in
    window
  ) {
    chapterObserver =
      new IntersectionObserver(
        (entries) => {
          if (
            entries[0]
              .isIntersecting
          ) {
            chapterObserver
              .disconnect();

            appendChapterBatch();
          }
        },
        {
          rootMargin:
            "600px"
        }
      );

    chapterObserver
      .observe(
        sentinel
      );
  } else {
    appendChapterBatch();
  }
}

function renderChapterIndex() {
  chapterListEl.innerHTML =
    "";

  renderedChapterCount =
    0;

  updateChapterCount();
  updateReadButton();

  if (
    !currentChapters.length
  ) {
    chapterListEl.innerHTML = `
      <div class="status-msg">

        <strong>
          No readable English chapters were found on MangaDex.
        </strong>

        <br><br>

        Panelly can still help you look for the series on another source.

      </div>
    `;

    chapterListEl
      .appendChild(
        createKomixRow()
      );

    return;
  }

  appendChapterBatch();
}

async function loadChapters(
  mangaId
) {
  chapterListEl.innerHTML = `
    <div class="loading-panel">
      Checking every available chapter...
    </div>
  `;

  try {
    const chapters =
      await fetchAllChapters(
        mangaId
      );

    currentChapters =
      prepareChapters(
        chapters
      );

    renderChapterIndex();
  } catch (error) {
    console.error(
      "Chapter loading failed:",
      error
    );

    currentChapters = [];

    chapterListEl.innerHTML = `
      <p class="status-msg">
        Panelly couldn't load MangaDex chapters right now.
      </p>
    `;

    chapterListEl
      .appendChild(
        createKomixRow()
      );

    updateChapterCount();
    updateReadButton();
  }
}

async function init() {
  const mangaId =
    getMangaId();

  if (!mangaId) {
    detailEl.innerHTML = `
      <p class="status-msg">
        Invalid manga.
      </p>
    `;

    chapterListEl.innerHTML = `
      <p class="status-msg">
        No chapter information available.
      </p>
    `;

    return;
  }

  try {
    const manga =
      await fetchManga(
        mangaId
      );

    if (!manga) {
      throw new Error(
        "Manga not found"
      );
    }

    renderDetail(
      manga
    );

    await loadChapters(
      mangaId
    );
  } catch (error) {
    console.error(
      error
    );

    detailEl.innerHTML = `
      <p class="status-msg">
        Panelly couldn't load this series.
      </p>
    `;

    chapterListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load chapter information.
      </p>
    `;
  }
}

if (searchForm) {
  searchForm
    .addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const term =
          searchInput
            ?.value
            ?.trim();

        if (!term) {
          return;
        }

        window.location.href =
          `index.html?search=${encodeURIComponent(
            term
          )}`;
      }
    );
}

init();

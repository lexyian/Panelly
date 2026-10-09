const CONTENT_RATING = ["safe", "suggestive"];
const BOOKMARK_KEY = "panellyBookmarks";

const detailEl = document.getElementById("detail");
const chapterListEl = document.getElementById("chapterList");
const chapterCountEl = document.getElementById("chapterCount");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

let currentManga = null;
let currentHostedChapters = [];
let currentExternalChapters = [];

async function apiFetch(pathAndQuery) {
  const res = await fetch(
    `/api/mangadex?path=${encodeURIComponent(pathAndQuery)}`
  );

  if (!res.ok) {
    throw new Error(
      `MangaDex request failed: ${res.status}`
    );
  }

  return res;
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

function getMangaId() {
  return new URLSearchParams(
    window.location.search
  ).get("id");
}

function getTitle(manga) {
  const titles =
    manga.attributes?.title || {};

  return (
    titles.en ||
    Object.values(titles)[0] ||
    "Untitled"
  );
}

function getRawDescription(manga) {
  const descriptions =
    manga.attributes?.description || {};

  return (
    descriptions.en ||
    Object.values(descriptions)[0] ||
    "No description available."
  );
}

function cleanDescription(text) {
  let value = String(text || "");

  const markers = [
    "\n---\n",
    "\nLinks:",
    "\n**Links:**",
    "\n### Links"
  ];

  let cutPosition = -1;

  markers.forEach((marker) => {
    const position =
      value.indexOf(marker);

    if (
      position !== -1 &&
      (
        cutPosition === -1 ||
        position < cutPosition
      )
    ) {
      cutPosition = position;
    }
  });

  if (cutPosition !== -1) {
    value = value.slice(
      0,
      cutPosition
    );
  }

  value = value.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    "$1"
  );

  value = value.replace(
    /<https?:\/\/[^>]+>/g,
    ""
  );

  value = value.replace(
    /\*\*/g,
    ""
  );

  value = value.replace(
    /\n{3,}/g,
    "\n\n"
  );

  return (
    value.trim() ||
    "No description available."
  );
}

function getTags(manga) {
  return (
    manga.attributes?.tags || []
  )
    .map(
      (tag) =>
        tag.attributes?.name?.en ||
        Object.values(
          tag.attributes?.name || {}
        )[0]
    )
    .filter(Boolean);
}

function getCreators(manga) {
  const names =
    manga.relationships
      ?.filter(
        (relationship) =>
          relationship.type === "author" ||
          relationship.type === "artist"
      )
      .map(
        (relationship) =>
          relationship.attributes?.name
      )
      .filter(Boolean) || [];

  return (
    [...new Set(names)].join(", ") ||
    "Unknown creator"
  );
}

function getCoverFile(manga) {
  const cover =
    manga.relationships?.find(
      (relationship) =>
        relationship.type === "cover_art"
    );

  return (
    cover?.attributes?.fileName ||
    ""
  );
}

function getCoverUrl(
  manga,
  size = 512
) {
  const fileName =
    getCoverFile(manga);

  if (!fileName) {
    return "";
  }

  const directUrl =
    `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.${size}.jpg`;

  return `/api/proxy-image?url=${encodeURIComponent(
    directUrl
  )}`;
}

function readBookmarks() {
  try {
    const stored =
      JSON.parse(
        localStorage.getItem(
          BOOKMARK_KEY
        ) || "[]"
      );

    if (Array.isArray(stored)) {
      return stored;
    }

    if (
      stored &&
      typeof stored === "object"
    ) {
      return Object.values(stored);
    }

    return [];
  } catch {
    return [];
  }
}

function writeBookmarks(items) {
  localStorage.setItem(
    BOOKMARK_KEY,
    JSON.stringify(items)
  );
}

function isBookmarked(mangaId) {
  return readBookmarks().some(
    (item) =>
      (
        item.mangaId ||
        item.id
      ) === mangaId
  );
}

function toggleBookmark() {
  if (!currentManga) {
    return;
  }

  const mangaId =
    currentManga.id;

  const bookmarks =
    readBookmarks();

  const existingIndex =
    bookmarks.findIndex(
      (item) =>
        (
          item.mangaId ||
          item.id
        ) === mangaId
    );

  if (existingIndex !== -1) {
    bookmarks.splice(
      existingIndex,
      1
    );
  } else {
    bookmarks.unshift({
      mangaId,
      title:
        getTitle(currentManga),
      mangaTitle:
        getTitle(currentManga),
      coverFile:
        getCoverFile(
          currentManga
        ),
      savedAt:
        Date.now()
    });
  }

  writeBookmarks(bookmarks);
  updateBookmarkButton();
}

function updateBookmarkButton() {
  const button =
    document.getElementById(
      "bookmarkBtn"
    );

  if (!button || !currentManga) {
    return;
  }

  const saved =
    isBookmarked(
      currentManga.id
    );

  button.classList.toggle(
    "saved",
    saved
  );

  button.textContent =
    saved
      ? "✓ Saved to My Shelf"
      : "+ Add to My Shelf";
}

async function fetchMangaDetail(id) {
  const query =
    buildQuery({
      includes: [
        "cover_art",
        "author",
        "artist"
      ]
    });

  const res =
    await apiFetch(
      `/manga/${encodeURIComponent(
        id
      )}?${query}`
    );

  const json =
    await res.json();

  return json.data;
}

async function fetchChapters(id) {
  const query =
    buildQuery({
      translatedLanguage: [
        "en"
      ],
      "order[chapter]":
        "asc",
      limit: 500,
      includes: [
        "scanlation_group"
      ],
      contentRating:
        CONTENT_RATING
    });

  const res =
    await apiFetch(
      `/manga/${encodeURIComponent(
        id
      )}/feed?${query}`
    );

  const json =
    await res.json();

  return Array.isArray(
    json.data
  )
    ? json.data
    : [];
}

function safeExternalUrl(value) {
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

function chapterKey(chapter) {
  const number =
    chapter.attributes?.chapter;

  if (
    number !== null &&
    number !== undefined &&
    number !== ""
  ) {
    return `chapter-${number}`;
  }

  return `id-${chapter.id}`;
}

function chapterNumber(chapter) {
  const value =
    parseFloat(
      chapter.attributes?.chapter
    );

  return Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
}

function uniqueHostedChapters(
  chapters
) {
  const map =
    new Map();

  chapters
    .filter(
      (chapter) =>
        !safeExternalUrl(
          chapter.attributes
            ?.externalUrl
        )
    )
    .forEach((chapter) => {
      const key =
        chapterKey(chapter);

      if (!map.has(key)) {
        map.set(
          key,
          chapter
        );
      }
    });

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      chapterNumber(a) -
      chapterNumber(b)
  );
}

function externalChapters(
  chapters
) {
  return chapters.filter(
    (chapter) =>
      safeExternalUrl(
        chapter.attributes
          ?.externalUrl
      )
  );
}

function getSourceName(urlValue) {
  try {
    const hostname =
      new URL(urlValue)
        .hostname
        .replace(/^www\./, "");

    const knownSources = {
      "mangaplus.shueisha.co.jp":
        "MANGA Plus",
      "viz.com":
        "VIZ",
      "webtoons.com":
        "WEBTOON",
      "tapas.io":
        "Tapas",
      "pocketcomics.com":
        "Pocket Comics",
      "tappytoon.com":
        "Tappytoon",
      "comikey.com":
        "Comikey",
      "azuki.co":
        "Azuki"
    };

    return (
      knownSources[hostname] ||
      hostname
    );
  } catch {
    return "Official source";
  }
}

function getOfficialSources(
  chapters
) {
  const sources =
    new Map();

  chapters.forEach(
    (chapter) => {
      const url =
        safeExternalUrl(
          chapter.attributes
            ?.externalUrl
        );

      if (!url) {
        return;
      }

      let hostname;

      try {
        hostname =
          new URL(url).hostname;
      } catch {
        return;
      }

      if (!sources.has(hostname)) {
        sources.set(
          hostname,
          {
            url,
            name:
              getSourceName(url)
          }
        );
      }
    }
  );

  return Array.from(
    sources.values()
  );
}

function renderDetail(manga) {
  currentManga = manga;

  const title =
    getTitle(manga);

  const description =
    cleanDescription(
      getRawDescription(manga)
    );

  const cover =
    getCoverUrl(manga);

  const creator =
    getCreators(manga);

  const tags =
    getTags(manga);

  const status =
    manga.attributes?.status ||
    "unknown";

  const year =
    manga.attributes?.year;

  detailEl.innerHTML = `
    <div class="series-cover-panel">
      ${
        cover
          ? `<img
              class="series-cover"
              src="${escapeHtml(
                cover
              )}"
              alt="${escapeHtml(
                title
              )} cover"
              decoding="async"
              fetchpriority="high"
            >`
          : `<div class="series-cover-placeholder">
              NO COVER
            </div>`
      }

      <span class="series-file-label">
        SERIES FILE
      </span>
    </div>

    <div class="series-info">
      <div class="series-topline">
        <span class="series-status">
          ${escapeHtml(
            status
          )}
        </span>

        ${
          year
            ? `<span class="series-year">
                ${escapeHtml(
                  year
                )}
              </span>`
            : ""
        }
      </div>

      <h1 class="series-title">
        ${escapeHtml(title)}
      </h1>

      <p class="series-creator">
        ${escapeHtml(
          creator
        )}
      </p>

      <div class="series-tags">
        ${tags
          .slice(0, 12)
          .map(
            (tag) =>
              `<span>${escapeHtml(
                tag
              )}</span>`
          )
          .join("")}
      </div>

      <p class="series-description">
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
          + Add to My Shelf
        </button>
      </div>
    </div>
  `;

  const bookmarkButton =
    document.getElementById(
      "bookmarkBtn"
    );

  bookmarkButton.addEventListener(
    "click",
    toggleBookmark
  );

  updateBookmarkButton();

  document.title =
    `${title} — Panelly`;

  const descriptionMeta =
    document.querySelector(
      'meta[name="description"]'
    );

  if (descriptionMeta) {
    descriptionMeta.content =
      description.slice(
        0,
        150
      );
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

  if (
    currentHostedChapters.length
  ) {
    const chapter =
      currentHostedChapters[0];

    button.href =
      `reader.html?chapterId=${encodeURIComponent(
        chapter.id
      )}`;

    button.textContent =
      "Start Reading →";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  button.removeAttribute(
    "href"
  );

  button.textContent =
    "No Panelly Reader Chapters";

  button.classList.add(
    "disabled"
  );
}

function getChapterLabel(
  chapter
) {
  const number =
    chapter.attributes?.chapter;

  const title =
    chapter.attributes?.title;

  let label =
    number
      ? `Chapter ${number}`
      : "Oneshot";

  if (title) {
    label +=
      ` — ${title}`;
  }

  return label;
}

function renderHostedChapters(
  chapters
) {
  chapterListEl.innerHTML = "";

  chapters.forEach(
    (chapter, index) => {
      const group =
        chapter.relationships
          ?.find(
            (relationship) =>
              relationship.type ===
              "scanlation_group"
          );

      const groupName =
        group?.attributes?.name ||
        "Community release";

      const row =
        document.createElement(
          "a"
        );

      row.className =
        "chapter-card-new";

      row.href =
        `reader.html?chapterId=${encodeURIComponent(
          chapter.id
        )}`;

      row.innerHTML = `
        <span class="chapter-index">
          ${String(
            index + 1
          ).padStart(2, "0")}
        </span>

        <span class="chapter-main">
          <strong>
            ${escapeHtml(
              getChapterLabel(
                chapter
              )
            )}
          </strong>

          <small>
            ${escapeHtml(
              groupName
            )}
          </small>
        </span>

        <span class="chapter-read">
          READ →
        </span>
      `;

      chapterListEl.appendChild(
        row
      );
    }
  );
}

function renderExternalFallback(
  chapters
) {
  const sources =
    getOfficialSources(
      chapters
    );

  const sourceButtons =
    sources
      .slice(0, 4)
      .map(
        (source) => `
          <a
            class="official-source-btn"
            href="${escapeHtml(
              source.url
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${escapeHtml(
              source.name
            )} ↗
          </a>
        `
      )
      .join("");

  chapterListEl.innerHTML = `
    <div class="external-only-panel">

      <span class="external-label">
        OFFICIAL RELEASE ONLY
      </span>

      <h3>
        This series isn't hosted inside
        Panelly yet.
      </h3>

      <p>
        MangaDex lists this title, but its
        English chapters are hosted by an
        external publisher. Panelly can only
        display chapter pages that MangaDex
        actually provides.
      </p>

      ${
        sourceButtons
          ? `
            <div class="official-sources">
              ${sourceButtons}
            </div>
          `
          : ""
      }

      <a
        class="find-readable-btn"
        href="index.html#browseSection"
      >
        ← Find another readable series
      </a>

    </div>
  `;
}

function renderNoChapters() {
  chapterListEl.innerHTML = `
    <div class="external-only-panel">

      <span class="external-label">
        NO ENGLISH RELEASE
      </span>

      <h3>
        No readable English chapters yet.
      </h3>

      <p>
        Check back later or browse another
        title on Panelly.
      </p>

      <a
        class="find-readable-btn"
        href="index.html#browseSection"
      >
        ← Browse manga
      </a>

    </div>
  `;
}

function renderChapters(
  chapters
) {
  currentHostedChapters =
    uniqueHostedChapters(
      chapters
    );

  currentExternalChapters =
    externalChapters(
      chapters
    );

  updateReadButton();

  chapterCountEl.textContent =
    currentHostedChapters.length
      ? `${currentHostedChapters.length} readable`
      : "0 readable";

  if (
    currentHostedChapters.length
  ) {
    renderHostedChapters(
      currentHostedChapters
    );

    return;
  }

  if (
    currentExternalChapters.length
  ) {
    renderExternalFallback(
      currentExternalChapters
    );

    return;
  }

  renderNoChapters();
}

async function init() {
  const id =
    getMangaId();

  if (!id) {
    detailEl.innerHTML = `
      <div class="series-loading">
        No manga selected.
      </div>
    `;

    chapterListEl.innerHTML = "";

    return;
  }

  try {
    const [
      manga,
      chapters
    ] =
      await Promise.all([
        fetchMangaDetail(id),
        fetchChapters(id)
      ]);

    renderDetail(manga);
    renderChapters(chapters);
  } catch (err) {
    console.error(err);

    detailEl.innerHTML = `
      <div class="series-loading">
        Couldn't open this series.
      </div>
    `;

    chapterListEl.innerHTML = `
      <div class="chapter-loading">
        Couldn't load chapters.
      </div>
    `;
  }
}

searchForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    const term =
      searchInput.value.trim();

    if (!term) {
      return;
    }

    window.location.href =
      `index.html?search=${encodeURIComponent(
        term
      )}`;
  }
);

init();

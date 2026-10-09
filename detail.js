const CONTENT_RATING = ["safe", "suggestive"];
const BOOKMARK_KEY = "panellyBookmarks";

const detailEl = document.getElementById("detail");
const chapterListEl = document.getElementById("chapterList");
const chapterCountEl = document.getElementById("chapterCount");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

let currentManga = null;
let currentChapters = [];

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
    "\n---",
    "\nLinks:",
    "\n**Links:**",
    "\n### Links",
    "\nOfficial English",
    "\nOfficial Translation"
  ];

  let cutAt = -1;

  markers.forEach((marker) => {
    const position =
      value.indexOf(marker);

    if (
      position !== -1 &&
      (
        cutAt === -1 ||
        position < cutAt
      )
    ) {
      cutAt = position;
    }
  });

  if (cutAt !== -1) {
    value = value.slice(
      0,
      cutAt
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
      `/manga/${encodeURIComponent(id)}?${query}`
    );

  const json =
    await res.json();

  return json.data;
}

async function fetchChapters(id) {
  const query =
    buildQuery({
      translatedLanguage: ["en"],
      "order[chapter]": "asc",
      limit: 500,
      includes: [
        "scanlation_group"
      ],
      contentRating:
        CONTENT_RATING
    });

  const res =
    await apiFetch(
      `/manga/${encodeURIComponent(id)}/feed?${query}`
    );

  const json =
    await res.json();

  return Array.isArray(json.data)
    ? json.data
    : [];
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

function saveBookmarks(bookmarks) {
  localStorage.setItem(
    BOOKMARK_KEY,
    JSON.stringify(bookmarks)
  );
}

function isBookmarked(id) {
  return readBookmarks().some(
    (item) =>
      (
        item.mangaId ||
        item.id
      ) === id
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
        (
          item.mangaId ||
          item.id
        ) === currentManga.id
    );

  if (index !== -1) {
    bookmarks.splice(
      index,
      1
    );
  } else {
    bookmarks.unshift({
      mangaId:
        currentManga.id,
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

  saveBookmarks(bookmarks);
  updateBookmarkButton();
}

function updateBookmarkButton() {
  const button =
    document.getElementById(
      "bookmarkBtn"
    );

  if (
    !button ||
    !currentManga
  ) {
    return;
  }

  const saved =
    isBookmarked(
      currentManga.id
    );

  button.textContent =
    saved
      ? "✓ Saved to My Shelf"
      : "+ Add to My Shelf";

  button.classList.toggle(
    "saved",
    saved
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

  const creators =
    getCreators(manga);

  const tags =
    getTags(manga);

  const status =
    manga.attributes?.status ||
    "unknown";

  const year =
    manga.attributes?.year;

  const cover =
    getCoverUrl(manga);

  detailEl.innerHTML = `
    <div class="series-cover-panel">
      ${
        cover
          ? `<img
              class="detail-cover series-cover"
              src="${escapeHtml(cover)}"
              alt="${escapeHtml(title)} cover"
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

    <div class="detail-info series-info">

      <div class="series-topline">

        <span class="status-pill series-status">
          ${escapeHtml(status)}
        </span>

        ${
          year
            ? `<span class="series-year">
                ${escapeHtml(year)}
              </span>`
            : ""
        }

      </div>

      <h1 class="detail-title series-title">
        ${escapeHtml(title)}
      </h1>

      <p class="detail-meta series-creator">
        ${escapeHtml(creators)}
      </p>

      <div class="tag-list series-tags">
        ${tags
          .slice(0, 12)
          .map(
            (tag) =>
              `<span class="tag">
                ${escapeHtml(tag)}
              </span>`
          )
          .join("")}
      </div>

      <p class="detail-desc series-description">
        ${escapeHtml(description)}
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

  const bookmarkBtn =
    document.getElementById(
      "bookmarkBtn"
    );

  if (bookmarkBtn) {
    bookmarkBtn.addEventListener(
      "click",
      toggleBookmark
    );
  }

  updateBookmarkButton();

  document.title =
    `${title} — Panelly`;
}

function getChapterKey(chapter) {
  const number =
    chapter.attributes?.chapter;

  if (
    number === null ||
    number === undefined ||
    number === ""
  ) {
    return `oneshot-${chapter.id}`;
  }

  return `chapter-${number}`;
}

function chapterSortValue(
  chapter
) {
  const number =
    parseFloat(
      chapter.attributes?.chapter
    );

  if (
    Number.isFinite(number)
  ) {
    return number;
  }

  return Number.MAX_SAFE_INTEGER;
}

function getBestChapters(
  chapters
) {
  const map =
    new Map();

  chapters.forEach(
    (chapter) => {
      const key =
        getChapterKey(
          chapter
        );

      const existing =
        map.get(key);

      if (!existing) {
        map.set(
          key,
          chapter
        );

        return;
      }

      const existingExternal =
        Boolean(
          safeExternalUrl(
            existing.attributes
              ?.externalUrl
          )
        );

      const currentExternal =
        Boolean(
          safeExternalUrl(
            chapter.attributes
              ?.externalUrl
          )
        );

      if (
        existingExternal &&
        !currentExternal
      ) {
        map.set(
          key,
          chapter
        );

        return;
      }

      if (
        existingExternal ===
        currentExternal
      ) {
        const existingTitle =
          existing.attributes
            ?.title;

        const currentTitle =
          chapter.attributes
            ?.title;

        if (
          !existingTitle &&
          currentTitle
        ) {
          map.set(
            key,
            chapter
          );
        }
      }
    }
  );

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      chapterSortValue(a) -
      chapterSortValue(b)
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

function getGroupName(
  chapter
) {
  const group =
    chapter.relationships?.find(
      (relationship) =>
        relationship.type ===
        "scanlation_group"
    );

  return (
    group?.attributes?.name ||
    "Community release"
  );
}

function getExternalSourceName(
  urlValue
) {
  try {
    const hostname =
      new URL(urlValue)
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
        "webtoons.com"
      )
    ) {
      return "WEBTOON";
    }

    if (
      hostname.includes(
        "tapas.io"
      )
    ) {
      return "Tapas";
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
        "tappytoon"
      )
    ) {
      return "Tappytoon";
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
        "azuki"
      )
    ) {
      return "Azuki";
    }

    return "Official site";
  } catch {
    return "Official site";
  }
}

function updateReadButton(
  chapters
) {
  const button =
    document.getElementById(
      "readNowBtn"
    );

  if (!button) {
    return;
  }

  const hosted =
    chapters.find(
      (chapter) =>
        !safeExternalUrl(
          chapter.attributes
            ?.externalUrl
        )
    );

  if (hosted) {
    button.href =
      `reader.html?chapterId=${encodeURIComponent(
        hosted.id
      )}`;

    button.textContent =
      "Start Reading →";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  const first =
    chapters[0];

  if (first) {
    const externalUrl =
      safeExternalUrl(
        first.attributes
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
        "Read Officially ↗";

      button.classList.remove(
        "disabled"
      );

      return;
    }
  }

  button.removeAttribute(
    "href"
  );

  button.textContent =
    "No Chapters Available";

  button.classList.add(
    "disabled"
  );
}

function renderChapters(
  chapters
) {
  currentChapters =
    getBestChapters(
      chapters
    );

  chapterListEl.innerHTML =
    "";

  if (
    chapterCountEl
  ) {
    chapterCountEl.textContent =
      `${currentChapters.length} chapters`;
  }

  updateReadButton(
    currentChapters
  );

  if (
    !currentChapters.length
  ) {
    chapterListEl.innerHTML = `
      <p class="status-msg">
        No English chapters available.
      </p>
    `;

    return;
  }

  currentChapters.forEach(
    (chapter, index) => {
      const externalUrl =
        safeExternalUrl(
          chapter.attributes
            ?.externalUrl
        );

      const row =
        document.createElement(
          "a"
        );

      row.className =
        "chapter-row chapter-card-new";

      const sourceName =
        externalUrl
          ? getExternalSourceName(
              externalUrl
            )
          : getGroupName(
              chapter
            );

      if (externalUrl) {
        row.href =
          externalUrl;

        row.target =
          "_blank";

        row.rel =
          "noopener noreferrer";
      } else {
        row.href =
          `reader.html?chapterId=${encodeURIComponent(
            chapter.id
          )}`;
      }

      row.innerHTML = `
        <span class="chapter-index">
          ${String(
            index + 1
          ).padStart(2, "0")}
        </span>

        <span class="chapter-main">

          <strong class="chapter-label">
            ${escapeHtml(
              getChapterLabel(
                chapter
              )
            )}
          </strong>

          <small class="chapter-group">
            ${escapeHtml(
              sourceName
            )}
          </small>

        </span>

        <span class="chapter-read">
          ${
            externalUrl
              ? "OFFICIAL ↗"
              : "READ →"
          }
        </span>
      `;

      chapterListEl.appendChild(
        row
      );
    }
  );
}

async function init() {
  const id =
    getMangaId();

  if (!id) {
    detailEl.innerHTML = `
      <p class="status-msg">
        No manga selected.
      </p>
    `;

    chapterListEl.innerHTML =
      "";

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
      <p class="status-msg">
        Couldn't load this manga.
      </p>
    `;

    chapterListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load chapters.
      </p>
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

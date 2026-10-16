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

let externalChapters = [];

let renderedChapterCount = 0;

let chapterObserver = null;

const CHAPTER_BATCH_SIZE =
  100;

const detailStyle =
  document.createElement(
    "style"
  );

detailStyle.textContent = `
  @media (max-width: 800px) {
    .detail-cover {
      height: auto !important;
      min-height: 0 !important;
      aspect-ratio: 0.74;
    }

    .detail-cover img {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      object-position: center top !important;
    }
  }
`;

document.head.appendChild(
  detailStyle
);

function escapeHtml(value) {
  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    character =>
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
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function validMangaDexId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      String(
        id || ""
      )
    );
}

function getMangaId() {
  const id =
    new URLSearchParams(
      window.location.search
    ).get(
      "id"
    );

  return validMangaDexId(
    id
  )
    ? id
    : null;
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
    const [
      key,
      value
    ]
    of Object.entries(
      params
    )
  ) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      continue;
    }

    if (
      Array.isArray(
        value
      )
    ) {
      value.forEach(
        item => {
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

  return parts.join(
    "&"
  );
}

function getTitle(manga) {
  const titles =
    manga?.attributes?.title ||
    {};

  return (
    titles.en ||
    Object.values(
      titles
    )[0] ||
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

function getCoverFile(
  manga
) {
  const cover =
    manga?.relationships
      ?.find(
        relationship =>
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

function getCreators(
  manga
) {
  const names =
    (
      manga?.relationships ||
      []
    )
      .filter(
        relationship =>
          relationship.type ===
            "author" ||
          relationship.type ===
            "artist"
      )
      .map(
        relationship =>
          relationship
            ?.attributes
            ?.name
      )
      .filter(
        Boolean
      );

  return (
    [
      ...new Set(
        names
      )
    ].join(", ") ||
    "Unknown creator"
  );
}

function getTags(manga) {
  return (
    manga?.attributes
      ?.tags ||
    []
  )
    .map(
      tag =>
        tag?.attributes
          ?.name?.en ||
        Object.values(
          tag?.attributes
            ?.name ||
          {}
        )[0]
    )
    .filter(
      Boolean
    );
}

function formatStatus(value) {
  return String(
    value ||
    "unknown"
  )
    .replace(
      /_/g,
      " "
    )
    .toLowerCase();
}

function formatLanguage(
  language
) {
  const languages = {
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    "zh-hk": "Chinese"
  };

  return (
    languages[
      language
    ] ||
    language ||
    "Unknown"
  );
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

  return json.data ||
    null;
}

async function fetchAllChapters(
  mangaId
) {
  const chapters = [];

  const limit = 100;

  let offset = 0;

  let total = Infinity;

  while (
    offset <
    total
  ) {
    const query =
      buildQuery({
        translatedLanguage: [
          "en"
        ],

        contentRating:
          CONTENT_RATING,

        includes: [
          "scanlation_group"
        ],

        "order[chapter]":
          "asc",

        "order[volume]":
          "asc",

        limit,
        offset
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

    if (
      !batch.length
    ) {
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
      new URL(
        value
      );

    if (
      url.protocol ===
        "https:" ||
      url.protocol ===
        "http:"
    ) {
      return url.toString();
    }
  } catch {}

  return null;
}

function chapterNumber(
  chapter
) {
  const raw =
    chapter?.attributes
      ?.chapter;

  if (
    raw === null ||
    raw === undefined ||
    raw === ""
  ) {
    return null;
  }

  const number =
    Number(
      raw
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function isInternalChapter(
  chapter
) {
  return (
    Boolean(
      chapter?.id
    ) &&
    !safeExternalUrl(
      chapter
        ?.attributes
        ?.externalUrl
    )
  );
}

function chooseBetterChapter(
  existing,
  current
) {
  if (!existing) {
    return current;
  }

  const existingInternal =
    isInternalChapter(
      existing
    );

  const currentInternal =
    isInternalChapter(
      current
    );

  if (
    currentInternal &&
    !existingInternal
  ) {
    return current;
  }

  if (
    existingInternal &&
    !currentInternal
  ) {
    return existing;
  }

  const existingTime =
    new Date(
      existing?.attributes
        ?.publishAt ||
      existing?.attributes
        ?.createdAt ||
      0
    ).getTime();

  const currentTime =
    new Date(
      current?.attributes
        ?.publishAt ||
      current?.attributes
        ?.createdAt ||
      0
    ).getTime();

  return (
    currentTime >
    existingTime
  )
    ? current
    : existing;
}

function prepareChapters(
  chapters
) {
  const numeric =
    new Map();

  const specials = [];

  const external = [];

  chapters.forEach(
    chapter => {
      const externalUrl =
        safeExternalUrl(
          chapter?.attributes
            ?.externalUrl
        );

      if (
        externalUrl
      ) {
        external.push(
          chapter
        );
      }

      const number =
        chapterNumber(
          chapter
        );

      if (
        number === null
      ) {
        if (
          isInternalChapter(
            chapter
          )
        ) {
          specials.push(
            chapter
          );
        }

        return;
      }

      const key =
        String(
          number
        );

      numeric.set(
        key,
        chooseBetterChapter(
          numeric.get(
            key
          ),
          chapter
        )
      );
    }
  );

  const internal =
    Array.from(
      numeric.entries()
    )
      .map(
        (
          [
            number,
            chapter
          ]
        ) => ({
          number:
            Number(
              number
            ),

          chapter
        })
      )
      .filter(
        row =>
          isInternalChapter(
            row.chapter
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          a.number -
          b.number
      );

  specials.forEach(
    chapter => {
      internal.push({
        number:
          null,

        chapter
      });
    }
  );

  return {
    internal,
    external
  };
}

function getChapterLabel(
  chapter,
  fallbackNumber = null
) {
  const number =
    chapter?.attributes
      ?.chapter ??
    fallbackNumber;

  const title =
    chapter?.attributes
      ?.title;

  let label =
    number !== null &&
    number !== undefined &&
    number !== ""
      ? `Chapter ${number}`
      : "Special";

  if (
    title
  ) {
    label +=
      ` — ${title}`;
  }

  return label;
}

function getGroupName(
  chapter
) {
  const group =
    chapter?.relationships
      ?.find(
        relationship =>
          relationship.type ===
          "scanlation_group"
      );

  return (
    group?.attributes
      ?.name ||
    "Community release"
  );
}

function getExternalName(
  url
) {
  try {
    const hostname =
      new URL(
        url
      )
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
        "pocketcomics"
      )
    ) {
      return "Pocket Comics";
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

function readBookmarks() {
  try {
    const items =
      JSON.parse(
        localStorage.getItem(
          BOOKMARK_KEY
        ) ||
        "[]"
      );

    return Array.isArray(
      items
    )
      ? items
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
  if (
    !currentManga
  ) {
    return false;
  }

  return readBookmarks()
    .some(
      item =>
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

function toggleBookmark() {
  if (
    !currentManga
  ) {
    return;
  }

  const bookmarks =
    readBookmarks();

  const index =
    bookmarks.findIndex(
      item =>
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

function updateBookmarkButton() {
  const button =
    document.getElementById(
      "bookmarkBtn"
    );

  if (
    !button
  ) {
    return;
  }

  const saved =
    isBookmarked();

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
  currentManga =
    manga;

  const title =
    getTitle(
      manga
    );

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
      ?.year ||
    "—";

  const language =
    formatLanguage(
      manga?.attributes
        ?.originalLanguage
    );

  const lastVolume =
    manga?.attributes
      ?.lastVolume ||
    "—";

  const lastChapter =
    manga?.attributes
      ?.lastChapter ||
    "—";

  detailEl.innerHTML = `
    <div class="detail-hero">

      <div
        class="detail-cover"
        style="height:620px;min-height:620px;align-self:start;"
      >

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
                decoding="async"
                fetchpriority="high"
                style="width:100%;height:100%;object-fit:cover;object-position:center top;"
              >
            `
            : `
              <div class="image-fallback"></div>
            `
        }

        <span class="detail-cover-label">
          SERIES FILE
        </span>

      </div>

      <div class="detail-copy">

        <span class="detail-kicker">
          ${escapeHtml(
            status
          )} · ${escapeHtml(
            language
          )}
        </span>

        <h1 class="detail-title">
          ${escapeHtml(
            title
          )}
        </h1>

        <p class="detail-creators">
          ${escapeHtml(
            creators
          )}
        </p>

        <div class="detail-tags">

          ${tags
            .slice(
              0,
              12
            )
            .map(
              tag => `
                <span class="detail-tag">
                  ${escapeHtml(
                    tag
                  )}
                </span>
              `
            )
            .join("")}

        </div>

        <p class="detail-description">
          ${escapeHtml(
            description
          )}
        </p>

        <div class="detail-actions">

          <a
            class="primary-button"
            id="readNowBtn"
          >
            Checking Chapters...
          </a>

          <button
            class="secondary-button"
            id="bookmarkBtn"
            type="button"
          >
            + Add to My Shelf
          </button>

        </div>

        <div class="detail-stats">

          <div class="detail-stat">

            <span>
              STATUS
            </span>

            <strong>
              ${escapeHtml(
                status
              )}
            </strong>

          </div>

          <div class="detail-stat">

            <span>
              YEAR
            </span>

            <strong>
              ${escapeHtml(
                year
              )}
            </strong>

          </div>

          <div class="detail-stat">

            <span>
              ORIGIN
            </span>

            <strong>
              ${escapeHtml(
                language
              )}
            </strong>

          </div>

          <div class="detail-stat">

            <span>
              VOLUMES
            </span>

            <strong>
              ${escapeHtml(
                lastVolume
              )}
            </strong>

          </div>

          <div class="detail-stat">

            <span>
              CHAPTERS
            </span>

            <strong>
              ${escapeHtml(
                lastChapter
              )}
            </strong>

          </div>

        </div>

      </div>

    </div>

    <section
      id="sourcePanel"
      class="source-panel"
    ></section>
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

function readerUrl(
  chapterId
) {
  const params =
    new URLSearchParams({
      source:
        "mangadex",

      chapterId:
        String(
          chapterId
        ),

      mangaId:
        String(
          currentManga.id
        )
    });

  return `reader.html?${params.toString()}`;
}

function getSourceList() {
  const results = [];

  const seenSites =
    new Set();

  externalChapters.forEach(
    chapter => {
      const url =
        safeExternalUrl(
          chapter?.attributes
            ?.externalUrl
        );

      if (!url) {
        return;
      }

      const name =
        getExternalName(
          url
        );

      const key =
        String(
          name
        )
          .toLowerCase()
          .trim();

      if (
        seenSites.has(
          key
        )
      ) {
        return;
      }

      seenSites.add(
        key
      );

      results.push({
        name,

        url,

        note:
          "External reading source"
      });
    }
  );

  if (
    !seenSites.has(
      "komix"
    )
  ) {
    results.push({
      name:
        "Komix",

      url:
        "https://www.komix.to/browse",

      note:
        `Search for ${getTitle(
          currentManga
        )}`
    });
  }

  return results;
}

function renderSources() {
  const panel =
    document.getElementById(
      "sourcePanel"
    );

  if (
    !panel
  ) {
    return;
  }

  const sources =
    getSourceList();

  panel.innerHTML = `
    <div class="source-panel-head">

      <div>

        <span class="source-kicker">
          READING SOURCES
        </span>

        <strong>

          ${
            currentChapters.length
              ? `${currentChapters.length} chapter${currentChapters.length === 1 ? "" : "s"} available in Panelly`
              : "More places to check for this title"
          }

        </strong>

      </div>

      <span class="source-mode">
        MULTI-SOURCE
      </span>

    </div>

    <div class="source-grid">

      ${
        currentChapters.length
          ? `
            <div class="source-card source-card-panelly">

              <span class="source-type">
                PANELLY READER
              </span>

              <strong>
                Read inside Panelly
              </strong>

              <small>
                Opens without leaving the site
              </small>

              <a href="#chapterList">
                VIEW CHAPTERS ↓
              </a>

            </div>
          `
          : ""
      }

      ${sources
        .map(
          source => `
            <a
              class="source-card"
              href="${escapeHtml(
                source.url
              )}"
              target="_blank"
              rel="noopener noreferrer"
            >

              <span class="source-type">
                EXTERNAL SOURCE
              </span>

              <strong>
                ${escapeHtml(
                  source.name
                )}
              </strong>

              <small>
                ${escapeHtml(
                  source.note
                )}
              </small>

              <span>
                OPEN ↗
              </span>

            </a>
          `
        )
        .join("")}

    </div>
  `;
}

function updateReadButton() {
  const button =
    document.getElementById(
      "readNowBtn"
    );

  if (
    !button
  ) {
    return;
  }

  if (
    currentChapters.length
  ) {
    const first =
      currentChapters[0]
        .chapter;

    button.href =
      readerUrl(
        first.id
      );

    button.textContent =
      "Start Reading →";

    button.style.opacity =
      "1";

    button.style.pointerEvents =
      "auto";

    return;
  }

  button.removeAttribute(
    "href"
  );

  button.textContent =
    "No Readable Chapters";

  button.style.opacity =
    "0.45";

  button.style.pointerEvents =
    "none";
}

function updateChapterCount() {
  if (
    !chapterCountEl
  ) {
    return;
  }

  chapterCountEl.textContent =
    currentChapters.length
      ? `${currentChapters.length} readable chapter${currentChapters.length === 1 ? "" : "s"}`
      : "No in-app chapters";
}

function createChapterRow(
  row,
  index
) {
  const chapter =
    row.chapter;

  const element =
    document.createElement(
      "a"
    );

  element.className =
    "chapter-row";

  element.href =
    readerUrl(
      chapter.id
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

      <strong>

        ${escapeHtml(
          getChapterLabel(
            chapter,
            row.number
          )
        )}

      </strong>

      <small>

        ${escapeHtml(
          getGroupName(
            chapter
          )
        )}

      </small>

    </span>

    <span class="chapter-read">

      READ →

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
    fragment.appendChild(
      createChapterRow(
        currentChapters[
          index
        ],
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
  document
    .getElementById(
      "chapterLoadSentinel"
    )
    ?.remove();

  if (
    chapterObserver
  ) {
    chapterObserver
      .disconnect();

    chapterObserver =
      null;
  }

  if (
    renderedChapterCount >=
    currentChapters.length
  ) {
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
        entries => {
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

    chapterObserver.observe(
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

  renderSources();

  if (
    !currentChapters.length
  ) {
    chapterListEl.innerHTML = `
      <div class="status-msg">

        No chapters are currently available
        inside the Panelly reader.

      </div>
    `;

    return;
  }

  appendChapterBatch();
}

async function init() {
  const mangaId =
    getMangaId();

  if (
    !mangaId
  ) {
    detailEl.innerHTML = `
      <div class="error-screen">

        <div>

          <h1>
            Invalid manga.
          </h1>

          <p>
            This series could not be opened.
          </p>

          <a
            class="primary-button"
            href="index.html"
          >
            Back Home
          </a>

        </div>

      </div>
    `;

    chapterListEl.innerHTML =
      "";

    return;
  }

  try {
    const manga =
      await fetchManga(
        mangaId
      );

    if (
      !manga
    ) {
      throw new Error(
        "Manga not found"
      );
    }

    renderDetail(
      manga
    );

    const chapters =
      await fetchAllChapters(
        mangaId
      );

    const prepared =
      prepareChapters(
        chapters
      );

    currentChapters =
      prepared.internal;

    externalChapters =
      prepared.external;

    renderChapterIndex();
  } catch (error) {
    console.error(
      error
    );

    detailEl.innerHTML = `
      <div class="error-screen">

        <div>

          <h1>
            Couldn't load series.
          </h1>

          <p>
            Panelly couldn't load this title right now.
          </p>

          <a
            class="primary-button"
            href="index.html"
          >
            Back Home
          </a>

        </div>

      </div>
    `;

    chapterListEl.innerHTML =
      "";
  }
}

searchForm
  ?.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      const term =
        searchInput
          ?.value
          ?.trim();

      if (
        !term
      ) {
        return;
      }

      window.location.href =
        `index.html?search=${encodeURIComponent(
          term
        )}`;
    }
  );

init();

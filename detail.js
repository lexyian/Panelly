const BOOKMARK_KEY =
  "panellyBookmarks";

const CONTENT_RATING = [
  "safe",
  "suggestive"
];

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

function getMangaId() {
  return new URLSearchParams(
    window.location.search
  ).get("id");
}

function validId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      String(id || "")
    );
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

function getCoverFile(
  manga
) {
  return (
    manga?.relationships
      ?.find(
        (relationship) =>
          relationship.type ===
          "cover_art"
      )
      ?.attributes
      ?.fileName ||
    ""
  );
}

function getCoverUrl(
  manga,
  size = 512
) {
  const fileName =
    getCoverFile(
      manga
    );

  if (!fileName) {
    return "";
  }

  const original =
    `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.${size}.jpg`;

  return `/api/proxy-image?url=${encodeURIComponent(
    original
  )}`;
}

function getCreators(
  manga
) {
  const people =
    manga?.relationships
      ?.filter(
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
      .filter(Boolean) ||
    [];

  return (
    [...new Set(people)]
      .join(", ") ||
    "Unknown creator"
  );
}

function formatValue(value) {
  if (!value) {
    return "Unknown";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character
          .toUpperCase()
    );
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

    return Array.isArray(value)
      ? value
      : [];
  } catch {
    return [];
  }
}

function isBookmarked() {
  if (!currentManga) {
    return false;
  }

  return readBookmarks()
    .some(
      (item) =>
        item.mangaId ===
        currentManga.id
    );
}

function bookmarkText() {
  return isBookmarked()
    ? "Remove from Shelf"
    : "Add to Panel Shelf";
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
        item.mangaId ===
        currentManga.id
    );

  if (index >= 0) {
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
      coverFile:
        getCoverFile(
          currentManga
        ),
      savedAt:
        Date.now()
    });
  }

  localStorage.setItem(
    BOOKMARK_KEY,
    JSON.stringify(
      bookmarks
    )
  );

  const button =
    document.getElementById(
      "bookmarkButton"
    );

  if (button) {
    button.textContent =
      bookmarkText();
  }
}

async function fetchManga(
  id
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
        id
      )}?${query}`
    );

  const json =
    await response.json();

  return json.data;
}

async function fetchAniList(
  manga
) {
  const id =
    manga?.attributes
      ?.links?.al;

  if (!id) {
    return null;
  }

  try {
    const response =
      await fetch(
        `/api/anilist?mode=detail&id=${encodeURIComponent(
          id
        )}`
      );

    if (!response.ok) {
      return null;
    }

    const json =
      await response.json();

    return json.manga ||
      null;
  } catch {
    return null;
  }
}

async function fetchJikan(
  manga
) {
  const idMal =
    manga?.attributes
      ?.links?.mal;

  if (!idMal) {
    return null;
  }

  try {
    const response =
      await fetch(
        `/api/jikan?idMal=${encodeURIComponent(
          idMal
        )}`
      );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function safeUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(value);

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

function getOfficialLink(
  manga
) {
  const links =
    manga?.attributes
      ?.links ||
    {};

  const candidates = [
    links.engtl,
    links.raw,
    links.bw,
    links.amz,
    links.ebj,
    links.cdj
  ];

  for (
    const value
    of candidates
  ) {
    const url =
      safeUrl(value);

    if (url) {
      return url;
    }
  }

  return null;
}

function renderDetail(
  manga
) {
  currentManga = manga;

  const title =
    getTitle(manga);

  const description =
    getDescription(manga);

  const cover =
    getCoverUrl(
      manga,
      512
    );

  const tags =
    getTags(manga)
      .slice(0, 10);

  const year =
    manga?.attributes?.year ||
    "Unknown";

  const status =
    formatValue(
      manga?.attributes
        ?.status
    );

  const demographic =
    formatValue(
      manga?.attributes
        ?.publicationDemographic
    );

  const originalLanguage =
    String(
      manga?.attributes
        ?.originalLanguage ||
      "Unknown"
    ).toUpperCase();

  const contentRating =
    formatValue(
      manga?.attributes
        ?.contentRating
    );

  const official =
    getOfficialLink(
      manga
    );

  document.title =
    `${title} — Panelly`;

  detailEl.innerHTML = `
    <div class="detail-hero">

      <div class="detail-cover">

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

        <span class="detail-cover-label">
          SERIES FILE
        </span>

      </div>

      <div class="detail-copy">

        <span class="detail-kicker">
          READABLE SERIES / MANGADEX
        </span>

        <h1 class="detail-title">
          ${escapeHtml(title)}
        </h1>

        <p class="detail-creators">
          ${escapeHtml(
            getCreators(
              manga
            )
          )}
        </p>

        <div class="detail-tags">
          ${tags
            .map(
              (tag) => `
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
            id="readFirstButton"
            href="#chapterList"
          >
            Check Chapters
          </a>

          <button
            class="secondary-button"
            id="bookmarkButton"
            type="button"
          >
            ${bookmarkText()}
          </button>

          ${
            official
              ? `
                <a
                  class="secondary-button"
                  href="${escapeHtml(
                    official
                  )}"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official Source ↗
                </a>
              `
              : ""
          }

        </div>

        <div class="detail-stats">

          <div class="detail-stat">
            <span>YEAR</span>
            <strong>
              ${escapeHtml(
                year
              )}
            </strong>
          </div>

          <div class="detail-stat">
            <span>STATUS</span>
            <strong>
              ${escapeHtml(
                status
              )}
            </strong>
          </div>

          <div class="detail-stat">
            <span>DEMOGRAPHIC</span>
            <strong>
              ${escapeHtml(
                demographic
              )}
            </strong>
          </div>

          <div class="detail-stat">
            <span>LANGUAGE</span>
            <strong>
              ${escapeHtml(
                originalLanguage
              )}
            </strong>
          </div>

          <div class="detail-stat">
            <span>RATING</span>
            <strong>
              ${escapeHtml(
                contentRating
              )}
            </strong>
          </div>

          <div class="detail-stat">
            <span>ANILIST SCORE</span>
            <strong id="aniScore">
              —
            </strong>
          </div>

          <div class="detail-stat">
            <span>MAL SCORE</span>
            <strong id="malScore">
              —
            </strong>
          </div>

        </div>

      </div>

    </div>
  `;

  document
    .getElementById(
      "bookmarkButton"
    )
    ?.addEventListener(
      "click",
      toggleBookmark
    );
}

function renderEnrichment(
  aniList,
  jikan
) {
  const aniScore =
    document.getElementById(
      "aniScore"
    );

  const malScore =
    document.getElementById(
      "malScore"
    );

  if (aniScore) {
    aniScore.textContent =
      aniList?.averageScore
        ? `${aniList.averageScore}%`
        : "—";
  }

  if (malScore) {
    malScore.textContent =
      jikan?.score
        ? Number(
            jikan.score
          ).toFixed(2)
        : "—";
  }
}

async function fetchAllChapters(
  mangaId
) {
  const all = [];
  const limit = 100;

  let offset = 0;
  let total = Infinity;

  while (
    offset < total
  ) {
    const query =
      buildQuery({
        translatedLanguage:
          ["en"],
        contentRating:
          CONTENT_RATING,
        includes: [
          "scanlation_group"
        ],
        limit,
        offset,
        "order[chapter]":
          "asc"
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

    all.push(
      ...batch
    );

    total =
      Number(
        json.total
      ) ||
      all.length;

    if (
      !batch.length
    ) {
      break;
    }

    offset += limit;
  }

  return all;
}

function chapterNumber(
  chapter
) {
  const value =
    chapter?.attributes
      ?.chapter;

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function chapterGroup(
  chapter
) {
  return (
    chapter?.relationships
      ?.find(
        (relationship) =>
          relationship.type ===
          "scanlation_group"
      )
      ?.attributes
      ?.name ||
    "MangaDex"
  );
}

function hostedChapter(
  chapter
) {
  return !chapter
    ?.attributes
    ?.externalUrl;
}

function dedupeChapters(
  chapters
) {
  const map =
    new Map();

  const specials = [];

  chapters
    .filter(
      hostedChapter
    )
    .forEach(
      (chapter) => {
        const number =
          chapterNumber(
            chapter
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

        const existing =
          map.get(key);

        if (!existing) {
          map.set(
            key,
            chapter
          );

          return;
        }

        const existingDate =
          new Date(
            existing
              ?.attributes
              ?.publishAt ||
            0
          ).getTime();

        const currentDate =
          new Date(
            chapter
              ?.attributes
              ?.publishAt ||
            0
          ).getTime();

        if (
          currentDate >
          existingDate
        ) {
          map.set(
            key,
            chapter
          );
        }
      }
    );

  const numbered =
    Array.from(
      map.values()
    )
      .sort(
        (a, b) =>
          Number(
            chapterNumber(a) ||
            0
          ) -
          Number(
            chapterNumber(b) ||
            0
          )
      );

  return [
    ...numbered,
    ...specials
  ];
}

function chapterLabel(
  chapter
) {
  const number =
    chapter?.attributes
      ?.chapter;

  const title =
    chapter?.attributes
      ?.title;

  if (
    number &&
    title
  ) {
    return `Chapter ${number} — ${title}`;
  }

  if (number) {
    return `Chapter ${number}`;
  }

  if (title) {
    return title;
  }

  return "Special Chapter";
}

function renderChapters(
  chapters
) {
  currentChapters =
    dedupeChapters(
      chapters
    );

  chapterListEl.innerHTML =
    "";

  chapterCountEl.textContent =
    `${currentChapters.length} readable ${
      currentChapters.length === 1
        ? "chapter"
        : "chapters"
    }`;

  if (
    !currentChapters.length
  ) {
    chapterListEl.innerHTML = `
      <p class="status-msg">
        No English chapters are currently readable through MangaDex for this title.
      </p>
    `;

    return;
  }

  const first =
    currentChapters[0];

  const readButton =
    document.getElementById(
      "readFirstButton"
    );

  if (readButton) {
    readButton.textContent =
      "Start Reading →";

    readButton.href =
      `reader.html?chapterId=${encodeURIComponent(
        first.id
      )}&mangaId=${encodeURIComponent(
        currentManga.id
      )}`;
  }

  currentChapters.forEach(
    (
      chapter,
      index
    ) => {
      const link =
        document.createElement(
          "a"
        );

      link.className =
        "chapter-row";

      link.href =
        `reader.html?chapterId=${encodeURIComponent(
          chapter.id
        )}&mangaId=${encodeURIComponent(
          currentManga.id
        )}`;

      link.innerHTML = `
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
              chapterLabel(
                chapter
              )
            )}
          </strong>

          <small>
            ${escapeHtml(
              chapterGroup(
                chapter
              )
            )}
          </small>

        </span>

        <span class="chapter-read">
          READ →
        </span>
      `;

      chapterListEl
        .appendChild(link);
    }
  );
}

async function init() {
  const id =
    getMangaId();

  if (!validId(id)) {
    detailEl.innerHTML = `
      <div class="error-screen">
        <div>
          <h1>Invalid series.</h1>
          <p>
            Panelly couldn't identify this manga.
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
      await fetchManga(id);

    renderDetail(manga);

    const [
      chapterResult,
      aniResult,
      jikanResult
    ] =
      await Promise.allSettled([
        fetchAllChapters(
          id
        ),
        fetchAniList(
          manga
        ),
        fetchJikan(
          manga
        )
      ]);

    if (
      chapterResult.status ===
      "fulfilled"
    ) {
      renderChapters(
        chapterResult.value
      );
    } else {
      console.error(
        chapterResult.reason
      );

      chapterCountEl.textContent =
        "Availability unavailable";

      chapterListEl.innerHTML = `
        <p class="status-msg">
          Panelly couldn't check chapters right now.
        </p>
      `;
    }

    renderEnrichment(
      aniResult.status ===
        "fulfilled"
        ? aniResult.value
        : null,
      jikanResult.status ===
        "fulfilled"
        ? jikanResult.value
        : null
    );
  } catch (error) {
    console.error(error);

    detailEl.innerHTML = `
      <div class="error-screen">
        <div>
          <h1>Series unavailable.</h1>
          <p>
            Panelly couldn't load this manga right now.
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

searchForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    const term =
      searchInput.value
        .trim();

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

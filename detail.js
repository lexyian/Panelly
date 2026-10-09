const CONTENT_RATING = [
  "safe",
  "suggestive"
];

const BOOKMARK_KEY =
  "panellyBookmarks";

const detailEl =
  document.getElementById("detail");

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
let actualChapters = [];
let chapterRows = [];

async function mangaDexFetch(path) {
  const response = await fetch(
    `/api/mangadex?path=${encodeURIComponent(
      path
    )}`
  );

  if (!response.ok) {
    throw new Error(
      `MangaDex failed: ${response.status}`
    );
  }

  return response;
}

function buildQuery(params) {
  const parts = [];

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return;
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
  );

  return parts.join("&");
}

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

function stripHtml(value) {
  if (!value) {
    return "";
  }

  const parser =
    new DOMParser();

  const doc =
    parser.parseFromString(
      value,
      "text/html"
    );

  return (
    doc.body.textContent || ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getMediaId() {
  const value =
    Number(
      new URLSearchParams(
        window.location.search
      ).get("id")
    );

  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return null;
  }

  return value;
}

function getTitle(manga) {
  return (
    manga?.title?.english ||
    manga?.title?.romaji ||
    manga?.title?.native ||
    "Untitled"
  );
}

function getDescription(manga) {
  return (
    stripHtml(
      manga?.description
    ) ||
    "No description available."
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

function getCreators(manga) {
  const edges =
    manga?.staff?.edges || [];

  const names =
    edges
      .filter((edge) => {
        const role =
          String(
            edge?.role || ""
          ).toLowerCase();

        return (
          role.includes("story") ||
          role.includes("art") ||
          role.includes("author") ||
          role.includes("manga")
        );
      })
      .map(
        (edge) =>
          edge?.node?.name?.full
      )
      .filter(Boolean);

  return (
    [...new Set(names)]
      .slice(0, 4)
      .join(", ") ||
    "Unknown creator"
  );
}

function getTags(manga) {
  const genres =
    Array.isArray(manga?.genres)
      ? manga.genres
      : [];

  const tags =
    Array.isArray(manga?.tags)
      ? manga.tags
          .filter(
            (tag) =>
              !tag.isAdult &&
              !tag.isGeneralSpoiler &&
              !tag.isMediaSpoiler &&
              Number(tag.rank) >= 60
          )
          .map(
            (tag) =>
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

function formatStatus(status) {
  return String(
    status || "unknown"
  )
    .replace(/_/g, " ")
    .toLowerCase();
}

async function fetchAniListDetail(id) {
  const response = await fetch(
    `/api/anilist?mode=detail&id=${encodeURIComponent(
      id
    )}`
  );

  if (!response.ok) {
    throw new Error(
      "AniList detail failed"
    );
  }

  const json =
    await response.json();

  return json.manga;
}

async function getCatalogCount(
  manga
) {
  const aniListCount =
    Number(manga?.chapters);

  if (
    Number.isInteger(
      aniListCount
    ) &&
    aniListCount > 0
  ) {
    return aniListCount;
  }

  if (!manga?.idMal) {
    return null;
  }

  try {
    const response = await fetch(
      `/api/jikan?idMal=${encodeURIComponent(
        manga.idMal
      )}`
    );

    if (!response.ok) {
      return null;
    }

    const json =
      await response.json();

    const count =
      Number(json.chapters);

    return (
      Number.isInteger(count) &&
      count > 0
    )
      ? count
      : null;
  } catch {
    return null;
  }
}

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

function getAniListTitles(manga) {
  return [
    manga?.title?.english,
    manga?.title?.romaji,
    manga?.title?.native,
    ...(manga?.synonyms || [])
  ]
    .filter(Boolean)
    .map(normalizeTitle);
}

function getDexTitles(manga) {
  const titles = [];

  Object.values(
    manga?.attributes?.title ||
    {}
  ).forEach((value) => {
    titles.push(value);
  });

  (
    manga?.attributes
      ?.altTitles || []
  ).forEach((entry) => {
    Object.values(
      entry
    ).forEach((value) => {
      titles.push(value);
    });
  });

  return titles
    .filter(Boolean)
    .map(normalizeTitle);
}

function scoreDexResult(
  candidate,
  manga
) {
  let score = 0;

  const links =
    candidate?.attributes
      ?.links || {};

  if (
    String(links.al || "") ===
    String(manga.id)
  ) {
    score += 2000;
  }

  if (
    manga.idMal &&
    String(links.mal || "") ===
      String(manga.idMal)
  ) {
    score += 1800;
  }

  const aniTitles =
    getAniListTitles(manga);

  const dexTitles =
    getDexTitles(candidate);

  aniTitles.forEach(
    (aniTitle) => {
      dexTitles.forEach(
        (dexTitle) => {
          if (
            aniTitle === dexTitle
          ) {
            score += 300;
          } else if (
            aniTitle.length > 5 &&
            dexTitle.length > 5 &&
            (
              aniTitle.includes(
                dexTitle
              ) ||
              dexTitle.includes(
                aniTitle
              )
            )
          ) {
            score += 75;
          }
        }
      );
    }
  );

  return score;
}

async function findMangaDexManga(
  manga
) {
  const titles = [
    manga?.title?.english,
    manga?.title?.romaji,
    ...(manga?.synonyms || [])
  ]
    .filter(Boolean)
    .slice(0, 4);

  const results =
    new Map();

  for (
    const title
    of titles
  ) {
    try {
      const query =
        buildQuery({
          title,
          limit: 20,
          contentRating:
            CONTENT_RATING
        });

      const response =
        await mangaDexFetch(
          `/manga?${query}`
        );

      const json =
        await response.json();

      (
        Array.isArray(json.data)
          ? json.data
          : []
      ).forEach(
        (item) => {
          results.set(
            item.id,
            item
          );
        }
      );
    } catch {}
  }

  const ranked =
    Array.from(
      results.values()
    )
      .map((item) => ({
        item,
        score:
          scoreDexResult(
            item,
            manga
          )
      }))
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  if (
    !ranked.length ||
    ranked[0].score < 200
  ) {
    return null;
  }

  return ranked[0].item;
}

async function fetchMangaDexChapters(
  mangaId
) {
  const chapters = [];

  let offset = 0;
  const limit = 500;
  let total = 0;

  do {
    const query =
      buildQuery({
        translatedLanguage: [
          "en"
        ],
        "order[chapter]":
          "asc",
        limit,
        offset,
        includes: [
          "scanlation_group"
        ],
        contentRating:
          CONTENT_RATING
      });

    const response =
      await mangaDexFetch(
        `/manga/${encodeURIComponent(
          mangaId
        )}/feed?${query}`
      );

    const json =
      await response.json();

    const batch =
      Array.isArray(json.data)
        ? json.data
        : [];

    chapters.push(
      ...batch
    );

    total =
      Number(json.total) ||
      chapters.length;

    if (!batch.length) {
      break;
    }

    offset += limit;
  } while (
    offset < total
  );

  return chapters;
}

function safeUrl(value) {
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

function chapterNumber(
  chapter
) {
  const value =
    Number(
      chapter?.attributes
        ?.chapter
    );

  return Number.isFinite(value)
    ? value
    : null;
}

function isHosted(chapter) {
  return !safeUrl(
    chapter?.attributes
      ?.externalUrl
  );
}

function chooseChapter(
  oldChapter,
  newChapter
) {
  if (!oldChapter) {
    return newChapter;
  }

  if (
    isHosted(newChapter) &&
    !isHosted(oldChapter)
  ) {
    return newChapter;
  }

  if (
    !oldChapter?.attributes
      ?.title &&
    newChapter?.attributes
      ?.title
  ) {
    return newChapter;
  }

  return oldChapter;
}

function makeChapterRows(
  chapters,
  catalogCount
) {
  const actual =
    new Map();

  chapters.forEach(
    (chapter) => {
      const number =
        chapterNumber(
          chapter
        );

      if (
        number === null
      ) {
        return;
      }

      const key =
        String(number);

      actual.set(
        key,
        chooseChapter(
          actual.get(key),
          chapter
        )
      );
    }
  );

  let highest = 0;

  actual.forEach(
    (chapter, key) => {
      const number =
        Number(key);

      if (
        number > highest
      ) {
        highest = number;
      }
    }
  );

  const total =
    Math.max(
      Number(
        catalogCount
      ) || 0,
      Math.floor(highest)
    );

  if (!total) {
    return Array.from(
      actual.entries()
    )
      .map(
        ([number, chapter]) => ({
          number:
            Number(number),
          chapter
        })
      )
      .sort(
        (a, b) =>
          a.number -
          b.number
      );
  }

  const rows = [];

  for (
    let number = 1;
    number <= total;
    number += 1
  ) {
    rows.push({
      number,
      chapter:
        actual.get(
          String(number)
        ) || null
    });
  }

  actual.forEach(
    (chapter, key) => {
      const number =
        Number(key);

      if (number > total) {
        rows.push({
          number,
          chapter
        });
      }
    }
  );

  rows.sort(
    (a, b) =>
      a.number -
      b.number
  );

  return rows;
}

function getOfficialLink(manga) {
  const links =
    (
      manga?.externalLinks ||
      []
    ).filter(
      (link) =>
        link?.url &&
        !link.isDisabled
    );

  const preferred = [
    "MANGA Plus",
    "VIZ",
    "WEBTOON",
    "Tapas",
    "Pocket Comics",
    "Tappytoon",
    "Lezhin",
    "Comikey",
    "Azuki",
    "K MANGA"
  ];

  for (
    const name
    of preferred
  ) {
    const found =
      links.find(
        (link) =>
          String(
            link.site || ""
          )
            .toLowerCase()
            .includes(
              name.toLowerCase()
            )
      );

    if (found) {
      return found;
    }
  }

  return null;
}

function readBookmarks() {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(
          BOOKMARK_KEY
        ) || "[]"
      );

    return Array.isArray(value)
      ? value
      : [];
  } catch {
    return [];
  }
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
    readBookmarks().some(
      (item) =>
        Number(
          item.anilistId ??
          item.mediaId ??
          item.id
        ) ===
        Number(
          currentManga.id
        )
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

function toggleBookmark() {
  if (!currentManga) {
    return;
  }

  const bookmarks =
    readBookmarks();

  const index =
    bookmarks.findIndex(
      (item) =>
        Number(
          item.anilistId ??
          item.mediaId ??
          item.id
        ) ===
        Number(
          currentManga.id
        )
    );

  if (index !== -1) {
    bookmarks.splice(
      index,
      1
    );
  } else {
    bookmarks.unshift({
      anilistId:
        currentManga.id,
      mediaId:
        currentManga.id,
      title:
        getTitle(
          currentManga
        ),
      mangaTitle:
        getTitle(
          currentManga
        ),
      coverUrl:
        getCover(
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

  updateBookmarkButton();
}

function renderDetail(manga) {
  currentManga = manga;

  const title =
    getTitle(manga);

  const description =
    getDescription(manga);

  const cover =
    getCover(manga);

  const creators =
    getCreators(manga);

  const tags =
    getTags(manga);

  const year =
    manga?.startDate?.year;

  const status =
    formatStatus(
      manga?.status
    );

  detailEl.innerHTML = `
    <div class="series-cover-panel">

      ${
        cover
          ? `<img
              class="detail-cover series-cover"
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

    <div class="detail-info series-info">

      <div class="series-topline">

        <span class="status-pill series-status">
          ${escapeHtml(
            status
          )}
        </span>

        ${
          year
            ? `<span class="series-year">
                ${year}
              </span>`
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
          .slice(0, 12)
          .map(
            (tag) =>
              `<span class="tag">${escapeHtml(
                tag
              )}</span>`
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
          + Add to My Shelf
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

function chapterLabel(
  row
) {
  const title =
    row.chapter
      ?.attributes
      ?.title;

  return title
    ? `Chapter ${row.number} — ${title}`
    : `Chapter ${row.number}`;
}

function getGroupName(
  chapter
) {
  const group =
    chapter?.relationships
      ?.find(
        (item) =>
          item.type ===
          "scanlation_group"
      );

  return (
    group?.attributes?.name ||
    "Community release"
  );
}

function createChapterRow(
  row,
  index
) {
  const official =
    getOfficialLink(
      currentManga
    );

  const chapter =
    row.chapter;

  const external =
    safeUrl(
      chapter?.attributes
        ?.externalUrl
    );

  let element;

  if (
    chapter &&
    !external
  ) {
    element =
      document.createElement(
        "a"
      );

    element.href =
      `reader.html?chapterId=${encodeURIComponent(
        chapter.id
      )}&mediaId=${encodeURIComponent(
        currentManga.id
      )}`;
  } else if (
    external ||
    official
  ) {
    element =
      document.createElement(
        "a"
      );

    element.href =
      external ||
      official.url;

    element.target =
      "_blank";

    element.rel =
      "noopener noreferrer";
  } else {
    element =
      document.createElement(
        "div"
      );
  }

  element.className =
    "chapter-row chapter-card-new";

  let source =
    "Not hosted in Panelly";

  let action =
    "UNAVAILABLE";

  if (
    chapter &&
    !external
  ) {
    source =
      getGroupName(
        chapter
      );

    action =
      "READ →";
  } else if (
    external ||
    official
  ) {
    source =
      official?.site ||
      "Official release";

    action =
      "OFFICIAL ↗";
  }

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
          chapterLabel(row)
        )}
      </strong>

      <small class="chapter-group">
        ${escapeHtml(
          source
        )}
      </small>

    </span>

    <span class="chapter-read">
      ${action}
    </span>
  `;

  return element;
}

function renderChapters() {
  chapterListEl.innerHTML =
    "";

  const readable =
    chapterRows.filter(
      (row) =>
        row.chapter &&
        isHosted(
          row.chapter
        )
    );

  if (chapterCountEl) {
    chapterCountEl.textContent =
      `${chapterRows.length} known · ${readable.length} readable`;
  }

  const readButton =
    document.getElementById(
      "readNowBtn"
    );

  if (readButton) {
    if (readable.length) {
      const first =
        readable[0].chapter;

      readButton.href =
        `reader.html?chapterId=${encodeURIComponent(
          first.id
        )}&mediaId=${encodeURIComponent(
          currentManga.id
        )}`;

      readButton.textContent =
        "Start Reading →";

      readButton.classList.remove(
        "disabled"
      );
    } else {
      const official =
        getOfficialLink(
          currentManga
        );

      if (official) {
        readButton.href =
          official.url;

        readButton.target =
          "_blank";

        readButton.rel =
          "noopener noreferrer";

        readButton.textContent =
          "Read Officially ↗";

        readButton.classList.remove(
          "disabled"
        );
      } else {
        readButton.textContent =
          "No Reader Available";
      }
    }
  }

  if (!chapterRows.length) {
    chapterListEl.innerHTML = `
      <p class="status-msg">
        No chapter information available.
      </p>
    `;

    return;
  }

  const fragment =
    document.createDocumentFragment();

  chapterRows.forEach(
    (row, index) => {
      fragment.appendChild(
        createChapterRow(
          row,
          index
        )
      );
    }
  );

  chapterListEl.appendChild(
    fragment
  );
}

async function init() {
  const id =
    getMediaId();

  if (!id) {
    detailEl.innerHTML = `
      <p class="status-msg">
        Invalid manga.
      </p>
    `;

    return;
  }

  try {
    const manga =
      await fetchAniListDetail(
        id
      );

    renderDetail(manga);

    const [
      count,
      dexManga
    ] =
      await Promise.all([
        getCatalogCount(
          manga
        ),
        findMangaDexManga(
          manga
        )
      ]);

    if (dexManga) {
      try {
        actualChapters =
          await fetchMangaDexChapters(
            dexManga.id
          );
      } catch {
        actualChapters =
          [];
      }
    }

    chapterRows =
      makeChapterRows(
        actualChapters,
        count
      );

    renderChapters();
  } catch (error) {
    console.error(error);

    detailEl.innerHTML = `
      <p class="status-msg">
        Couldn't load this manga.
      </p>
    `;

    chapterListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load chapter information.
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

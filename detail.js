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
let knownChapterCount = null;

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

function getMediaId() {
  const value =
    Number(
      new URLSearchParams(
        window.location.search
      ).get("id")
    );

  return (
    Number.isInteger(value) &&
    value > 0
  )
    ? value
    : null;
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
    manga?.coverImage
      ?.extraLarge ||
    manga?.coverImage?.large ||
    manga?.coverImage?.medium ||
    ""
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

function getCreators(manga) {
  const edges =
    manga?.staff?.edges || [];

  const preferred =
    edges.filter((edge) => {
      const role =
        String(
          edge?.role || ""
        ).toLowerCase();

      return (
        role.includes("story") ||
        role.includes("art") ||
        role.includes("author") ||
        role.includes("manga") ||
        role.includes("illustration")
      );
    });

  const source =
    preferred.length
      ? preferred
      : edges;

  const names =
    source
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

function formatStatus(value) {
  return String(
    value || "unknown"
  )
    .replace(/_/g, " ")
    .toUpperCase();
}

async function fetchAniListDetail(id) {
  const response = await fetch(
    `/api/anilist?mode=detail&id=${encodeURIComponent(
      id
    )}`
  );

  if (!response.ok) {
    throw new Error(
      "Couldn't load series information"
    );
  }

  const json =
    await response.json();

  return json.manga;
}

async function getCatalogCount(
  manga
) {
  const aniList =
    Number(manga?.chapters);

  if (
    Number.isInteger(aniList) &&
    aniList > 0
  ) {
    return aniList;
  }

  if (!manga?.idMal) {
    return null;
  }

  try {
    const response =
      await fetch(
        `/api/jikan?idMal=${encodeURIComponent(
          manga.idMal
        )}`
      );

    if (!response.ok) {
      return null;
    }

    const json =
      await response.json();

    const chapters =
      Number(json.chapters);

    return (
      Number.isInteger(
        chapters
      ) &&
      chapters > 0
    )
      ? chapters
      : null;
  } catch {
    return null;
  }
}

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
  ).forEach((item) => {
    Object.values(
      item
    ).forEach((value) => {
      titles.push(value);
    });
  });

  return titles
    .filter(Boolean)
    .map(normalizeTitle);
}

function scoreCandidate(
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

  const aniYear =
    Number(
      manga?.startDate?.year
    );

  const dexYear =
    Number(
      candidate?.attributes?.year
    );

  if (
    aniYear &&
    dexYear
  ) {
    if (
      aniYear === dexYear
    ) {
      score += 40;
    } else if (
      Math.abs(
        aniYear -
        dexYear
      ) === 1
    ) {
      score += 10;
    }
  }

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
      ).forEach((item) => {
        results.set(
          item.id,
          item
        );
      });
    } catch {}
  }

  const ranked =
    Array.from(
      results.values()
    )
      .map((item) => ({
        item,
        score:
          scoreCandidate(
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
  let total = 0;

  const limit = 500;

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

    chapters.push(...batch);

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
    const url = new URL(value);

    if (
      url.protocol === "https:" ||
      url.protocol === "http:"
    ) {
      return url.toString();
    }
  } catch {}

  return null;
}

function getChapterNumber(
  chapter
) {
  const raw =
    chapter?.attributes?.chapter;

  if (
    raw === null ||
    raw === undefined ||
    raw === ""
  ) {
    return null;
  }

  const number =
    Number(raw);

  return Number.isFinite(number)
    ? number
    : null;
}

function isHosted(chapter) {
  return !safeUrl(
    chapter?.attributes
      ?.externalUrl
  );
}

function chooseBest(
  existing,
  incoming
) {
  if (!existing) {
    return incoming;
  }

  if (
    isHosted(incoming) &&
    !isHosted(existing)
  ) {
    return incoming;
  }

  if (
    isHosted(existing) &&
    !isHosted(incoming)
  ) {
    return existing;
  }

  return existing;
}

function getBestChapters(
  chapters
) {
  const numbered =
    new Map();

  const specials = [];

  chapters.forEach(
    (chapter) => {
      const number =
        getChapterNumber(
          chapter
        );

      if (number === null) {
        specials.push(chapter);
        return;
      }

      const key =
        String(number);

      numbered.set(
        key,
        chooseBest(
          numbered.get(key),
          chapter
        )
      );
    }
  );

  const rows =
    Array.from(
      numbered.entries()
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

  specials.forEach(
    (chapter) => {
      rows.push({
        number: null,
        chapter
      });
    }
  );

  return rows;
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

  const exists =
    readBookmarks().some(
      (item) =>
        Number(
          item.anilistId ??
          item.mediaId ??
          item.id
        ) ===
        Number(currentManga.id)
    );

  button.textContent =
    exists
      ? "✓ SAVED TO PANEL SHELF"
      : "+ ADD TO PANEL SHELF";

  button.classList.toggle(
    "saved",
    exists
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
        Number(currentManga.id)
    );

  if (index >= 0) {
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

  const cover =
    getCover(manga);

  const description =
    getDescription(manga);

  const creators =
    getCreators(manga);

  const tags =
    getTags(manga);

  const status =
    formatStatus(
      manga.status
    );

  const year =
    manga?.startDate?.year;

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
              fetchpriority="high"
            >`
          : `<div class="series-cover-placeholder">
              NO COVER
            </div>`
      }

      <span class="series-file-label">
        SERIES FILE #${escapeHtml(
          manga.id
        )}
      </span>

    </div>

    <div class="series-info">

      <div class="series-topline">

        <span class="status-pill">
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

      <h1 class="series-title">
        ${escapeHtml(title)}
      </h1>

      <p class="series-creator">
        ${escapeHtml(creators)}
      </p>

      <div class="series-tags">

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

      <p class="series-description">
        ${escapeHtml(description)}
      </p>

      <div class="series-actions">

        <a
          class="series-read-btn disabled"
          id="readNowBtn"
        >
          CHECKING CHAPTERS...
        </a>

        <button
          class="series-shelf-btn"
          id="bookmarkBtn"
          type="button"
        >
          + ADD TO PANEL SHELF
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

function getGroupName(chapter) {
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

function getExternalName(value) {
  try {
    const host =
      new URL(value)
        .hostname
        .replace(
          /^www\./,
          ""
        );

    if (
      host.includes("mangaplus")
    ) {
      return "MANGA Plus";
    }

    if (
      host.includes("viz.com")
    ) {
      return "VIZ";
    }

    if (
      host.includes("webtoons")
    ) {
      return "WEBTOON";
    }

    if (
      host.includes("tapas")
    ) {
      return "Tapas";
    }

    if (
      host.includes("tappytoon")
    ) {
      return "Tappytoon";
    }

    if (
      host.includes("lezhin")
    ) {
      return "Lezhin";
    }

    if (
      host.includes("comikey")
    ) {
      return "Comikey";
    }

    return host;
  } catch {
    return "Official release";
  }
}

function getChapterLabel(row) {
  const chapter =
    row.chapter;

  const number =
    chapter?.attributes?.chapter;

  const title =
    chapter?.attributes?.title;

  let label =
    number
      ? `Chapter ${number}`
      : "Special";

  if (title) {
    label += ` — ${title}`;
  }

  return label;
}

function updateKnownCount() {
  const highest =
    currentChapters.reduce(
      (max, row) => {
        if (
          Number.isFinite(
            row.number
          )
        ) {
          return Math.max(
            max,
            Math.floor(
              row.number
            )
          );
        }

        return max;
      },
      0
    );

  knownChapterCount =
    Math.max(
      Number(
        knownChapterCount
      ) || 0,
      highest
    );
}

function renderChapterCount() {
  updateKnownCount();

  const hosted =
    currentChapters.filter(
      (row) =>
        isHosted(
          row.chapter
        )
    ).length;

  const external =
    currentChapters.filter(
      (row) =>
        Boolean(
          safeUrl(
            row.chapter
              ?.attributes
              ?.externalUrl
          )
        )
    ).length;

  const pieces = [];

  pieces.push(
    `${hosted} READABLE`
  );

  if (external) {
    pieces.push(
      `${external} OFFICIAL`
    );
  }

  if (
    knownChapterCount
  ) {
    pieces.push(
      `${knownChapterCount} KNOWN`
    );
  }

  chapterCountEl.textContent =
    pieces.join(" / ");
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
    currentChapters.find(
      (row) =>
        isHosted(
          row.chapter
        )
    );

  if (hosted) {
    button.href =
      `reader.html?chapterId=${encodeURIComponent(
        hosted.chapter.id
      )}&mediaId=${encodeURIComponent(
        currentManga.id
      )}`;

    button.textContent =
      "START READING →";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  const external =
    currentChapters.find(
      (row) =>
        safeUrl(
          row.chapter
            ?.attributes
            ?.externalUrl
        )
    );

  const externalUrl =
    safeUrl(
      external?.chapter
        ?.attributes
        ?.externalUrl
    );

  if (externalUrl) {
    button.href = externalUrl;

    button.target =
      "_blank";

    button.rel =
      "noopener noreferrer";

    button.textContent =
      "READ OFFICIAL RELEASE ↗";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  button.textContent =
    "NO READER AVAILABLE";
}

function createChapterRow(
  row,
  index
) {
  const externalUrl =
    safeUrl(
      row.chapter
        ?.attributes
        ?.externalUrl
    );

  const element =
    document.createElement(
      "a"
    );

  element.className =
    "chapter-card-new";

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
        row.chapter.id
      )}&mediaId=${encodeURIComponent(
        currentManga.id
      )}`;
  }

  const source =
    externalUrl
      ? getExternalName(
          externalUrl
        )
      : getGroupName(
          row.chapter
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
          getChapterLabel(row)
        )}
      </strong>

      <small class="chapter-group">
        ${escapeHtml(source)}
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

  return element;
}

function renderChapters() {
  chapterListEl.innerHTML = "";

  renderChapterCount();
  updateReadButton();

  if (!currentChapters.length) {
    chapterListEl.innerHTML = `
      <div class="status-msg">
        No chapter pages are currently available through Panelly's reader providers.
      </div>
    `;

    return;
  }

  const fragment =
    document.createDocumentFragment();

  currentChapters.forEach(
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
      <div class="status-msg">
        Invalid series.
      </div>
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
      mangaDexManga
    ] =
      await Promise.all([
        getCatalogCount(
          manga
        ),
        findMangaDexManga(
          manga
        )
      ]);

    knownChapterCount =
      count;

    let chapters = [];

    if (mangaDexManga) {
      try {
        chapters =
          await fetchMangaDexChapters(
            mangaDexManga.id
          );
      } catch {
        chapters = [];
      }
    }

    currentChapters =
      getBestChapters(
        chapters
      );

    renderChapters();
  } catch (error) {
    console.error(error);

    detailEl.innerHTML = `
      <div class="status-msg">
        Couldn't open this series file.
      </div>
    `;

    chapterListEl.innerHTML = `
      <div class="status-msg">
        Couldn't load chapter information.
      </div>
    `;
  }
}

searchForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    const value =
      searchInput.value.trim();

    if (!value) {
      return;
    }

    window.location.href =
      `index.html?search=${encodeURIComponent(
        value
      )}`;
  }
);

init();

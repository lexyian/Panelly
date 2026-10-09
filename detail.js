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
let currentChapters = [];
let catalogChapterCount = null;

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
  const id =
    Number(
      new URLSearchParams(
        window.location.search
      ).get("id")
    );

  return (
    Number.isInteger(id) &&
    id > 0
  )
    ? id
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

  const useful =
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
    useful.length
      ? useful
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
    .map(normalizeTitle)
    .filter(Boolean);
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

function getChapterNumber(
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

function chooseBetterChapter(
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

  const existingTitle =
    existing?.attributes?.title;

  const incomingTitle =
    incoming?.attributes?.title;

  if (
    !existingTitle &&
    incomingTitle
  ) {
    return incoming;
  }

  return existing;
}

function getBestRealChapters(
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
        chooseBetterChapter(
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

function getOfficialSeriesLink(
  manga
) {
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
    "K MANGA",
    "Manga UP!"
  ];

  for (
    const name
    of preferred
  ) {
    const link =
      links.find(
        (item) =>
          String(
            item.site || ""
          )
            .toLowerCase()
            .includes(
              name.toLowerCase()
            )
      );

    if (link) {
      return link;
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

function getChapterLabel(
  row
) {
  const chapter =
    row.chapter;

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

function getExternalName(
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

    return "Official site";
  } catch {
    return "Official site";
  }
}

function updateChapterCount() {
  if (!chapterCountEl) {
    return;
  }

  const hosted =
    currentChapters.filter(
      (row) =>
        isHosted(
          row.chapter
        )
    ).length;

  const official =
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
    `${hosted} readable`
  );

  if (official) {
    pieces.push(
      `${official} official`
    );
  }

  if (
    catalogChapterCount &&
    catalogChapterCount >
      currentChapters.length
  ) {
    pieces.push(
      `${catalogChapterCount} known`
    );
  }

  chapterCountEl.textContent =
    pieces.join(" · ");
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
      "Read Officially ↗";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  const officialSeries =
    getOfficialSeriesLink(
      currentManga
    );

  if (officialSeries) {
    button.href =
      officialSeries.url;

    button.target =
      "_blank";

    button.rel =
      "noopener noreferrer";

    button.textContent =
      "Official Series ↗";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  button.removeAttribute(
    "href"
  );

  button.textContent =
    "No Reader Available";

  button.classList.add(
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
    safeUrl(
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
            row
          )
        )}
      </strong>

      <small class="chapter-group">
        ${escapeHtml(
          source
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

  return element;
}

function renderChapters() {
  chapterListEl.innerHTML =
    "";

  updateChapterCount();
  updateReadButton();

  if (!currentChapters.length) {
    const official =
      getOfficialSeriesLink(
        currentManga
      );

    chapterListEl.innerHTML = `
      <div class="status-msg">

        <p>
          No chapter pages are currently available through Panelly's reader providers.
        </p>

        ${
          official
            ? `<p>
                <a
                  class="hero-cta"
                  href="${escapeHtml(
                    official.url
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open ${escapeHtml(
                    official.site
                  )} ↗
                </a>
              </p>`
            : ""
        }

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

    catalogChapterCount =
      count;

    let chapters = [];

    if (dexManga) {
      try {
        chapters =
          await fetchMangaDexChapters(
            dexManga.id
          );
      } catch {
        chapters = [];
      }
    }

    currentChapters =
      getBestRealChapters(
        chapters
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

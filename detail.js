const CONTENT_RATING = ["safe", "suggestive"];
const BOOKMARK_KEY = "panellyBookmarks";

const detailEl = document.getElementById("detail");
const chapterListEl = document.getElementById("chapterList");
const chapterCountEl = document.getElementById("chapterCount");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

let currentManga = null;
let currentChapters = [];
let catalogChapterCount = null;

async function apiFetch(pathAndQuery) {
  const response = await fetch(
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

  const doc =
    parser.parseFromString(
      value,
      "text/html"
    );

  return (
    doc.body.textContent ||
    ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function getMediaId() {
  const raw =
    new URLSearchParams(
      window.location.search
    ).get("id");

  const id =
    Number(raw);

  return Number.isInteger(id) &&
    id > 0
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

function getDescription(
  manga
) {
  return (
    stripText(
      manga?.description
    ) ||
    "No description available."
  );
}

function getCoverUrl(
  manga
) {
  return (
    manga?.coverImage?.extraLarge ||
    manga?.coverImage?.large ||
    manga?.coverImage?.medium ||
    ""
  );
}

function getCreators(
  manga
) {
  const edges =
    manga?.staff?.edges ||
    [];

  const important =
    edges.filter(
      (edge) => {
        const role =
          String(
            edge?.role ||
            ""
          ).toLowerCase();

        return (
          role.includes(
            "story"
          ) ||
          role.includes(
            "art"
          ) ||
          role.includes(
            "manga"
          )
        );
      }
    );

  const source =
    important.length
      ? important
      : edges;

  const names =
    source
      .map(
        (edge) =>
          edge?.node
            ?.name?.full
      )
      .filter(Boolean);

  return (
    [...new Set(names)]
      .slice(
        0,
        4
      )
      .join(", ") ||
    "Unknown creator"
  );
}

function getTags(manga) {
  const genres =
    Array.isArray(
      manga?.genres
    )
      ? manga.genres
      : [];

  const tags =
    Array.isArray(
      manga?.tags
    )
      ? manga.tags
          .filter(
            (tag) =>
              !tag.isAdult &&
              !tag.isGeneralSpoiler &&
              !tag.isMediaSpoiler &&
              Number(
                tag.rank
              ) >= 60
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
  if (!value) {
    return "unknown";
  }

  return String(value)
    .replace(
      /_/g,
      " "
    )
    .toLowerCase();
}

async function fetchAniListDetail(
  id
) {
  const response =
    await fetch(
      `/api/anilist?mode=detail&id=${encodeURIComponent(
        id
      )}`
    );

  if (!response.ok) {
    throw new Error(
      "Couldn't load AniList manga"
    );
  }

  const json =
    await response.json();

  return json.manga;
}

async function fetchJikanCount(
  manga
) {
  if (
    Number(
      manga?.chapters
    ) > 0
  ) {
    return Number(
      manga.chapters
    );
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

    return (
      Number(
        json.chapters
      ) ||
      null
    );
  } catch {
    return null;
  }
}

function normalizeTitle(value) {
  return String(
    value || ""
  )
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

function getAniListTitles(
  manga
) {
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

function getMangaDexTitles(
  manga
) {
  const values = [];

  Object.values(
    manga?.attributes?.title ||
      {}
  ).forEach(
    (value) =>
      values.push(value)
  );

  (
    manga?.attributes
      ?.altTitles ||
    []
  ).forEach(
    (titleObject) => {
      Object.values(
        titleObject
      ).forEach(
        (value) =>
          values.push(
            value
          )
      );
    }
  );

  return values
    .filter(Boolean)
    .map(normalizeTitle);
}

function scoreMangaDexMatch(
  candidate,
  manga
) {
  let score = 0;

  const links =
    candidate
      ?.attributes
      ?.links || {};

  if (
    String(
      links.al ||
      ""
    ) ===
    String(
      manga.id
    )
  ) {
    score += 1000;
  }

  if (
    manga.idMal &&
    String(
      links.mal ||
      ""
    ) ===
      String(
        manga.idMal
      )
  ) {
    score += 900;
  }

  const aniTitles =
    getAniListTitles(
      manga
    );

  const dexTitles =
    getMangaDexTitles(
      candidate
    );

  aniTitles.forEach(
    (aniTitle) => {
      dexTitles.forEach(
        (dexTitle) => {
          if (
            aniTitle ===
            dexTitle
          ) {
            score += 250;
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
            score += 70;
          }
        }
      );
    }
  );

  const aniYear =
    Number(
      manga?.startDate
        ?.year
    );

  const dexYear =
    Number(
      candidate
        ?.attributes
        ?.year
    );

  if (
    aniYear &&
    dexYear
  ) {
    const difference =
      Math.abs(
        aniYear -
        dexYear
      );

    if (
      difference === 0
    ) {
      score += 30;
    } else if (
      difference === 1
    ) {
      score += 10;
    }
  }

  return score;
}

async function searchMangaDex(
  manga
) {
  const rawTitles = [
    manga?.title?.english,
    manga?.title?.romaji
  ].filter(Boolean);

  const titles = [
    ...new Set(
      rawTitles
    )
  ].slice(
    0,
    2
  );

  const candidates =
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
        await apiFetch(
          `/manga?${query}`
        );

      const json =
        await response.json();

      (
        Array.isArray(
          json.data
        )
          ? json.data
          : []
      ).forEach(
        (candidate) => {
          candidates.set(
            candidate.id,
            candidate
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        error
      );
    }
  }

  const ranked =
    Array.from(
      candidates.values()
    )
      .map(
        (candidate) => ({
          candidate,
          score:
            scoreMangaDexMatch(
              candidate,
              manga
            )
        })
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  if (
    !ranked.length ||
    ranked[0].score <
      180
  ) {
    return null;
  }

  return ranked[0]
    .candidate;
}

async function fetchMangaDexChapters(
  mangaId
) {
  const all = [];

  const limit = 500;

  let offset = 0;
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
  } while (
    offset < total
  );

  return all;
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

function getChapterKey(
  chapter
) {
  const number =
    chapter
      ?.attributes
      ?.chapter;

  if (
    number === null ||
    number === undefined ||
    number === ""
  ) {
    return `special-${chapter.id}`;
  }

  return `chapter-${number}`;
}

function chapterSortValue(
  chapter
) {
  const value =
    parseFloat(
      chapter
        ?.attributes
        ?.chapter
    );

  return Number.isFinite(
    value
  )
    ? value
    : Number.MAX_SAFE_INTEGER;
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
            existing
              ?.attributes
              ?.externalUrl
          )
        );

      const currentExternal =
        Boolean(
          safeExternalUrl(
            chapter
              ?.attributes
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
          currentExternal &&
        !existing
          ?.attributes
          ?.title &&
        chapter
          ?.attributes
          ?.title
      ) {
        map.set(
          key,
          chapter
        );
      }
    }
  );

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      chapterSortValue(
        a
      ) -
      chapterSortValue(
        b
      )
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

  return readBookmarks().some(
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

  if (
    index !== -1
  ) {
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
        getCoverUrl(
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

  if (!button) {
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

function getPreferredOfficialLink(
  manga
) {
  const links =
    (
      manga?.externalLinks ||
      []
    ).filter(
      (link) =>
        link?.url &&
        !link?.isDisabled
    );

  const preferred = [
    "MANGA Plus",
    "VIZ",
    "WEBTOON",
    "Tapas",
    "Pocket Comics",
    "Tappytoon",
    "Comikey",
    "Azuki",
    "Manga UP!",
    "K MANGA"
  ];

  for (
    const site
    of preferred
  ) {
    const link =
      links.find(
        (entry) =>
          String(
            entry.site
          )
            .toLowerCase() ===
          site.toLowerCase()
      );

    if (link) {
      return link;
    }
  }

  return (
    links.find(
      (link) =>
        link.type ===
        "MANGA"
    ) ||
    links[0] ||
    null
  );
}

function renderDetail(
  manga
) {
  currentManga = manga;

  const title =
    getTitle(manga);

  const cover =
    getCoverUrl(manga);

  const description =
    getDescription(
      manga
    );

  const creators =
    getCreators(
      manga
    );

  const tags =
    getTags(manga);

  const status =
    formatStatus(
      manga.status
    );

  const year =
    manga
      ?.startDate
      ?.year;

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
            ? `<span class="series-year">${escapeHtml(
                year
              )}</span>`
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
          Checking availability...
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
  chapter
) {
  const number =
    chapter
      ?.attributes
      ?.chapter;

  const title =
    chapter
      ?.attributes
      ?.title;

  let text =
    number
      ? `Chapter ${number}`
      : "Special";

  if (title) {
    text +=
      ` — ${title}`;
  }

  return text;
}

function getGroupName(
  chapter
) {
  const group =
    chapter.relationships
      ?.find(
        (relationship) =>
          relationship.type ===
          "scanlation_group"
      );

  return (
    group
      ?.attributes
      ?.name ||
    "Community release"
  );
}

function getExternalName(
  url
) {
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
        "pocketcomics"
      )
    ) {
      return "Pocket Comics";
    }

    return "Official site";
  } catch {
    return "Official site";
  }
}

function updateCount() {
  if (!chapterCountEl) {
    return;
  }

  const listed =
    currentChapters.length;

  if (
    catalogChapterCount
  ) {
    chapterCountEl.textContent =
      `${listed} available · ${catalogChapterCount} catalog`;
  } else {
    chapterCountEl.textContent =
      `${listed} available chapters`;
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
    currentChapters.find(
      (chapter) =>
        !safeExternalUrl(
          chapter
            ?.attributes
            ?.externalUrl
        )
    );

  if (hosted) {
    button.href =
      `reader.html?chapterId=${encodeURIComponent(
        hosted.id
      )}&mediaId=${encodeURIComponent(
        currentManga.id
      )}`;

    button.textContent =
      "Start Reading →";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  const externalChapter =
    currentChapters.find(
      (chapter) =>
        safeExternalUrl(
          chapter
            ?.attributes
            ?.externalUrl
        )
    );

  const chapterUrl =
    safeExternalUrl(
      externalChapter
        ?.attributes
        ?.externalUrl
    );

  const official =
    getPreferredOfficialLink(
      currentManga
    );

  const url =
    chapterUrl ||
    official?.url;

  if (url) {
    button.href =
      url;

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

  button.removeAttribute(
    "href"
  );

  button.textContent =
    "No Reader Available";

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

  updateCount();
  updateReadButton();

  if (
    !currentChapters.length
  ) {
    const official =
      getPreferredOfficialLink(
        currentManga
      );

    chapterListEl.innerHTML = `
      <p class="status-msg">
        No chapters are currently hosted for reading inside Panelly.
        ${
          official
            ? ` Official reading is available through ${escapeHtml(
                official.site
              )}.`
            : ""
        }
      </p>
    `;

    return;
  }

  currentChapters.forEach(
    (
      chapter,
      index
    ) => {
      const externalUrl =
        safeExternalUrl(
          chapter
            ?.attributes
            ?.externalUrl
        );

      const row =
        document.createElement(
          "a"
        );

      row.className =
        "chapter-row chapter-card-new";

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

      row.innerHTML = `
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
                chapter
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

      chapterListEl.appendChild(
        row
      );
    }
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

    renderDetail(
      manga
    );

    const countPromise =
      fetchJikanCount(
        manga
      );

    const mangaDexPromise =
      searchMangaDex(
        manga
      );

    catalogChapterCount =
      await countPromise;

    updateCount();

    const mangaDex =
      await mangaDexPromise;

    if (!mangaDex) {
      currentChapters =
        [];

      renderChapters(
        []
      );

      return;
    }

    const chapters =
      await fetchMangaDexChapters(
        mangaDex.id
      );

    renderChapters(
      chapters
    );
  } catch (error) {
    console.error(
      error
    );

    detailEl.innerHTML = `
      <p class="status-msg">
        Couldn't load this manga.
      </p>
    `;

    chapterListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load chapter availability.
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

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
let currentMangaDex = null;
let internalChapters = [];
let externalChapterLinks = [];
let renderedChapterCount = 0;
let chapterObserver = null;

const CHAPTER_BATCH_SIZE =
  100;

function escapeHtml(value) {
  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    character =>
      ({
        "&":
          "&amp;",
        "<":
          "&lt;",
        ">":
          "&gt;",
        '"':
          "&quot;",
        "'":
          "&#039;"
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

function getMediaId() {
  const raw =
    new URLSearchParams(
      window.location.search
    ).get(
      "id"
    );

  const id =
    Number(
      raw
    );

  return (
    Number.isInteger(
      id
    ) &&
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
    manga?.coverImage
      ?.extraLarge ||
    manga?.coverImage
      ?.large ||
    manga?.coverImage
      ?.medium ||
    ""
  );
}

function getCreators(
  manga
) {
  const edges =
    manga?.staff?.edges ||
    [];

  const useful =
    edges.filter(
      edge => {
        const role =
          String(
            edge?.role ||
            ""
          )
            .toLowerCase();

        return (
          role.includes(
            "story"
          ) ||
          role.includes(
            "art"
          ) ||
          role.includes(
            "manga"
          ) ||
          role.includes(
            "author"
          ) ||
          role.includes(
            "illustration"
          )
        );
      }
    );

  const source =
    useful.length
      ? useful
      : edges;

  const names =
    source
      .map(
        edge =>
          edge?.node
            ?.name?.full
      )
      .filter(
        Boolean
      );

  return (
    [
      ...new Set(
        names
      )
    ]
      .slice(
        0,
        4
      )
      .join(
        ", "
      ) ||
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
            tag =>
              !tag.isAdult &&
              !tag.isGeneralSpoiler &&
              !tag.isMediaSpoiler &&
              Number(
                tag.rank ||
                0
              ) >= 60
          )
          .map(
            tag =>
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
    value ||
    "unknown"
  )
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
      "Couldn't load manga information"
    );
  }

  const json =
    await response.json();

  return json.manga;
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
      value ===
        undefined ||
      value ===
        null ||
      value ===
        ""
    ) {
      continue;
    }

    if (
      Array.isArray(
        value
      )
    ) {
      value.forEach(
        item =>
          parts.push(
            `${key}[]=${encodeURIComponent(
              item
            )}`
          )
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

function normalizeTitle(value) {
  return String(
    value ||
    ""
  )
    .normalize(
      "NFKD"
    )
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
    ...(
      manga?.synonyms ||
      []
    )
  ]
    .filter(
      Boolean
    )
    .map(
      normalizeTitle
    )
    .filter(
      Boolean
    );
}

function getMangaDexTitles(
  manga
) {
  const titles = [];

  Object.values(
    manga?.attributes
      ?.title ||
    {}
  ).forEach(
    value =>
      titles.push(
        value
      )
  );

  (
    manga?.attributes
      ?.altTitles ||
    []
  ).forEach(
    titleObject => {
      Object.values(
        titleObject ||
        {}
      ).forEach(
        value =>
          titles.push(
            value
          )
      );
    }
  );

  return titles
    .filter(
      Boolean
    )
    .map(
      normalizeTitle
    );
}

function scoreMangaDexMatch(
  candidate,
  manga
) {
  let score = 0;

  const links =
    candidate?.attributes
      ?.links ||
    {};

  if (
    String(
      links.al ||
      ""
    ) ===
    String(
      manga.id
    )
  ) {
    score += 2000;
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
    score += 1800;
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
    aniTitle => {
      dexTitles.forEach(
        dexTitle => {
          if (
            aniTitle ===
            dexTitle
          ) {
            score += 300;
          } else if (
            aniTitle.length >=
              6 &&
            dexTitle.length >=
              6 &&
            (
              aniTitle.includes(
                dexTitle
              ) ||
              dexTitle.includes(
                aniTitle
              )
            )
          ) {
            score += 80;
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
      difference ===
      0
    ) {
      score += 40;
    } else if (
      difference ===
      1
    ) {
      score += 15;
    }
  }

  return score;
}

async function searchMangaDex(
  manga
) {
  const rawTitles = [
    manga?.title?.english,
    manga?.title?.romaji,
    ...(
      manga?.synonyms ||
      []
    )
  ].filter(
    Boolean
  );

  const titles =
    [
      ...new Set(
        rawTitles
      )
    ].slice(
      0,
      4
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
          limit:
            20,
          includes:
            [
              "cover_art"
            ],
          contentRating:
            CONTENT_RATING
        });

      const response =
        await apiFetch(
          `/manga?${query}`
        );

      const json =
        await response.json();

      const results =
        Array.isArray(
          json.data
        )
          ? json.data
          : [];

      results.forEach(
        candidate =>
          candidates.set(
            candidate.id,
            candidate
          )
      );
    } catch (error) {
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
        candidate => ({
          candidate,
          score:
            scoreMangaDexMatch(
              candidate,
              manga
            )
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.score -
          a.score
      );

  if (
    !ranked.length ||
    ranked[0].score <
      250
  ) {
    return null;
  }

  return ranked[0]
    .candidate;
}

async function fetchMangaDexChapters(
  mangaDexId
) {
  const all = [];

  const limit =
    100;

  let offset =
    0;

  let total =
    Infinity;

  while (
    offset <
    total
  ) {
    const query =
      buildQuery({
        translatedLanguage:
          [
            "en"
          ],

        contentRating:
          CONTENT_RATING,

        includes:
          [
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
          mangaDexId
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
        json.total ??
        all.length
      );

    if (
      !batch.length
    ) {
      break;
    }

    offset +=
      batch.length;
  }

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
  const value =
    chapter
      ?.attributes
      ?.chapter;

  if (
    value === null ||
    value ===
      undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function chapterIsInternal(
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
    chapterIsInternal(
      existing
    );

  const currentInternal =
    chapterIsInternal(
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
  const numeric =
    new Map();

  const specials =
    [];

  const external =
    [];

  chapters.forEach(
    chapter => {
      const externalUrl =
        safeExternalUrl(
          chapter
            ?.attributes
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
          chapterIsInternal(
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
          chapterIsInternal(
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

  specials
    .filter(
      chapterIsInternal
    )
    .sort(
      (
        a,
        b
      ) =>
        new Date(
          a?.attributes
            ?.publishAt ||
          0
        ) -
        new Date(
          b?.attributes
            ?.publishAt ||
          0
        )
    )
    .forEach(
      chapter =>
        internal.push({
          number:
            null,
          chapter
        })
    );

  return {
    internal,
    external
  };
}

function getChapterLabel(
  chapter,
  fallbackNumber =
    null
) {
  const number =
    chapter
      ?.attributes
      ?.chapter ??
    fallbackNumber;

  const title =
    chapter
      ?.attributes
      ?.title;

  let label =
    number !== null &&
    number !==
      undefined &&
    number !== ""
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
    chapter
      ?.relationships
      ?.find(
        relationship =>
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
      new URL(
        url
      )
        .hostname
        .replace(
          /^www\./,
          ""
        );

    const known = [
      [
        "mangaplus",
        "MANGA Plus"
      ],
      [
        "viz.com",
        "VIZ"
      ],
      [
        "webtoons",
        "WEBTOON"
      ],
      [
        "tapas",
        "Tapas"
      ],
      [
        "pocketcomics",
        "Pocket Comics"
      ],
      [
        "tappytoon",
        "Tappytoon"
      ],
      [
        "lezhin",
        "Lezhin"
      ],
      [
        "comikey",
        "Comikey"
      ],
      [
        "azuki",
        "Azuki"
      ],
      [
        "kmanga",
        "K MANGA"
      ],
      [
        "mangaup",
        "Manga UP!"
      ]
    ];

    const match =
      known.find(
        (
          [
            needle
          ]
        ) =>
          hostname.includes(
            needle
          )
      );

    return match
      ? match[1]
      : hostname;
  } catch {
    return "External source";
  }
}

function getExternalSources(
  manga,
  externalChapters
) {
  const sources =
    [];

  const seen =
    new Set();

  (
    manga?.externalLinks ||
    []
  )
    .filter(
      link =>
        link?.url &&
        !link
          ?.isDisabled
    )
    .forEach(
      link => {
        const url =
          safeExternalUrl(
            link.url
          );

        if (!url) {
          return;
        }

        const site =
          String(
            link.site ||
            getExternalName(
              url
            )
          );

        const lower =
          site.toLowerCase();

        if (
          [
            "anilist",
            "myanimelist",
            "twitter",
            "x",
            "youtube",
            "instagram"
          ].some(
            name =>
              lower.includes(
                name
              )
          )
        ) {
          return;
        }

        const key =
          `${site}|${url}`;

        if (
          seen.has(
            key
          )
        ) {
          return;
        }

        seen.add(
          key
        );

        sources.push({
          site,
          url,
          note:
            link.type ===
            "MANGA"
              ? "Official / publisher source"
              : "External source"
        });
      }
    );

  externalChapters.forEach(
    chapter => {
      const url =
        safeExternalUrl(
          chapter
            ?.attributes
            ?.externalUrl
        );

      if (!url) {
        return;
      }

      const site =
        getExternalName(
          url
        );

      const key =
        `${site}|${url}`;

      if (
        seen.has(
          key
        )
      ) {
        return;
      }

      seen.add(
        key
      );

      sources.push({
        site,
        url,
        note:
          "External chapter source"
      });
    }
  );

  sources.push({
    site:
      "Komix",

    url:
      "https://www.komix.to/browse",

    note:
      `Search “${getTitle(
        manga
      )}” on Komix`
  });

  return sources;
}

function readBookmarks() {
  try {
    const stored =
      JSON.parse(
        localStorage.getItem(
          BOOKMARK_KEY
        ) ||
        "[]"
      );

    return Array.isArray(
      stored
    )
      ? stored
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
      item =>
        Number(
          item.mediaId ||
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
      item =>
        Number(
          item.mediaId ||
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
      mediaId:
        currentManga.id,

      mangaId:
        currentMangaDex
          ?.id ||
        "",

      mangaTitle:
        getTitle(
          currentManga
        ),

      title:
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
      ? "✓ Saved to Panel Shelf"
      : "+ Add to Panel Shelf";

  button.classList.toggle(
    "saved",
    saved
  );
}

function renderDetail(
  manga
) {
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

  const cover =
    getCoverUrl(
      manga
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
            tag =>
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
          Finding in-app chapters...
        </a>

        <button
          class="series-shelf-btn"
          id="bookmarkBtn"
          type="button"
        >
          + Add to Panel Shelf
        </button>

      </div>

      <div
        id="sourcePanel"
        class="source-panel"
      ></div>

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

function renderSources() {
  const panel =
    document.getElementById(
      "sourcePanel"
    );

  if (
    !panel ||
    !currentManga
  ) {
    return;
  }

  const sources =
    getExternalSources(
      currentManga,
      externalChapterLinks
    );

  const internalCount =
    internalChapters.length;

  panel.innerHTML = `
    <div class="source-panel-head">

      <div>

        <span class="source-kicker">
          READING SOURCES
        </span>

        <strong>

          ${
            internalCount
              ? `${internalCount} chapter${internalCount === 1 ? "" : "s"} can open inside Panelly`
              : "No in-app chapter source found yet"
          }

        </strong>

      </div>

      <span class="source-mode">
        MULTI-SOURCE
      </span>

    </div>

    <div class="source-grid">

      ${
        internalCount
          ? `
            <div class="source-card source-card-panelly">

              <span class="source-type">
                IN-APP READER
              </span>

              <strong>
                Panelly Reader
              </strong>

              <small>
                Chapter page data · opens here
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
                  source.site
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

  if (!button) {
    return;
  }

  if (
    internalChapters.length
  ) {
    const first =
      internalChapters[0]
        .chapter;

    button.href =
      readerUrl(
        first.id
      );

    button.textContent =
      "Start Reading in Panelly →";

    button.classList.remove(
      "disabled"
    );

    return;
  }

  button.removeAttribute(
    "href"
  );

  button.textContent =
    "No In-App Chapters Yet";

  button.classList.add(
    "disabled"
  );
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
          currentMangaDex
            ?.id ||
          ""
        ),

      mediaId:
        String(
          currentManga
            ?.id ||
          ""
        )
    });

  return `reader.html?${params.toString()}`;
}

function updateChapterCount() {
  if (!chapterCountEl) {
    return;
  }

  const externalSources =
    getExternalSources(
      currentManga,
      externalChapterLinks
    ).length;

  chapterCountEl.textContent =
    `${internalChapters.length} in Panelly · ${externalSources} external source${externalSources === 1 ? "" : "s"}`;
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
    "chapter-row chapter-card-new";

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

      <strong class="chapter-label">
        ${escapeHtml(
          getChapterLabel(
            chapter,
            row.number
          )
        )}
      </strong>

      <small class="chapter-group">
        ${escapeHtml(
          getGroupName(
            chapter
          )
        )} · opens in Panelly
      </small>

    </span>

    <span class="chapter-read">
      READ IN PANELLY →
    </span>
  `;

  return element;
}

function appendChapterBatch() {
  const end =
    Math.min(
      renderedChapterCount +
        CHAPTER_BATCH_SIZE,
      internalChapters.length
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
        internalChapters[
          index
        ],
        index
      )
    );
  }

  chapterListEl.appendChild(
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
    chapterObserver.disconnect();
    chapterObserver = null;
  }

  if (
    renderedChapterCount >=
    internalChapters.length
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

  chapterListEl.appendChild(
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
    !internalChapters.length
  ) {
    chapterListEl.innerHTML = `
      <div class="status-msg chapter-empty-state">

        <strong>
          No chapters can currently be rendered inside Panelly for this title.
        </strong>

        <span>
          Check the Reading Sources above for official or external availability.
        </span>

      </div>
    `;

    return;
  }

  appendChapterBatch();
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

    chapterListEl.innerHTML = `
      <p class="status-msg">
        No chapter information available.
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

    currentMangaDex =
      await searchMangaDex(
        manga
      );

    let chapters = [];

    if (
      currentMangaDex
    ) {
      try {
        chapters =
          await fetchMangaDexChapters(
            currentMangaDex.id
          );
      } catch (error) {
        console.error(
          error
        );
      }
    }

    const prepared =
      prepareChapters(
        chapters
      );

    internalChapters =
      prepared.internal;

    externalChapterLinks =
      prepared.external;

    renderChapterIndex();
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
        Couldn't load chapter information.
      </p>
    `;
  }
}

searchForm?.addEventListener(
  "submit",
  event => {
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

init();

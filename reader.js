const CONTINUE_KEY =
  "panellyContinueReading";

const CONTENT_RATING = [
  "safe",
  "suggestive"
];

const readerTitle =
  document.getElementById(
    "readerTitle"
  );

const readerChapter =
  document.getElementById(
    "readerChapter"
  );

const readerPages =
  document.getElementById(
    "readerPages"
  );

const readerStatus =
  document.getElementById(
    "readerStatus"
  );

const backToSeries =
  document.getElementById(
    "backToSeries"
  );

const prevChapter =
  document.getElementById(
    "prevChapter"
  );

const nextChapter =
  document.getElementById(
    "nextChapter"
  );

const bottomPrev =
  document.getElementById(
    "bottomPrev"
  );

const bottomNext =
  document.getElementById(
    "bottomNext"
  );

const readerProgress =
  document.getElementById(
    "readerProgress"
  );

let currentChapter = null;
let currentManga = null;
let currentMangaId = null;
let currentChapterId = null;
let chapterList = [];

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

function parameters() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return {
    chapterId:
      params.get(
        "chapterId"
      ),
    mangaId:
      params.get(
        "mangaId"
      )
  };
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

function getChapterLabel(
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

  return title ||
    "Special Chapter";
}

async function fetchChapter(
  id
) {
  const query =
    buildQuery({
      includes: [
        "manga",
        "scanlation_group"
      ]
    });

  const response =
    await apiFetch(
      `/chapter/${encodeURIComponent(
        id
      )}?${query}`
    );

  const json =
    await response.json();

  return json.data;
}

async function fetchManga(
  id
) {
  const query =
    buildQuery({
      includes: [
        "cover_art"
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

async function fetchAtHome(
  chapterId
) {
  const response =
    await apiFetch(
      `/at-home/server/${encodeURIComponent(
        chapterId
      )}`
    );

  return await response.json();
}

async function fetchChapterList(
  mangaId
) {
  const chapters = [];

  let offset = 0;
  const limit = 100;
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

    chapters.push(
      ...batch.filter(
        (chapter) =>
          !chapter
            ?.attributes
            ?.externalUrl
      )
    );

    total =
      Number(
        json.total
      ) ||
      chapters.length;

    if (
      !batch.length
    ) {
      break;
    }

    offset += limit;
  }

  return chapters;
}

function numericChapter(
  chapter
) {
  const value =
    Number(
      chapter
        ?.attributes
        ?.chapter
    );

  return Number.isFinite(
    value
  )
    ? value
    : Infinity;
}

function sortedUniqueChapters(
  chapters
) {
  const byNumber =
    new Map();

  const specials = [];

  chapters.forEach(
    (chapter) => {
      const value =
        chapter?.attributes
          ?.chapter;

      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        specials.push(
          chapter
        );

        return;
      }

      const key =
        String(
          Number(value)
        );

      if (
        !byNumber.has(key)
      ) {
        byNumber.set(
          key,
          chapter
        );
      } else if (
        chapter.id ===
        currentChapterId
      ) {
        byNumber.set(
          key,
          chapter
        );
      }
    }
  );

  return [
    ...Array.from(
      byNumber.values()
    ).sort(
      (a, b) =>
        numericChapter(a) -
        numericChapter(b)
    ),
    ...specials
  ];
}

function navigationUrl(
  chapter
) {
  return `reader.html?chapterId=${encodeURIComponent(
    chapter.id
  )}&mangaId=${encodeURIComponent(
    currentMangaId
  )}`;
}

function setNavigationLink(
  element,
  chapter
) {
  if (!chapter) {
    element.href = "#";

    element.classList.add(
      "disabled"
    );

    return;
  }

  element.href =
    navigationUrl(
      chapter
    );

  element.classList.remove(
    "disabled"
  );
}

function configureNavigation() {
  chapterList =
    sortedUniqueChapters(
      chapterList
    );

  let index =
    chapterList.findIndex(
      (chapter) =>
        chapter.id ===
        currentChapterId
    );

  if (index < 0) {
    const currentNumber =
      currentChapter
        ?.attributes
        ?.chapter;

    index =
      chapterList.findIndex(
        (chapter) =>
          String(
            chapter
              ?.attributes
              ?.chapter
          ) ===
          String(
            currentNumber
          )
      );
  }

  const previous =
    index > 0
      ? chapterList[
          index - 1
        ]
      : null;

  const next =
    index >= 0 &&
    index <
      chapterList.length -
        1
      ? chapterList[
          index + 1
        ]
      : null;

  setNavigationLink(
    prevChapter,
    previous
  );

  setNavigationLink(
    bottomPrev,
    previous
  );

  setNavigationLink(
    nextChapter,
    next
  );

  setNavigationLink(
    bottomNext,
    next
  );
}

function readContinueData() {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(
          CONTINUE_KEY
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

function saveProgress(
  progress = 0
) {
  if (
    !currentManga ||
    !currentChapter ||
    !currentMangaId
  ) {
    return;
  }

  const items =
    readContinueData();

  const existing =
    items.findIndex(
      (item) =>
        item.mangaId ===
        currentMangaId
    );

  const record = {
    mangaId:
      currentMangaId,
    mangaTitle:
      getTitle(
        currentManga
      ),
    coverFile:
      getCoverFile(
        currentManga
      ),
    chapterId:
      currentChapterId,
    chapterLabel:
      getChapterLabel(
        currentChapter
      ),
    progress:
      Math.round(
        progress
      ),
    updatedAt:
      Date.now()
  };

  if (existing >= 0) {
    items.splice(
      existing,
      1
    );
  }

  items.unshift(
    record
  );

  localStorage.setItem(
    CONTINUE_KEY,
    JSON.stringify(
      items.slice(
        0,
        30
      )
    )
  );
}

function proxyImage(url) {
  return `/api/proxy-image?url=${encodeURIComponent(
    url
  )}`;
}

function renderPages(
  atHome
) {
  const baseUrl =
    atHome?.baseUrl;

  const hash =
    atHome?.chapter
      ?.hash;

  const files =
    atHome?.chapter
      ?.data ||
    [];

  if (
    !baseUrl ||
    !hash ||
    !files.length
  ) {
    throw new Error(
      "No readable pages returned."
    );
  }

  readerStatus.style.display =
    "none";

  readerPages.innerHTML =
    "";

  files.forEach(
    (
      file,
      index
    ) => {
      const wrapper =
        document.createElement(
          "div"
        );

      wrapper.className =
        "reader-page";

      const directUrl =
        `${baseUrl}/data/${hash}/${file}`;

      wrapper.innerHTML = `
        <img
          src="${escapeHtml(
            proxyImage(
              directUrl
            )
          )}"
          alt="Page ${index + 1}"
          ${
            index < 2
              ? 'loading="eager"'
              : 'loading="lazy"'
          }
          decoding="async"
        >
      `;

      readerPages.appendChild(
        wrapper
      );
    }
  );
}

function updateScrollProgress() {
  const total =
    document.documentElement
      .scrollHeight -
    window.innerHeight;

  const value =
    total > 0
      ? (
          window.scrollY /
          total
        ) *
        100
      : 0;

  const clamped =
    Math.max(
      0,
      Math.min(
        100,
        value
      )
    );

  readerProgress.style.width =
    `${clamped}%`;

  saveProgress(
    clamped
  );
}

function throttle(
  callback,
  delay
) {
  let timeout = null;

  return (...args) => {
    if (timeout) {
      return;
    }

    timeout =
      setTimeout(
        () => {
          timeout = null;

          callback(
            ...args
          );
        },
        delay
      );
  };
}

async function init() {
  const {
    chapterId,
    mangaId
  } =
    parameters();

  if (!chapterId) {
    readerStatus.textContent =
      "Invalid chapter.";

    return;
  }

  currentChapterId =
    chapterId;

  try {
    currentChapter =
      await fetchChapter(
        chapterId
      );

    currentMangaId =
      mangaId ||
      currentChapter
        ?.relationships
        ?.find(
          (relationship) =>
            relationship.type ===
            "manga"
        )
        ?.id;

    if (!currentMangaId) {
      throw new Error(
        "Couldn't identify manga."
      );
    }

    const [
      manga,
      atHome,
      chapters
    ] =
      await Promise.all([
        fetchManga(
          currentMangaId
        ),
        fetchAtHome(
          chapterId
        ),
        fetchChapterList(
          currentMangaId
        )
      ]);

    currentManga =
      manga;

    chapterList =
      chapters;

    const title =
      getTitle(manga);

    const label =
      getChapterLabel(
        currentChapter
      );

    document.title =
      `${label} · ${title} — Panelly`;

    readerTitle.textContent =
      title;

    readerChapter.textContent =
      label;

    backToSeries.href =
      `detail.html?id=${encodeURIComponent(
        currentMangaId
      )}`;

    renderPages(
      atHome
    );

    configureNavigation();

    saveProgress(0);
  } catch (error) {
    console.error(error);

    readerStatus.innerHTML = `
      <div>
        <strong>
          This chapter couldn't be opened.
        </strong>

        <p>
          It may no longer be available from the supported source.
        </p>
      </div>
    `;
  }
}

window.addEventListener(
  "scroll",
  throttle(
    updateScrollProgress,
    300
  ),
  {
    passive: true
  }
);

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key ===
        "ArrowLeft" &&
      !prevChapter
        .classList
        .contains(
          "disabled"
        )
    ) {
      window.location.href =
        prevChapter.href;
    }

    if (
      event.key ===
        "ArrowRight" &&
      !nextChapter
        .classList
        .contains(
          "disabled"
        )
    ) {
      window.location.href =
        nextChapter.href;
    }
  }
);

init();

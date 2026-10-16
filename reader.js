const CONTINUE_KEY =
  "panellyContinueReading";

const params =
  new URLSearchParams(
    window.location.search
  );

const source =
  params.get(
    "source"
  ) ||
  "mangadex";

const chapterId =
  params.get(
    "chapterId"
  ) ||
  "";

let mangaId =
  params.get(
    "mangaId"
  ) ||
  "";

const mediaId =
  Number(
    params.get(
      "mediaId"
    ) ||
    0
  ) ||
  null;

const manifestId =
  params.get(
    "manifest"
  ) ||
  "";

const quality =
  params.get(
    "quality"
  ) ===
  "saver"
    ? "dataSaver"
    : "data";

const seriesBack =
  document.getElementById(
    "seriesBack"
  );

const readerTitle =
  document.getElementById(
    "readerTitle"
  );

const readerChapter =
  document.getElementById(
    "readerChapter"
  );

const readerStatus =
  document.getElementById(
    "readerStatus"
  );

const readerPages =
  document.getElementById(
    "readerPages"
  );

const prevBtn =
  document.getElementById(
    "prevBtn"
  );

const nextBtn =
  document.getElementById(
    "nextBtn"
  );

const bottomPrev =
  document.getElementById(
    "bottomPrev"
  );

const bottomNext =
  document.getElementById(
    "bottomNext"
  );

const progressBar =
  document.getElementById(
    "progressBar"
  );

let currentPayload =
  null;

let saveTimer =
  null;

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
      `Chapter source request failed: ${response.status}`
    );
  }

  return response;
}

function buildQuery(
  paramsObject
) {
  const parts =
    [];

  for (
    const [
      key,
      value
    ]
    of Object.entries(
      paramsObject
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

function chapterLabel(
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

function mangaTitleFromChapter(
  chapter
) {
  const relationship =
    chapter
      ?.relationships
      ?.find(
        item =>
          item.type ===
          "manga"
      );

  const titles =
    relationship
      ?.attributes
      ?.title ||
    {};

  return (
    titles.en ||
    Object.values(
      titles
    )[0] ||
    "Series"
  );
}

function mangaIdFromChapter(
  chapter
) {
  return (
    chapter
      ?.relationships
      ?.find(
        item =>
          item.type ===
          "manga"
      )
      ?.id ||
    ""
  );
}

async function fetchAllReaderChapters(
  targetMangaId
) {
  const all =
    [];

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
          [
            "safe",
            "suggestive"
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
          targetMangaId
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

  const map =
    new Map();

  const specials =
    [];

  all.forEach(
    chapter => {
      if (
        safeExternalUrl(
          chapter
            ?.attributes
            ?.externalUrl
        )
      ) {
        return;
      }

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
        String(
          number
        );

      const existing =
        map.get(
          key
        );

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

  return [
    ...Array.from(
      map.entries()
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
      .sort(
        (
          a,
          b
        ) =>
          a.number -
          b.number
      ),

    ...specials.map(
      chapter => ({
        number:
          null,
        chapter
      })
    )
  ];
}

function makeReaderUrl(
  targetChapterId,
  targetMangaId =
    mangaId
) {
  const nextParams =
    new URLSearchParams({
      source:
        "mangadex",

      chapterId:
        String(
          targetChapterId
        ),

      mangaId:
        String(
          targetMangaId ||
          ""
        )
    });

  if (mediaId) {
    nextParams.set(
      "mediaId",
      String(
        mediaId
      )
    );
  }

  return `reader.html?${nextParams.toString()}`;
}

async function loadMangaDexChapter() {
  if (!chapterId) {
    throw new Error(
      "Missing chapter id"
    );
  }

  const chapterQuery =
    buildQuery({
      includes:
        [
          "manga",
          "scanlation_group"
        ]
    });

  const [
    chapterResponse,
    serverResponse
  ] =
    await Promise.all([
      apiFetch(
        `/chapter/${encodeURIComponent(
          chapterId
        )}?${chapterQuery}`
      ),

      apiFetch(
        `/at-home/server/${encodeURIComponent(
          chapterId
        )}`
      )
    ]);

  const chapterJson =
    await chapterResponse.json();

  const serverJson =
    await serverResponse.json();

  const chapter =
    chapterJson.data;

  if (!chapter) {
    throw new Error(
      "Chapter information unavailable"
    );
  }

  mangaId =
    mangaId ||
    mangaIdFromChapter(
      chapter
    );

  const hash =
    serverJson
      ?.chapter
      ?.hash;

  const files =
    serverJson
      ?.chapter
      ?.[quality] ||
    [];

  const baseUrl =
    serverJson
      ?.baseUrl;

  if (
    !baseUrl ||
    !hash ||
    !files.length
  ) {
    throw new Error(
      "This chapter has no readable page data"
    );
  }

  const folder =
    quality ===
    "dataSaver"
      ? "data-saver"
      : "data";

  const pages =
    files.map(
      file =>
        `${baseUrl}/${folder}/${hash}/${file}`
    );

  let prev =
    null;

  let next =
    null;

  if (mangaId) {
    try {
      const siblings =
        await fetchAllReaderChapters(
          mangaId
        );

      const index =
        siblings.findIndex(
          row =>
            row.chapter.id ===
            chapterId
        );

      if (
        index > 0
      ) {
        prev =
          makeReaderUrl(
            siblings[
              index - 1
            ].chapter.id,
            mangaId
          );
      }

      if (
        index >= 0 &&
        index <
          siblings.length -
            1
      ) {
        next =
          makeReaderUrl(
            siblings[
              index + 1
            ].chapter.id,
            mangaId
          );
      }
    } catch (error) {
      console.error(
        error
      );
    }
  }

  return {
    source:
      "mangadex",

    title:
      mangaTitleFromChapter(
        chapter
      ),

    chapterLabel:
      chapterLabel(
        chapter
      ),

    pages,
    prev,
    next,
    mangaId
  };
}

async function loadManifestChapter() {
  if (!manifestId) {
    throw new Error(
      "Missing reader manifest"
    );
  }

  const raw =
    sessionStorage.getItem(
      `panellyReaderManifest:${manifestId}`
    );

  if (!raw) {
    throw new Error(
      "Reader manifest expired or unavailable"
    );
  }

  const manifest =
    JSON.parse(
      raw
    );

  const pages =
    Array.isArray(
      manifest.pages
    )
      ? manifest.pages.filter(
          url =>
            safeExternalUrl(
              url
            )
        )
      : [];

  if (
    !pages.length
  ) {
    throw new Error(
      "No readable pages in this source manifest"
    );
  }

  return {
    source:
      manifest.source ||
      "manifest",

    title:
      manifest.title ||
      "Series",

    chapterLabel:
      manifest.chapterLabel ||
      "Chapter",

    pages,

    prev:
      manifest.prev ||
      null,

    next:
      manifest.next ||
      null,

    mangaId:
      manifest.mangaId ||
      mangaId
  };
}

const SOURCE_ADAPTERS = {
  mangadex:
    loadMangaDexChapter,

  manifest:
    loadManifestChapter
};

function setNavLink(
  element,
  href
) {
  if (href) {
    element.href =
      href;

    element.classList.remove(
      "disabled"
    );
  } else {
    element.removeAttribute(
      "href"
    );

    element.classList.add(
      "disabled"
    );
  }
}

function renderPages(
  payload
) {
  currentPayload =
    payload;

  readerTitle.textContent =
    payload.title;

  readerChapter.textContent =
    payload.chapterLabel;

  document.title =
    `${payload.chapterLabel} — ${payload.title} — Panelly`;

  if (mediaId) {
    seriesBack.href =
      `detail.html?id=${encodeURIComponent(
        mediaId
      )}`;
  } else {
    seriesBack.href =
      "index.html";
  }

  setNavLink(
    prevBtn,
    payload.prev
  );

  setNavLink(
    nextBtn,
    payload.next
  );

  setNavLink(
    bottomPrev,
    payload.prev
  );

  setNavLink(
    bottomNext,
    payload.next
  );

  readerPages.innerHTML =
    "";

  payload.pages.forEach(
    (
      url,
      index
    ) => {
      const img =
        document.createElement(
          "img"
        );

      img.className =
        "reader-page";

      img.src =
        url;

      img.alt =
        `${payload.chapterLabel} · page ${index + 1}`;

      img.decoding =
        "async";

      img.loading =
        index < 2
          ? "eager"
          : "lazy";

      img.addEventListener(
        "error",
        () => {
          img.alt =
            `Page ${index + 1} failed to load`;
        }
      );

      readerPages.appendChild(
        img
      );
    }
  );

  readerStatus.remove();

  restoreReadingPosition();
  saveContinueReading();
}

function readContinueItems() {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(
          CONTINUE_KEY
        ) ||
        "[]"
      );

    return Array.isArray(
      value
    )
      ? value
      : Object.values(
          value ||
          {}
        );
  } catch {
    return [];
  }
}

function currentProgress() {
  const max =
    document
      .documentElement
      .scrollHeight -
    window.innerHeight;

  if (
    max <= 0
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      (
        window.scrollY /
        max
      ) *
        100
    )
  );
}

function saveContinueReading() {
  if (
    !currentPayload ||
    !mediaId
  ) {
    return;
  }

  const items =
    readContinueItems()
      .filter(
        item =>
          Number(
            item.mediaId
          ) !==
          Number(
            mediaId
          )
      );

  items.unshift({
    mediaId,

    mangaId:
      currentPayload.mangaId ||
      mangaId ||
      "",

    source:
      currentPayload.source ||
      source,

    chapterId,

    mangaTitle:
      currentPayload.title,

    chapterLabel:
      currentPayload.chapterLabel,

    progress:
      currentProgress(),

    scrollY:
      window.scrollY,

    updatedAt:
      Date.now()
  });

  localStorage.setItem(
    CONTINUE_KEY,
    JSON.stringify(
      items.slice(
        0,
        20
      )
    )
  );
}

function restoreReadingPosition() {
  if (!mediaId) {
    return;
  }

  const item =
    readContinueItems()
      .find(
        entry =>
          Number(
            entry.mediaId
          ) ===
            Number(
              mediaId
            ) &&
          String(
            entry.chapterId ||
            ""
          ) ===
            String(
              chapterId
            )
      );

  if (!item) {
    return;
  }

  const y =
    Number(
      item.scrollY ||
      0
    );

  if (
    y > 0
  ) {
    requestAnimationFrame(
      () =>
        window.scrollTo(
          0,
          y
        )
    );
  }
}

function updateProgressBar() {
  const progress =
    currentProgress();

  progressBar.style.width =
    `${progress}%`;

  clearTimeout(
    saveTimer
  );

  saveTimer =
    setTimeout(
      saveContinueReading,
      250
    );
}

function showError(
  message
) {
  readerStatus.textContent =
    message;

  readerStatus.classList.add(
    "error"
  );
}

async function init() {
  const adapter =
    SOURCE_ADAPTERS[
      source
    ];

  if (!adapter) {
    showError(
      "This source is not supported by the Panelly reader yet."
    );

    return;
  }

  try {
    const payload =
      await adapter();

    renderPages(
      payload
    );
  } catch (error) {
    console.error(
      error
    );

    showError(
      error.message ||
      "Couldn't load this chapter."
    );
  }
}

window.addEventListener(
  "scroll",
  updateProgressBar,
  {
    passive:
      true
  }
);

window.addEventListener(
  "beforeunload",
  saveContinueReading
);

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key ===
        "ArrowLeft" &&
      prevBtn.href &&
      !prevBtn
        .classList
        .contains(
          "disabled"
        )
    ) {
      window.location.href =
        prevBtn.href;
    }

    if (
      event.key ===
        "ArrowRight" &&
      nextBtn.href &&
      !nextBtn
        .classList
        .contains(
          "disabled"
        )
    ) {
      window.location.href =
        nextBtn.href;
    }
  }
);

init();

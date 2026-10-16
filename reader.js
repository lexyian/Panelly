const CONTINUE_KEY =
  "panellyContinueReading";

const params =
  new URLSearchParams(
    window.location.search
  );

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

const seriesBack =
  document.getElementById(
    "seriesBack"
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

let currentChapter =
  null;

let currentManga =
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
      `Request failed: ${response.status}`
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

  return parts.join("&");
}

function safeExternalUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(
        value
      );

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    )
      ? url.toString()
      : null;
  } catch {
    return null;
  }
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
    "Series"
  );
}

function getCoverFile(manga) {
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

function chapterLabel(chapter) {
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

function chapterNumber(chapter) {
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

  return json.data ||
    null;
}

async function fetchReaderChapters(
  id
) {
  const all = [];

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

        contentRating: [
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
          id
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

    if (!batch.length) {
      break;
    }

    offset +=
      batch.length;
  }

  const map =
    new Map();

  all.forEach(
    chapter => {
      if (
        safeExternalUrl(
          chapter?.attributes
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
        return;
      }

      const existing =
        map.get(
          String(
            number
          )
        );

      if (!existing) {
        map.set(
          String(
            number
          ),
          chapter
        );

        return;
      }

      const currentTime =
        new Date(
          chapter?.attributes
            ?.publishAt ||
          0
        ).getTime();

      const oldTime =
        new Date(
          existing?.attributes
            ?.publishAt ||
          0
        ).getTime();

      if (
        currentTime >
        oldTime
      ) {
        map.set(
          String(
            number
          ),
          chapter
        );
      }
    }
  );

  return Array.from(
    map.values()
  ).sort(
    (
      a,
      b
    ) =>
      Number(
        a?.attributes
          ?.chapter ||
        0
      ) -
      Number(
        b?.attributes
          ?.chapter ||
        0
      )
  );
}

function readerUrl(id) {
  const next =
    new URLSearchParams({
      source:
        "mangadex",

      chapterId:
        id,

      mangaId
    });

  return `reader.html?${next.toString()}`;
}

function setNav(
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

function readContinue() {
  try {
    const items =
      JSON.parse(
        localStorage.getItem(
          CONTINUE_KEY
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

function readingProgress() {
  const max =
    document.documentElement
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

function saveContinue() {
  if (
    !currentChapter ||
    !currentManga ||
    !mangaId
  ) {
    return;
  }

  const items =
    readContinue()
      .filter(
        item =>
          String(
            item.mangaId ||
            ""
          ) !==
          String(
            mangaId
          )
      );

  items.unshift({
    mangaId,

    chapterId,

    mangaTitle:
      getTitle(
        currentManga
      ),

    chapterLabel:
      chapterLabel(
        currentChapter
      ),

    coverFile:
      getCoverFile(
        currentManga
      ),

    progress:
      readingProgress(),

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

function restorePosition() {
  const saved =
    readContinue()
      .find(
        item =>
          String(
            item.mangaId
          ) ===
            String(
              mangaId
            ) &&
          String(
            item.chapterId
          ) ===
            String(
              chapterId
            )
      );

  if (
    !saved ||
    !saved.scrollY
  ) {
    return;
  }

  requestAnimationFrame(
    () => {
      window.scrollTo(
        0,
        Number(
          saved.scrollY
        )
      );
    }
  );
}

async function init() {
  if (!chapterId) {
    readerStatus.textContent =
      "Missing chapter ID.";

    readerStatus.classList.add(
      "error"
    );

    return;
  }

  try {
    const chapterQuery =
      buildQuery({
        includes: [
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

    currentChapter =
      chapterJson.data;

    if (
      !currentChapter
    ) {
      throw new Error(
        "Chapter unavailable."
      );
    }

    if (!mangaId) {
      mangaId =
        currentChapter
          ?.relationships
          ?.find(
            relationship =>
              relationship.type ===
              "manga"
          )
          ?.id ||
        "";
    }

    if (!mangaId) {
      throw new Error(
        "Series unavailable."
      );
    }

    currentManga =
      await fetchManga(
        mangaId
      );

    const title =
      getTitle(
        currentManga
      );

    const label =
      chapterLabel(
        currentChapter
      );

    readerTitle.textContent =
      title;

    readerChapter.textContent =
      label;

    document.title =
      `${label} — ${title} — Panelly`;

    seriesBack.href =
      `detail.html?id=${encodeURIComponent(
        mangaId
      )}`;

    const hash =
      serverJson?.chapter
        ?.hash;

    const pages =
      serverJson?.chapter
        ?.data ||
      [];

    const baseUrl =
      serverJson?.baseUrl;

    if (
      !baseUrl ||
      !hash ||
      !pages.length
    ) {
      throw new Error(
        "No readable page data was returned for this chapter."
      );
    }

    readerPages.innerHTML =
      "";

    pages.forEach(
      (
        file,
        index
      ) => {
        const image =
          document.createElement(
            "img"
          );

        image.className =
          "reader-page";

        image.src =
          `${baseUrl}/data/${hash}/${file}`;

        image.alt =
          `${label} · page ${index + 1}`;

        image.decoding =
          "async";

        image.loading =
          index < 2
            ? "eager"
            : "lazy";

        readerPages.appendChild(
          image
        );
      }
    );

    const chapters =
      await fetchReaderChapters(
        mangaId
      );

    const currentIndex =
      chapters.findIndex(
        chapter =>
          chapter.id ===
          chapterId
      );

    const previous =
      currentIndex > 0
        ? readerUrl(
            chapters[
              currentIndex - 1
            ].id
          )
        : null;

    const next =
      currentIndex >= 0 &&
      currentIndex <
        chapters.length - 1
        ? readerUrl(
            chapters[
              currentIndex + 1
            ].id
          )
        : null;

    setNav(
      prevBtn,
      previous
    );

    setNav(
      bottomPrev,
      previous
    );

    setNav(
      nextBtn,
      next
    );

    setNav(
      bottomNext,
      next
    );

    readerStatus.remove();

    restorePosition();
    saveContinue();
  } catch (error) {
    console.error(
      error
    );

    readerStatus.textContent =
      error.message ||
      "Couldn't load this chapter.";

    readerStatus.classList.add(
      "error"
    );
  }
}

window.addEventListener(
  "scroll",
  () => {
    if (progressBar) {
      progressBar.style.width =
        `${readingProgress()}%`;
    }

    clearTimeout(
      saveTimer
    );

    saveTimer =
      setTimeout(
        saveContinue,
        250
      );
  },
  {
    passive: true
  }
);

window.addEventListener(
  "beforeunload",
  saveContinue
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

const CONTENT_RATING = [
  "safe",
  "suggestive"
];

const CONTINUE_KEY =
  "panellyContinueReading";

const params =
  new URLSearchParams(
    window.location.search
  );

const chapterId =
  params.get("chapterId");

const mediaId =
  Number(
    params.get("mediaId")
  ) || null;

const readerTitle =
  document.getElementById(
    "readerTitle"
  );

const chapterMeta =
  document.getElementById(
    "chapterMeta"
  );

const pagesEl =
  document.getElementById(
    "pages"
  );

const readerStatus =
  document.getElementById(
    "readerStatus"
  );

const progressBar =
  document.getElementById(
    "progressBar"
  );

const backSeries =
  document.getElementById(
    "backSeries"
  );

const seriesBtn =
  document.getElementById(
    "seriesBtn"
  );

const prevBtn =
  document.getElementById(
    "prevBtn"
  );

const nextBtn =
  document.getElementById(
    "nextBtn"
  );

const readerEnd =
  document.getElementById(
    "readerEnd"
  );

const endTitle =
  document.getElementById(
    "endTitle"
  );

let mangaTitle =
  "Untitled";

let chapterLabel =
  "Chapter";

let coverUrl = "";

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

function buildQuery(paramsValue) {
  const parts = [];

  Object.entries(
    paramsValue
  ).forEach(
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

function safeUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(value);

    if (
      url.protocol === "http:" ||
      url.protocol === "https:"
    ) {
      return url.toString();
    }
  } catch {}

  return null;
}

function chapterNumber(
  chapter
) {
  const number =
    Number(
      chapter?.attributes
        ?.chapter
    );

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

async function fetchChapter() {
  const query =
    buildQuery({
      includes: [
        "manga"
      ]
    });

  const response =
    await mangaDexFetch(
      `/chapter/${encodeURIComponent(
        chapterId
      )}?${query}`
    );

  const json =
    await response.json();

  return json.data;
}

async function fetchAniListMedia() {
  if (!mediaId) {
    return null;
  }

  try {
    const response =
      await fetch(
        `/api/anilist?mode=detail&id=${encodeURIComponent(
          mediaId
        )}`
      );

    if (!response.ok) {
      return null;
    }

    const json =
      await response.json();

    return json.manga;
  } catch {
    return null;
  }
}

function getAniListTitle(manga) {
  return (
    manga?.title?.english ||
    manga?.title?.romaji ||
    manga?.title?.native ||
    "Untitled"
  );
}

async function fetchSiblingChapters(
  mangaDexId
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
        contentRating:
          CONTENT_RATING
      });

    const response =
      await mangaDexFetch(
        `/manga/${encodeURIComponent(
          mangaDexId
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

  const map =
    new Map();

  chapters
    .filter(isHosted)
    .forEach((chapter) => {
      const number =
        chapterNumber(chapter);

      if (number === null) {
        return;
      }

      const key =
        String(number);

      if (!map.has(key)) {
        map.set(
          key,
          chapter
        );
      }
    });

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      chapterNumber(a) -
      chapterNumber(b)
  );
}

async function fetchPages() {
  const response =
    await mangaDexFetch(
      `/at-home/server/${encodeURIComponent(
        chapterId
      )}`
    );

  return response.json();
}

function saveContinue() {
  if (
    !mediaId ||
    !chapterId
  ) {
    return;
  }

  let items = [];

  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          CONTINUE_KEY
        ) || "[]"
      );

    if (
      Array.isArray(parsed)
    ) {
      items = parsed;
    }
  } catch {}

  items =
    items.filter(
      (item) =>
        Number(
          item.mediaId ??
          item.anilistId
        ) !== mediaId
    );

  items.unshift({
    mediaId,
    anilistId: mediaId,
    chapterId,
    mangaTitle,
    title: mangaTitle,
    chapterLabel,
    coverUrl,
    updatedAt:
      Date.now()
  });

  localStorage.setItem(
    CONTINUE_KEY,
    JSON.stringify(
      items.slice(0, 20)
    )
  );
}

function setupNavigation(
  chapters
) {
  const index =
    chapters.findIndex(
      (chapter) =>
        chapter.id ===
        chapterId
    );

  const previous =
    index > 0
      ? chapters[
          index - 1
        ]
      : null;

  const next =
    index >= 0 &&
    index <
      chapters.length - 1
      ? chapters[
          index + 1
        ]
      : null;

  if (previous) {
    prevBtn.href =
      `reader.html?chapterId=${encodeURIComponent(
        previous.id
      )}${
        mediaId
          ? `&mediaId=${encodeURIComponent(
              mediaId
            )}`
          : ""
      }`;

    prevBtn.classList.remove(
      "disabled"
    );
  }

  if (next) {
    nextBtn.href =
      `reader.html?chapterId=${encodeURIComponent(
        next.id
      )}${
        mediaId
          ? `&mediaId=${encodeURIComponent(
              mediaId
            )}`
          : ""
      }`;

    nextBtn.classList.remove(
      "disabled"
    );
  }
}

function renderPages(data) {
  const baseUrl =
    data?.baseUrl;

  const hash =
    data?.chapter?.hash;

  const files =
    Array.isArray(
      data?.chapter?.data
    )
      ? data.chapter.data
      : [];

  if (
    !baseUrl ||
    !hash ||
    !files.length
  ) {
    throw new Error(
      "No page images returned"
    );
  }

  pagesEl.innerHTML = "";

  const fragment =
    document.createDocumentFragment();

  files.forEach(
    (file, index) => {
      const original =
        `${baseUrl}/data/${hash}/${file}`;

      const image =
        document.createElement(
          "img"
        );

      image.className =
        "reader-page";

      image.src =
        `/api/proxy-image?url=${encodeURIComponent(
          original
        )}`;

      image.alt =
        `Page ${index + 1}`;

      image.decoding =
        "async";

      image.loading =
        index < 2
          ? "eager"
          : "lazy";

      if (index < 2) {
        image.fetchPriority =
          "high";
      }

      fragment.appendChild(
        image
      );
    }
  );

  pagesEl.appendChild(
    fragment
  );

  readerStatus.classList.add(
    "hidden"
  );

  readerEnd.classList.remove(
    "hidden"
  );
}

function setupProgress() {
  const update = () => {
    const documentHeight =
      document.documentElement
        .scrollHeight -
      window.innerHeight;

    const amount =
      documentHeight > 0
        ? window.scrollY /
          documentHeight
        : 0;

    progressBar.style.width =
      `${Math.min(
        100,
        Math.max(
          0,
          amount * 100
        )
      )}%`;
  };

  window.addEventListener(
    "scroll",
    update,
    {
      passive: true
    }
  );

  update();
}

async function init() {
  if (!chapterId) {
    readerStatus.textContent =
      "INVALID CHAPTER";

    return;
  }

  if (mediaId) {
    const detailUrl =
      `detail.html?id=${encodeURIComponent(
        mediaId
      )}`;

    backSeries.href =
      detailUrl;

    seriesBtn.href =
      detailUrl;
  }

  try {
    const [
      chapter,
      manga
    ] =
      await Promise.all([
        fetchChapter(),
        fetchAniListMedia()
      ]);

    const external =
      safeUrl(
        chapter?.attributes
          ?.externalUrl
      );

    if (external) {
      window.location.href =
        external;

      return;
    }

    if (manga) {
      mangaTitle =
        getAniListTitle(
          manga
        );

      coverUrl =
        manga?.coverImage
          ?.extraLarge ||
        manga?.coverImage
          ?.large ||
        manga?.coverImage
          ?.medium ||
        "";
    }

    const number =
      chapter?.attributes
        ?.chapter;

    const title =
      chapter?.attributes
        ?.title;

    chapterLabel =
      number
        ? `Chapter ${number}`
        : "Special";

    if (title) {
      chapterLabel +=
        ` — ${title}`;
    }

    readerTitle.textContent =
      mangaTitle;

    chapterMeta.textContent =
      chapterLabel.toUpperCase();

    endTitle.textContent =
      `Finished ${chapterLabel}`;

    document.title =
      `${chapterLabel} — ${mangaTitle} — Panelly`;

    const mangaRelation =
      chapter?.relationships
        ?.find(
          (relationship) =>
            relationship.type ===
            "manga"
        );

    if (mangaRelation?.id) {
      try {
        const siblings =
          await fetchSiblingChapters(
            mangaRelation.id
          );

        setupNavigation(
          siblings
        );
      } catch (
        navigationError
      ) {
        console.error(
          navigationError
        );
      }
    }

    const pages =
      await fetchPages();

    renderPages(pages);

    saveContinue();
  } catch (error) {
    console.error(error);

    readerStatus.textContent =
      "COULDN'T LOAD THIS CHAPTER";
  }
}

setupProgress();

init();

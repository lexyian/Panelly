const CONTINUE_KEY = "panellyContinueReading";
const CONTENT_RATING = ["safe", "suggestive"];

const backLinkEl = document.getElementById("backLink");
const readerTitleEl = document.getElementById("readerTitle");
const pageListEl = document.getElementById("pageList");
const prevBtnTop = document.getElementById("prevBtnTop");
const nextBtnTop = document.getElementById("nextBtnTop");
const prevBtnBottom = document.getElementById("prevBtnBottom");
const nextBtnBottom = document.getElementById("nextBtnBottom");

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

function getParams() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const mediaId =
    Number(
      params.get(
        "mediaId"
      )
    );

  return {
    chapterId:
      params.get(
        "chapterId"
      ),
    mediaId:
      Number.isInteger(
        mediaId
      ) &&
      mediaId > 0
        ? mediaId
        : null
  };
}

function proxyImage(url) {
  return `/api/proxy-image?url=${encodeURIComponent(
    url
  )}`;
}

function safeExternalUrl(value) {
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

async function fetchAniListDetail(
  mediaId
) {
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

    return json.manga ||
      null;
  } catch {
    return null;
  }
}

function getAniListTitle(
  manga
) {
  return (
    manga?.title?.english ||
    manga?.title?.romaji ||
    manga?.title?.native ||
    "Untitled"
  );
}

function getAniListCover(
  manga
) {
  return (
    manga?.coverImage?.large ||
    manga?.coverImage?.extraLarge ||
    manga?.coverImage?.medium ||
    ""
  );
}

async function fetchChapterInfo(
  chapterId
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
        chapterId
      )}?${query}`
    );

  const json =
    await response.json();

  return json.data;
}

async function fetchPages(
  chapterId
) {
  const response =
    await apiFetch(
      `/at-home/server/${encodeURIComponent(
        chapterId
      )}`
    );

  const json =
    await response.json();

  const baseUrl =
    json.baseUrl;

  const chapter =
    json.chapter;

  if (
    !baseUrl ||
    !chapter?.hash
  ) {
    throw new Error(
      "Invalid page response"
    );
  }

  let files =
    chapter.data;

  let folder =
    "data";

  if (
    !Array.isArray(
      files
    ) ||
    !files.length
  ) {
    files =
      chapter.dataSaver;

    folder =
      "data-saver";
  }

  if (
    !Array.isArray(
      files
    ) ||
    !files.length
  ) {
    throw new Error(
      "No pages available"
    );
  }

  return files.map(
    (filename) => {
      const url =
        `${baseUrl}/${folder}/${chapter.hash}/${filename}`;

      return proxyImage(
        url
      );
    }
  );
}

async function fetchSiblingChapters(
  mangaDexId
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
        contentRating:
          CONTENT_RATING
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

  const hosted =
    all.filter(
      (chapter) =>
        !safeExternalUrl(
          chapter
            ?.attributes
            ?.externalUrl
        )
    );

  const map =
    new Map();

  hosted.forEach(
    (chapter) => {
      const number =
        chapter
          ?.attributes
          ?.chapter;

      const key =
        number ||
        chapter.id;

      if (
        !map.has(
          key
        )
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
    (a, b) => {
      const aNumber =
        parseFloat(
          a
            ?.attributes
            ?.chapter
        );

      const bNumber =
        parseFloat(
          b
            ?.attributes
            ?.chapter
        );

      if (
        Number.isNaN(
          aNumber
        )
      ) {
        return 1;
      }

      if (
        Number.isNaN(
          bNumber
        )
      ) {
        return -1;
      }

      return (
        aNumber -
        bNumber
      );
    }
  );
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

function setReaderTitle(
  chapter
) {
  const title =
    getChapterLabel(
      chapter
    );

  readerTitleEl.textContent =
    title;

  document.title =
    `${title} — Panelly`;
}

function renderPages(
  urls
) {
  pageListEl.innerHTML =
    "";

  urls.forEach(
    (url, index) => {
      const img =
        document.createElement(
          "img"
        );

      img.className =
        "manga-page";

      img.src =
        url;

      img.alt =
        `Page ${index + 1}`;

      img.loading =
        index < 2
          ? "eager"
          : "lazy";

      img.decoding =
        "async";

      pageListEl.appendChild(
        img
      );
    }
  );
}

function renderExternal(
  url
) {
  pageListEl.innerHTML = `
    <div class="status-msg">
      <p>
        This chapter is hosted by an external publisher.
      </p>

      <a
        class="hero-cta"
        href="${url}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open official reader ↗
      </a>
    </div>
  `;
}

function setButton(
  button,
  chapter,
  mediaId
) {
  if (!chapter) {
    button.removeAttribute(
      "href"
    );

    button.classList.add(
      "nav-btn-disabled"
    );

    button.setAttribute(
      "aria-disabled",
      "true"
    );

    return;
  }

  button.href =
    `reader.html?chapterId=${encodeURIComponent(
      chapter.id
    )}${
      mediaId
        ? `&mediaId=${encodeURIComponent(
            mediaId
          )}`
        : ""
    }`;

  button.classList.remove(
    "nav-btn-disabled"
  );

  button.removeAttribute(
    "aria-disabled"
  );
}

function setNavigation(
  previous,
  next,
  mediaId
) {
  setButton(
    prevBtnTop,
    previous,
    mediaId
  );

  setButton(
    prevBtnBottom,
    previous,
    mediaId
  );

  setButton(
    nextBtnTop,
    next,
    mediaId
  );

  setButton(
    nextBtnBottom,
    next,
    mediaId
  );
}

function saveContinueReading(
  manga,
  chapter,
  mediaId
) {
  if (
    !manga ||
    !mediaId
  ) {
    return;
  }

  let items = [];

  try {
    const stored =
      JSON.parse(
        localStorage.getItem(
          CONTINUE_KEY
        ) ||
          "[]"
      );

    if (
      Array.isArray(
        stored
      )
    ) {
      items =
        stored;
    }
  } catch {}

  items =
    items.filter(
      (item) =>
        Number(
          item.mediaId ??
            item.anilistId
        ) !==
        mediaId
    );

  items.unshift({
    mediaId,
    anilistId:
      mediaId,
    chapterId:
      chapter.id,
    mangaTitle:
      getAniListTitle(
        manga
      ),
    title:
      getAniListTitle(
        manga
      ),
    chapterLabel:
      getChapterLabel(
        chapter
      ),
    coverUrl:
      getAniListCover(
        manga
      ),
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

async function setupNavigation(
  mangaDexId,
  chapterId,
  mediaId
) {
  try {
    const chapters =
      await fetchSiblingChapters(
        mangaDexId
      );

    const index =
      chapters.findIndex(
        (chapter) =>
          chapter.id ===
          chapterId
      );

    if (
      index === -1
    ) {
      setNavigation(
        null,
        null,
        mediaId
      );

      return;
    }

    const previous =
      index > 0
        ? chapters[
            index - 1
          ]
        : null;

    const next =
      index <
      chapters.length -
        1
        ? chapters[
            index + 1
          ]
        : null;

    setNavigation(
      previous,
      next,
      mediaId
    );
  } catch (
    error
  ) {
    console.error(
      error
    );

    setNavigation(
      null,
      null,
      mediaId
    );
  }
}

async function init() {
  const {
    chapterId,
    mediaId
  } =
    getParams();

  setNavigation(
    null,
    null,
    mediaId
  );

  if (!chapterId) {
    readerTitleEl.textContent =
      "No chapter";

    pageListEl.innerHTML = `
      <p class="status-msg">
        No chapter selected.
      </p>
    `;

    return;
  }

  let chapter;

  try {
    chapter =
      await fetchChapterInfo(
        chapterId
      );
  } catch (
    error
  ) {
    console.error(
      error
    );

    readerTitleEl.textContent =
      "Chapter unavailable";

    pageListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load this chapter.
      </p>
    `;

    return;
  }

  setReaderTitle(
    chapter
  );

  if (mediaId) {
    backLinkEl.href =
      `detail.html?id=${encodeURIComponent(
        mediaId
      )}`;
  }

  const mangaDexRelation =
    chapter.relationships
      ?.find(
        (relationship) =>
          relationship.type ===
          "manga"
      );

  if (
    mangaDexRelation?.id
  ) {
    setupNavigation(
      mangaDexRelation.id,
      chapterId,
      mediaId
    );
  }

  const externalUrl =
    safeExternalUrl(
      chapter
        ?.attributes
        ?.externalUrl
    );

  const aniListManga =
    mediaId
      ? await fetchAniListDetail(
          mediaId
        )
      : null;

  if (
    aniListManga &&
    mediaId
  ) {
    saveContinueReading(
      aniListManga,
      chapter,
      mediaId
    );
  }

  if (externalUrl) {
    renderExternal(
      externalUrl
    );

    return;
  }

  pageListEl.innerHTML = `
    <p class="status-msg">
      Loading pages...
    </p>
  `;

  try {
    const pages =
      await fetchPages(
        chapterId
      );

    renderPages(
      pages
    );
  } catch (
    error
  ) {
    console.error(
      error
    );

    pageListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load the pages for this chapter.
      </p>
    `;
  }
}

init();

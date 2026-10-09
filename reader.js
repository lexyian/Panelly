const API_BASE = "https://api.mangadex.org";
const CONTENT_RATING = ["safe", "suggestive"];

const backLinkEl = document.getElementById("backLink");
const readerTitleEl = document.getElementById("readerTitle");
const pageListEl = document.getElementById("pageList");
const prevBtnTop = document.getElementById("prevBtnTop");
const nextBtnTop = document.getElementById("nextBtnTop");
const prevBtnBottom = document.getElementById("prevBtnBottom");
const nextBtnBottom = document.getElementById("nextBtnBottom");

async function apiFetch(pathAndQuery) {
  try {
    const res = await fetch(
      `/api/mangadex?path=${encodeURIComponent(pathAndQuery)}`
    );

    if (res.ok) {
      return res;
    }
  } catch (err) {}

  return fetch(`${API_BASE}${pathAndQuery}`);
}

function buildQuery(params) {
  const parts = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        parts.push(`${key}[]=${encodeURIComponent(item)}`);
      });
    } else {
      parts.push(`${key}=${encodeURIComponent(value)}`);
    }
  }

  return parts.join("&");
}

function getChapterId() {
  return new URLSearchParams(window.location.search).get("chapterId");
}

function proxyImageUrl(url) {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function safeExternalUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.toString();
    }
  } catch (err) {}

  return null;
}

async function fetchChapterInfo(chapterId) {
  const query = buildQuery({
    includes: ["manga", "scanlation_group"],
  });

  const res = await apiFetch(
    `/chapter/${encodeURIComponent(chapterId)}?${query}`
  );

  if (!res.ok) {
    throw new Error(`Failed to load chapter info: ${res.status}`);
  }

  const json = await res.json();

  return json.data;
}

async function fetchPageUrls(chapterId) {
  const res = await apiFetch(
    `/at-home/server/${encodeURIComponent(chapterId)}`
  );

  if (!res.ok) {
    throw new Error(`Failed to load pages: ${res.status}`);
  }

  const json = await res.json();

  const baseUrl = json.baseUrl;
  const chapter = json.chapter;

  if (!baseUrl || !chapter?.hash) {
    throw new Error("Invalid MangaDex page response");
  }

  let files = chapter.data;
  let mode = "data";

  if (!Array.isArray(files) || !files.length) {
    files = chapter.dataSaver;
    mode = "data-saver";
  }

  if (!Array.isArray(files) || !files.length) {
    throw new Error("No chapter images available");
  }

  return files.map((filename) => {
    const directUrl =
      `${baseUrl}/${mode}/${chapter.hash}/${filename}`;

    return {
      directUrl,
      proxyUrl: proxyImageUrl(directUrl),
    };
  });
}

async function fetchSiblingChapters(mangaId) {
  const query = buildQuery({
    translatedLanguage: ["en"],
    "order[chapter]": "asc",
    limit: 500,
    contentRating: CONTENT_RATING,
  });

  const res = await apiFetch(
    `/manga/${encodeURIComponent(mangaId)}/feed?${query}`
  );

  if (!res.ok) {
    throw new Error(`Failed to load chapter list: ${res.status}`);
  }

  const json = await res.json();

  return Array.isArray(json.data) ? json.data : [];
}

function renderPages(pages) {
  pageListEl.innerHTML = "";

  if (!pages.length) {
    pageListEl.innerHTML = `
      <p class="status-msg">
        No pages are available for this chapter.
      </p>
    `;

    return;
  }

  pages.forEach((page, index) => {
    const img = document.createElement("img");

    img.className = "manga-page";
    img.alt = `Page ${index + 1}`;
    img.loading = index < 2 ? "eager" : "lazy";

    let triedDirect = false;

    img.addEventListener("error", () => {
      if (triedDirect) {
        return;
      }

      triedDirect = true;
      img.referrerPolicy = "no-referrer";
      img.src = page.directUrl;
    });

    img.src = page.proxyUrl;

    pageListEl.appendChild(img);
  });
}

function renderExternalChapter(externalUrl) {
  pageListEl.innerHTML = "";

  const wrapper = document.createElement("div");
  const message = document.createElement("p");
  const link = document.createElement("a");

  wrapper.className = "status-msg";

  message.textContent =
    "This chapter is an official release and is not hosted on MangaDex.";

  link.className = "hero-cta";
  link.href = externalUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open official site";

  wrapper.appendChild(message);
  wrapper.appendChild(link);

  pageListEl.appendChild(wrapper);
}

function setupNav(href, topEl, bottomEl) {
  [topEl, bottomEl].forEach((element) => {
    if (href) {
      element.href = href;
      element.classList.remove("nav-btn-disabled");
      element.removeAttribute("aria-disabled");
    } else {
      element.removeAttribute("href");
      element.classList.add("nav-btn-disabled");
      element.setAttribute("aria-disabled", "true");
    }
  });
}

function disableNavigation() {
  setupNav(null, prevBtnTop, prevBtnBottom);
  setupNav(null, nextBtnTop, nextBtnBottom);
}

function setReaderTitle(chapter) {
  const number = chapter.attributes.chapter;
  const title = chapter.attributes.title;

  let text = number ? `Chapter ${number}` : "Oneshot";

  if (title) {
    text += ` — ${title}`;
  }

  readerTitleEl.textContent = text;
  document.title = `${text} — Panelly`;
}

async function setupSiblingNavigation(mangaId, chapterId) {
  try {
    const chapters = await fetchSiblingChapters(mangaId);

    const index = chapters.findIndex(
      (chapter) => chapter.id === chapterId
    );

    if (index === -1) {
      disableNavigation();
      return;
    }

    const previous = index > 0 ? chapters[index - 1] : null;

    const next =
      index < chapters.length - 1
        ? chapters[index + 1]
        : null;

    setupNav(
      previous
        ? `reader.html?chapterId=${encodeURIComponent(previous.id)}`
        : null,
      prevBtnTop,
      prevBtnBottom
    );

    setupNav(
      next
        ? `reader.html?chapterId=${encodeURIComponent(next.id)}`
        : null,
      nextBtnTop,
      nextBtnBottom
    );
  } catch (err) {
    console.error(err);

    disableNavigation();
  }
}

async function init() {
  disableNavigation();

  const chapterId = getChapterId();

  if (!chapterId) {
    readerTitleEl.textContent = "No chapter";

    pageListEl.innerHTML = `
      <p class="status-msg">
        No chapter selected.
      </p>
    `;

    return;
  }

  let chapterInfo;

  try {
    chapterInfo = await fetchChapterInfo(chapterId);
  } catch (err) {
    console.error(err);

    readerTitleEl.textContent = "Chapter unavailable";

    pageListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load this chapter.
      </p>
    `;

    return;
  }

  setReaderTitle(chapterInfo);

  const mangaRel = chapterInfo.relationships?.find(
    (relationship) => relationship.type === "manga"
  );

  const mangaId = mangaRel?.id;

  if (mangaId) {
    backLinkEl.href =
      `detail.html?id=${encodeURIComponent(mangaId)}`;

    setupSiblingNavigation(mangaId, chapterId);
  }

  const externalUrl = safeExternalUrl(
    chapterInfo.attributes.externalUrl
  );

  if (externalUrl) {
    renderExternalChapter(externalUrl);
    return;
  }

  try {
    const pages = await fetchPageUrls(chapterId);

    renderPages(pages);
  } catch (err) {
    console.error(err);

    pageListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load pages for this chapter.
      </p>
    `;
  }
}

init();

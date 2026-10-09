const CONTENT_RATING = ["safe", "suggestive"];

const backLinkEl = document.getElementById("backLink");
const readerTitleEl = document.getElementById("readerTitle");
const pageListEl = document.getElementById("pageList");

const prevBtnTop = document.getElementById("prevBtnTop");
const nextBtnTop = document.getElementById("nextBtnTop");
const prevBtnBottom = document.getElementById("prevBtnBottom");
const nextBtnBottom = document.getElementById("nextBtnBottom");

async function apiFetch(pathAndQuery) {
  const res = await fetch(
    `/api/mangadex?path=${encodeURIComponent(pathAndQuery)}`
  );

  if (!res.ok) {
    throw new Error(`MangaDex request failed: ${res.status}`);
  }

  return res;
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
  return new URLSearchParams(window.location.search).get(
    "chapterId"
  );
}

function proxyImage(url) {
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

  const json = await res.json();

  return json.data;
}

async function fetchPageUrls(chapterId) {
  const res = await apiFetch(
    `/at-home/server/${encodeURIComponent(chapterId)}`
  );

  const json = await res.json();

  const baseUrl = json.baseUrl;
  const chapter = json.chapter;

  if (!baseUrl || !chapter?.hash) {
    throw new Error("Invalid page response");
  }

  let files = chapter.data;
  let folder = "data";

  if (!Array.isArray(files) || !files.length) {
    files = chapter.dataSaver;
    folder = "data-saver";
  }

  if (!Array.isArray(files) || !files.length) {
    throw new Error("No chapter pages");
  }

  return files.map((filename) => {
    const direct =
      `${baseUrl}/${folder}/${chapter.hash}/${filename}`;

    return proxyImage(direct);
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

  const json = await res.json();

  return Array.isArray(json.data) ? json.data : [];
}

function renderPages(urls) {
  pageListEl.innerHTML = "";

  if (!urls.length) {
    pageListEl.innerHTML = `
      <p class="status-msg">
        No pages found.
      </p>
    `;

    return;
  }

  urls.forEach((url, index) => {
    const img = document.createElement("img");

    img.className = "manga-page";
    img.src = url;
    img.alt = `Page ${index + 1}`;
    img.loading = index < 2 ? "eager" : "lazy";

    img.addEventListener("error", () => {
      img.style.display = "none";
      console.error(`Failed to load page ${index + 1}`);
    });

    pageListEl.appendChild(img);
  });
}

function renderExternalChapter(externalUrl) {
  pageListEl.innerHTML = "";

  const wrapper = document.createElement("div");
  const text = document.createElement("p");
  const link = document.createElement("a");

  wrapper.className = "status-msg";

  text.textContent =
    "This is an official release and is not hosted by MangaDex.";

  link.className = "hero-cta";
  link.href = externalUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open official site";

  wrapper.appendChild(text);
  wrapper.appendChild(link);

  pageListEl.appendChild(wrapper);
}

function setNavigationButton(element, chapter) {
  if (!chapter) {
    element.removeAttribute("href");
    element.classList.add("nav-btn-disabled");
    element.setAttribute("aria-disabled", "true");
    return;
  }

  element.href =
    `reader.html?chapterId=${encodeURIComponent(chapter.id)}`;

  element.classList.remove("nav-btn-disabled");
  element.removeAttribute("aria-disabled");
}

function setNavigation(previous, next) {
  setNavigationButton(prevBtnTop, previous);
  setNavigationButton(prevBtnBottom, previous);
  setNavigationButton(nextBtnTop, next);
  setNavigationButton(nextBtnBottom, next);
}

function disableNavigation() {
  setNavigation(null, null);
}

function setReaderTitle(chapter) {
  const number = chapter.attributes?.chapter;
  const title = chapter.attributes?.title;

  let text = number
    ? `Chapter ${number}`
    : "Oneshot";

  if (title) {
    text += ` — ${title}`;
  }

  readerTitleEl.textContent = text;
  document.title = `${text} — Panelly`;
}

async function setupNavigation(mangaId, chapterId) {
  try {
    const chapters = await fetchSiblingChapters(mangaId);

    const index = chapters.findIndex(
      (chapter) => chapter.id === chapterId
    );

    if (index === -1) {
      disableNavigation();
      return;
    }

    const previous =
      index > 0
        ? chapters[index - 1]
        : null;

    const next =
      index < chapters.length - 1
        ? chapters[index + 1]
        : null;

    setNavigation(previous, next);
  } catch (err) {
    console.error("Navigation error:", err);
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

  let chapter;

  try {
    chapter = await fetchChapterInfo(chapterId);
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

  setReaderTitle(chapter);

  const mangaRelationship =
    chapter.relationships?.find(
      (relationship) => relationship.type === "manga"
    );

  const mangaId = mangaRelationship?.id;

  if (mangaId) {
    backLinkEl.href =
      `detail.html?id=${encodeURIComponent(mangaId)}`;

    setupNavigation(mangaId, chapterId);
  }

  const externalUrl = safeExternalUrl(
    chapter.attributes?.externalUrl
  );

  if (externalUrl) {
    renderExternalChapter(externalUrl);
    return;
  }

  pageListEl.innerHTML = `
    <p class="status-msg">
      Loading pages…
    </p>
  `;

  try {
    const urls = await fetchPageUrls(chapterId);
    renderPages(urls);
  } catch (err) {
    console.error(err);

    pageListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load the pages for this chapter.
      </p>
    `;
  }
}

init();

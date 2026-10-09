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
    const res = await fetch(`/api/mangadex?path=${encodeURIComponent(pathAndQuery)}`);
    if (res.ok) return res;
  } catch (err) {}
  return fetch(`${API_BASE}${pathAndQuery}`);
}

function buildQuery(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => parts.push(`${key}[]=${encodeURIComponent(v)}`));
    } else {
      parts.push(`${key}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join("&");
}

function getChapterId() {
  return new URLSearchParams(window.location.search).get("chapterId");
}

function proxied(url) {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

async function fetchChapterInfo(chapterId) {
  const query = buildQuery({ includes: ["manga", "scanlation_group"] });
  const res = await apiFetch(`/chapter/${chapterId}?${query}`);
  if (!res.ok) throw new Error("Failed to load chapter info");
  const json = await res.json();
  return json.data;
}

async function fetchPageUrls(chapterId) {
  const res = await apiFetch(`/at-home/server/${chapterId}`);
  if (!res.ok) throw new Error("Failed to load pages");
  const json = await res.json();
  const { baseUrl, chapter } = json;
  return chapter.data.map((filename) => proxied(`${baseUrl}/data/${chapter.hash}/${filename}`));
}

async function fetchSiblingChapters(mangaId) {
  const query = buildQuery({
    translatedLanguage: ["en"],
    "order[chapter]": "asc",
    limit: 500,
    contentRating: CONTENT_RATING,
  });
  const res = await apiFetch(`/manga/${mangaId}/feed?${query}`);
  if (!res.ok) throw new Error("Failed to load chapter list");
  const json = await res.json();
  return json.data;
}

function renderPages(urls) {
  pageListEl.innerHTML = "";
  urls.forEach((url, i) => {
    const img = document.createElement("img");
    img.className = "manga-page";
    img.src = url;
    img.alt = `Page ${i + 1}`;
    img.loading = "lazy";
    pageListEl.appendChild(img);
  });
}

function setupNav(href, topEl, bottomEl, label) {
  [topEl, bottomEl].forEach((el) => {
    if (href) {
      el.href = href;
      el.classList.remove("nav-btn-disabled");
    } else {
      el.removeAttribute("href");
      el.classList.add("nav-btn-disabled");
    }
  });
}

async function init() {
  const chapterId = getChapterId();
  if (!chapterId) {
    pageListEl.innerHTML = `<p class="status-msg">No chapter selected.</p>`;
    return;
  }

  let chapterInfo;
  try {
    chapterInfo = await fetchChapterInfo(chapterId);
  } catch (err) {
    console.error(err);
    pageListEl.innerHTML = `<p class="status-msg">Couldn't load this chapter.</p>`;
    return;
  }

  const mangaRel = chapterInfo.relationships.find((r) => r.type === "manga");
  const mangaId = mangaRel?.id;
  const chapterNum = chapterInfo.attributes.chapter;
  const chapterTitle = chapterInfo.attributes.title;

  readerTitleEl.textContent = chapterNum ? `Chapter ${chapterNum}` : "Oneshot";
  if (mangaId) backLinkEl.href = `detail.html?id=${mangaId}`;

  try {
    const urls = await fetchPageUrls(chapterId);
    renderPages(urls);
  } catch (err) {
    console.error(err);
    pageListEl.innerHTML = `<p class="status-msg">Couldn't load pages for this chapter.</p>`;
  }

  if (mangaId) {
    try {
      const siblings = await fetchSiblingChapters(mangaId);
      const index = siblings.findIndex((c) => c.id === chapterId);
      const prev = index > 0 ? siblings[index - 1] : null;
      const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

      setupNav(prev ? `reader.html?chapterId=${prev.id}` : null, prevBtnTop, prevBtnBottom);
      setupNav(next ? `reader.html?chapterId=${next.id}` : null, nextBtnTop, nextBtnBottom);
    } catch (err) {
      console.error(err);
    }
  }
}

init();
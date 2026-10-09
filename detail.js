const API_BASE = "https://api.mangadex.org";
const COVER_BASE = "https://uploads.mangadex.org/covers";
const CONTENT_RATING = ["safe", "suggestive"];

const detailEl = document.getElementById("detail");
const chapterListEl = document.getElementById("chapterList");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

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

function getMangaId() {
  return new URLSearchParams(window.location.search).get("id");
}

function getTitle(manga) {
  const titles = manga.attributes.title;
  return titles.en || Object.values(titles)[0] || "Untitled";
}

function getDescription(manga) {
  const desc = manga.attributes.description;
  return desc?.en || Object.values(desc || {})[0] || "No description available.";
}

function getCoverUrl(manga, size = 512) {
  const coverRel = manga.relationships.find((r) => r.type === "cover_art");
  const fileName = coverRel?.attributes?.fileName;
  if (!fileName) return "";
  return `${COVER_BASE}/${manga.id}/${fileName}.${size}.jpg`;
}

function getCreators(manga) {
  const names = manga.relationships
    .filter((r) => r.type === "author" || r.type === "artist")
    .map((r) => r.attributes?.name)
    .filter(Boolean);
  return [...new Set(names)].join(", ") || "Unknown creator";
}

function getTags(manga) {
  return manga.attributes.tags.map((t) => t.attributes.name.en).filter(Boolean);
}

async function fetchMangaDetail(id) {
  const query = buildQuery({ includes: ["cover_art", "author", "artist"] });
  const res = await apiFetch(`/manga/${id}?${query}`);
  if (!res.ok) throw new Error("Failed to load manga");
  const json = await res.json();
  return json.data;
}

async function fetchChapters(id) {
  const query = buildQuery({
    translatedLanguage: ["en"],
    "order[chapter]": "asc",
    limit: 500,
    includes: ["scanlation_group"],
    contentRating: CONTENT_RATING,
  });
  const res = await apiFetch(`/manga/${id}/feed?${query}`);
  if (!res.ok) throw new Error("Failed to load chapters");
  const json = await res.json();
  return json.data;
}

function renderDetail(manga) {
  const cover = getCoverUrl(manga);
  const status = manga.attributes.status || "unknown";

  detailEl.innerHTML = `
    <img class="detail-cover" src="${cover}" alt="${getTitle(manga)} cover" />
    <div class="detail-info">
      <h1 class="detail-title">${getTitle(manga)}</h1>
      <p class="detail-meta">
        ${getCreators(manga)} &middot;
        <span class="status-pill">${status}</span>
      </p>
      <div class="tag-list">
        ${getTags(manga).map((t) => `<span class="tag">${t}</span>`).join("")}
      </div>
      <p class="detail-desc">${getDescription(manga)}</p>
    </div>
  `;
}

function renderChapters(chapters) {
  if (chapters.length === 0) {
    chapterListEl.innerHTML = `<p class="status-msg">No English chapters available yet.</p>`;
    return;
  }

  chapterListEl.innerHTML = "";
  chapters.forEach((chapter) => {
    const num = chapter.attributes.chapter;
    const title = chapter.attributes.title;
    const groupRel = chapter.relationships.find((r) => r.type === "scanlation_group");
    const groupName = groupRel?.attributes?.name || "Unknown group";

    const label = num ? `Chapter ${num}` : "Oneshot";
    const subtitle = title ? ` — ${title}` : "";

    const row = document.createElement("a");
    row.className = "chapter-row";
    row.href = `reader.html?chapterId=${chapter.id}`;
    row.innerHTML = `
      <span class="chapter-label">${label}${subtitle}</span>
      <span class="chapter-group">${groupName}</span>
    `;
    chapterListEl.appendChild(row);
  });
}

async function init() {
  const id = getMangaId();
  if (!id) {
    detailEl.innerHTML = `<p class="status-msg">No manga selected. Go back and pick one.</p>`;
    return;
  }

  try {
    const manga = await fetchMangaDetail(id);
    renderDetail(manga);
  } catch (err) {
    console.error(err);
    detailEl.innerHTML = `<p class="status-msg">Couldn't load this manga. Try going back and selecting it again.</p>`;
  }

  try {
    const chapters = await fetchChapters(id);
    renderChapters(chapters);
  } catch (err) {
    console.error(err);
    chapterListEl.innerHTML = `<p class="status-msg">Couldn't load chapters.</p>`;
  }
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const term = searchInput.value.trim();
  if (!term) return;
  window.location.href = `index.html?search=${encodeURIComponent(term)}`;
});

init();
const CONTENT_RATING = ["safe", "suggestive"];

const detailEl = document.getElementById("detail");
const chapterListEl = document.getElementById("chapterList");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

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

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char]
  );
}

function getMangaId() {
  return new URLSearchParams(window.location.search).get("id");
}

function getTitle(manga) {
  const titles = manga.attributes?.title || {};

  return titles.en || Object.values(titles)[0] || "Untitled";
}

function getDescription(manga) {
  const descriptions = manga.attributes?.description || {};

  return (
    descriptions.en ||
    Object.values(descriptions)[0] ||
    "No description available."
  );
}

function formatDescription(text) {
  let value = escapeHtml(text);

  value = value.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  value = value.replace(
    /\*\*([^*]+)\*\*/g,
    "<strong>$1</strong>"
  );

  value = value.replace(/\n/g, "<br>");

  return value;
}

function getCoverUrl(manga, size = 512) {
  const cover = manga.relationships?.find(
    (relationship) => relationship.type === "cover_art"
  );

  const fileName = cover?.attributes?.fileName;

  if (!fileName) {
    return "";
  }

  const directUrl =
    `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.${size}.jpg`;

  return `/api/proxy-image?url=${encodeURIComponent(directUrl)}`;
}

function getCreators(manga) {
  const names = manga.relationships
    ?.filter(
      (relationship) =>
        relationship.type === "author" ||
        relationship.type === "artist"
    )
    .map((relationship) => relationship.attributes?.name)
    .filter(Boolean);

  return [...new Set(names || [])].join(", ") || "Unknown creator";
}

function getTags(manga) {
  return (manga.attributes?.tags || [])
    .map(
      (tag) =>
        tag.attributes?.name?.en ||
        Object.values(tag.attributes?.name || {})[0]
    )
    .filter(Boolean);
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

async function fetchMangaDetail(id) {
  const query = buildQuery({
    includes: ["cover_art", "author", "artist"],
  });

  const res = await apiFetch(
    `/manga/${encodeURIComponent(id)}?${query}`
  );

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

  const res = await apiFetch(
    `/manga/${encodeURIComponent(id)}/feed?${query}`
  );

  const json = await res.json();

  return Array.isArray(json.data) ? json.data : [];
}

function renderDetail(manga) {
  detailEl.innerHTML = "";

  const img = document.createElement("img");
  const info = document.createElement("div");

  img.className = "detail-cover";
  img.alt = `${getTitle(manga)} cover`;

  const cover = getCoverUrl(manga);

  if (cover) {
    img.src = cover;
  }

  img.addEventListener("error", () => {
    img.style.opacity = "0.25";
  });

  const status = manga.attributes?.status || "unknown";
  const tags = getTags(manga);

  info.className = "detail-info";

  info.innerHTML = `
    <h1 class="detail-title">${escapeHtml(getTitle(manga))}</h1>

    <p class="detail-meta">
      ${escapeHtml(getCreators(manga))}
      &middot;
      <span class="status-pill">${escapeHtml(status)}</span>
    </p>

    <div class="tag-list">
      ${tags
        .map(
          (tag) =>
            `<span class="tag">${escapeHtml(tag)}</span>`
        )
        .join("")}
    </div>

    <p class="detail-desc">
      ${formatDescription(getDescription(manga))}
    </p>
  `;

  detailEl.appendChild(img);
  detailEl.appendChild(info);

  document.title = `${getTitle(manga)} — Panelly`;
}

function renderChapters(chapters) {
  chapterListEl.innerHTML = "";

  if (!chapters.length) {
    chapterListEl.innerHTML = `
      <p class="status-msg">
        No English chapters available.
      </p>
    `;

    return;
  }

  chapters.forEach((chapter) => {
    const chapterNumber = chapter.attributes?.chapter;
    const chapterTitle = chapter.attributes?.title;

    const group = chapter.relationships?.find(
      (relationship) =>
        relationship.type === "scanlation_group"
    );

    const groupName =
      group?.attributes?.name || "Unknown group";

    const chapterLabel = chapterNumber
      ? `Chapter ${chapterNumber}`
      : "Oneshot";

    const fullLabel = chapterTitle
      ? `${chapterLabel} — ${chapterTitle}`
      : chapterLabel;

    const externalUrl = safeExternalUrl(
      chapter.attributes?.externalUrl
    );

    const row = document.createElement("a");
    const label = document.createElement("span");
    const source = document.createElement("span");

    row.className = "chapter-row";

    label.className = "chapter-label";
    label.textContent = fullLabel;

    source.className = "chapter-group";

    if (externalUrl) {
      row.href = externalUrl;
      row.target = "_blank";
      row.rel = "noopener noreferrer";

      source.textContent = "Official site";
    } else {
      row.href =
        `reader.html?chapterId=${encodeURIComponent(chapter.id)}`;

      source.textContent = groupName;
    }

    row.appendChild(label);
    row.appendChild(source);

    chapterListEl.appendChild(row);
  });
}

async function init() {
  const id = getMangaId();

  if (!id) {
    detailEl.innerHTML = `
      <p class="status-msg">
        No manga selected.
      </p>
    `;

    chapterListEl.innerHTML = "";
    return;
  }

  try {
    const manga = await fetchMangaDetail(id);
    renderDetail(manga);
  } catch (err) {
    console.error(err);

    detailEl.innerHTML = `
      <p class="status-msg">
        Couldn't load this manga.
      </p>
    `;
  }

  try {
    const chapters = await fetchChapters(id);
    renderChapters(chapters);
  } catch (err) {
    console.error(err);

    chapterListEl.innerHTML = `
      <p class="status-msg">
        Couldn't load chapters.
      </p>
    `;
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const term = searchInput.value.trim();

  if (!term) {
    return;
  }

  window.location.href =
    `index.html?search=${encodeURIComponent(term)}`;
});

init();

module.exports = async function handler(req, res) {
  const path = req.query.path;

  if (!path || typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return res.status(400).json({ error: "Invalid path" });
  }

  let target;
  try {
    target = new URL("https://api.mangadex.org" + path);
  } catch {
    return res.status(400).json({ error: "Invalid path" });
  }

  if (target.hostname !== "api.mangadex.org") {
    return res.status(403).json({ error: "Host not allowed" });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { "User-Agent": "Panelly-School-Project/1.0" },
    });
    const body = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.status(upstream.status).send(body);
  } catch (err) {
    return res.status(502).json({ error: "Upstream error" });
  }
};
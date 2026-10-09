module.exports = async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }

  const allowedHosts = ["uploads.mangadex.org", "mangadex.network"];
  const isAllowed = allowedHosts.some((host) => target.hostname.endsWith(host));
  if (!isAllowed) {
    return res.status(403).json({ error: "Host not allowed" });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { "User-Agent": "Panelly-School-Project/1.0" },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream fetch failed" });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=600");
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: "Proxy error" });
  }
};
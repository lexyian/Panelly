module.exports = async function handler(req, res) {
  const url = req.query.url;

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      error: "Missing image URL",
    });
  }

  let target;

  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({
      error: "Invalid image URL",
    });
  }

  if (target.protocol !== "https:") {
    return res.status(403).json({
      error: "Only HTTPS is allowed",
    });
  }

  const allowedHosts = [
    "uploads.mangadex.org",
    "mangadex.network",
  ];

  const allowed = allowedHosts.some(
    (host) =>
      target.hostname === host ||
      target.hostname.endsWith(`.${host}`)
  );

  if (!allowed) {
    return res.status(403).json({
      error: "Image host not allowed",
    });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Panelly-School-Project/1.0",
        Accept:
          "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://mangadex.org/",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Image request failed: ${upstream.status}`,
      });
    }

    const contentType =
      upstream.headers.get("content-type") ||
      "image/jpeg";

    if (!contentType.startsWith("image/")) {
      return res.status(502).json({
        error: "Upstream response was not an image",
      });
    }

    const buffer = Buffer.from(
      await upstream.arrayBuffer()
    );

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );

    return res.status(200).send(buffer);
  } catch (err) {
    console.error(err);

    return res.status(502).json({
      error: "Image proxy failed",
    });
  }
};

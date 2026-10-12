function allowedHost(
  hostname
) {
  return (
    hostname ===
      "uploads.mangadex.org" ||
    hostname ===
      "mangadex.network" ||
    hostname.endsWith(
      ".mangadex.network"
    )
  );
}

export default async function handler(
  req,
  res
) {
  const rawUrl =
    Array.isArray(
      req.query.url
    )
      ? req.query.url[0]
      : req.query.url;

  if (
    !rawUrl ||
    typeof rawUrl !==
      "string"
  ) {
    return res
      .status(400)
      .json({
        error:
          "Missing image URL."
      });
  }

  let target;

  try {
    target =
      new URL(rawUrl);
  } catch {
    return res
      .status(400)
      .json({
        error:
          "Invalid image URL."
      });
  }

  if (
    target.protocol !==
      "https:" ||
    !allowedHost(
      target.hostname
    )
  ) {
    return res
      .status(403)
      .json({
        error:
          "Image host is not allowed."
      });
  }

  try {
    const response =
      await fetch(
        target.toString()
      );

    if (
      !response.ok
    ) {
      return res
        .status(
          response.status
        )
        .send(
          "Image unavailable."
        );
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) ||
      "image/jpeg";

    if (
      !contentType
        .toLowerCase()
        .startsWith(
          "image/"
        )
    ) {
      return res
        .status(415)
        .send(
          "Unsupported content."
        );
    }

    const arrayBuffer =
      await response
        .arrayBuffer();

    res.setHeader(
      "Content-Type",
      contentType
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
    );

    return res
      .status(200)
      .send(
        Buffer.from(
          arrayBuffer
        )
      );
  } catch (error) {
    console.error(error);

    return res
      .status(500)
      .send(
        "Image request failed."
      );
  }
}

function allowedHost(
  hostname
) {
  const host =
    String(
      hostname ||
      ""
    ).toLowerCase();

  return (
    host ===
      "uploads.mangadex.org" ||
    host.endsWith(
      ".mangadex.network"
    ) ||
    host.endsWith(
      ".mangadex.org"
    )
  );
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !==
    "GET"
  ) {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res
      .status(
        405
      )
      .send(
        "Method not allowed"
      );
  }

  const raw =
    String(
      req.query.url ||
      ""
    );

  let target;

  try {
    target =
      new URL(
        raw
      );
  } catch {
    return res
      .status(
        400
      )
      .send(
        "Invalid image URL"
      );
  }

  if (
    target.protocol !==
      "https:" ||
    !allowedHost(
      target.hostname
    )
  ) {
    return res
      .status(
        403
      )
      .send(
        "Image host not allowed"
      );
  }

  try {
    const response =
      await fetch(
        target.toString(),
        {
          headers: {
            Accept:
              "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",

            "User-Agent":
              "Panelly/1.0"
          }
        }
      );

    if (
      !response.ok
    ) {
      return res
        .status(
          response.status
        )
        .send(
          "Image request failed"
        );
    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.setHeader(
      "Content-Type",
      response.headers.get(
        "content-type"
      ) ||
      "image/jpeg"
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400"
    );

    return res
      .status(
        200
      )
      .send(
        buffer
      );
  } catch (error) {
    console.error(
      error
    );

    return res
      .status(
        500
      )
      .send(
        "Image proxy failed"
      );
  }
}

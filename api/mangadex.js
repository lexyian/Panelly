export default async function handler(
  req,
  res
) {
  const rawPath =
    Array.isArray(
      req.query.path
    )
      ? req.query.path[0]
      : req.query.path;

  if (
    !rawPath ||
    typeof rawPath !==
      "string" ||
    !rawPath.startsWith("/")
  ) {
    return res
      .status(400)
      .json({
        error:
          "Missing MangaDex path."
      });
  }

  try {
    const target =
      new URL(
        rawPath,
        "https://api.mangadex.org"
      );

    if (
      target.origin !==
      "https://api.mangadex.org"
    ) {
      return res
        .status(400)
        .json({
          error:
            "Invalid MangaDex path."
        });
    }

    const response =
      await fetch(
        target.toString(),
        {
          method: "GET",
          headers: {
            Accept:
              "application/json"
          }
        }
      );

    const text =
      await response.text();

    res.setHeader(
      "Content-Type",
      response.headers.get(
        "content-type"
      ) ||
        "application/json"
    );

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    return res
      .status(
        response.status
      )
      .send(text);
  } catch (error) {
    console.error(error);

    return res
      .status(500)
      .json({
        error:
          "MangaDex request failed."
      });
  }
}

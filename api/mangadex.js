const BASE =
  "https://api.mangadex.org";

function validPath(
  value
) {
  return (
    typeof value ===
      "string" &&
    value.startsWith(
      "/"
    ) &&
    !value.startsWith(
      "//"
    ) &&
    !value.includes(
      "http://"
    ) &&
    !value.includes(
      "https://"
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
      .json({
        error:
          "Method not allowed"
      });
  }

  const path =
    String(
      req.query.path ||
      ""
    );

  if (
    !validPath(
      path
    )
  ) {
    return res
      .status(
        400
      )
      .json({
        error:
          "Invalid MangaDex path"
      });
  }

  try {
    const response =
      await fetch(
        `${BASE}${path}`,
        {
          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Panelly/1.0"
          }
        }
      );

    const text =
      await response.text();

    res.status(
      response.status
    );

    res.setHeader(
      "Content-Type",
      response.headers.get(
        "content-type"
      ) ||
      "application/json; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=180"
    );

    return res.send(
      text
    );
  } catch (error) {
    console.error(
      error
    );

    return res
      .status(
        500
      )
      .json({
        error:
          "MangaDex proxy failed"
      });
  }
}

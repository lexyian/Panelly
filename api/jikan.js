export default async function handler(
  req,
  res
) {
  const idMal =
    Number(
      req.query.idMal
    );

  if (
    !Number.isInteger(
      idMal
    ) ||
    idMal <= 0
  ) {
    return res
      .status(400)
      .json({
        error:
          "Invalid MyAnimeList ID."
      });
  }

  try {
    const response =
      await fetch(
        `https://api.jikan.moe/v4/manga/${idMal}`,
        {
          headers: {
            Accept:
              "application/json"
          }
        }
      );

    const json =
      await response.json();

    if (
      !response.ok
    ) {
      return res
        .status(
          response.status
        )
        .json({
          error:
            "Jikan request failed."
        });
    }

    const manga =
      json.data ||
      {};

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=900"
    );

    return res
      .status(200)
      .json({
        score:
          manga.score ||
          null,
        scoredBy:
          manga.scored_by ||
          null,
        members:
          manga.members ||
          null,
        favorites:
          manga.favorites ||
          null,
        chapters:
          manga.chapters ||
          null,
        volumes:
          manga.volumes ||
          null,
        status:
          manga.status ||
          null,
        url:
          manga.url ||
          null
      });
  } catch (error) {
    console.error(error);

    return res
      .status(500)
      .json({
        error:
          "Jikan request failed."
      });
  }
}

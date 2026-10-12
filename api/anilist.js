const ANILIST_URL =
  "https://graphql.anilist.co";

const DETAIL_QUERY = `
query ($id: Int!) {
  Media(
    id: $id
    type: MANGA
  ) {
    id
    idMal

    title {
      romaji
      english
      native
    }

    description

    startDate {
      year
      month
      day
    }

    status
    chapters
    volumes
    averageScore
    popularity
    genres
    synonyms

    coverImage {
      extraLarge
      large
      medium
    }

    tags {
      name
      rank
      isAdult
      isGeneralSpoiler
      isMediaSpoiler
    }

    staff(perPage: 12) {
      edges {
        role

        node {
          name {
            full
          }
        }
      }
    }

    externalLinks {
      site
      url
      type
      isDisabled
    }
  }
}
`;

export default async function handler(
  req,
  res
) {
  const mode =
    String(
      req.query.mode ||
      "detail"
    );

  if (
    mode !== "detail"
  ) {
    return res
      .status(400)
      .json({
        error:
          "Unsupported AniList mode."
      });
  }

  const id =
    Number(
      req.query.id
    );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return res
      .status(400)
      .json({
        error:
          "Invalid AniList ID."
      });
  }

  try {
    const response =
      await fetch(
        ANILIST_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json"
          },
          body:
            JSON.stringify({
              query:
                DETAIL_QUERY,
              variables: {
                id
              }
            })
        }
      );

    const json =
      await response.json();

    if (
      !response.ok ||
      json.errors
    ) {
      return res
        .status(
          response.status ||
          502
        )
        .json({
          error:
            "AniList request failed.",
          details:
            json.errors ||
            null
        });
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=900"
    );

    return res
      .status(200)
      .json({
        manga:
          json.data?.Media ||
          null
      });
  } catch (error) {
    console.error(error);

    return res
      .status(500)
      .json({
        error:
          "AniList request failed."
      });
  }
}

const ENDPOINT = "https://graphql.anilist.co";

async function requestAniList(query, variables = {}) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  const json = await response.json();

  if (!response.ok || json.errors) {
    throw new Error(
      json.errors?.[0]?.message ||
      `AniList failed: ${response.status}`
    );
  }

  return json.data;
}

module.exports = async function handler(req, res) {
  const mode = String(
    req.query.mode || "detail"
  );

  try {
    if (mode === "detail") {
      const id = Number(req.query.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error: "Invalid AniList ID"
        });
      }

      const query = `
        query ($id: Int!) {
          Media(id: $id, type: MANGA) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            synonyms
            description(asHtml: false)
            status
            format
            chapters
            volumes
            countryOfOrigin
            isAdult
            startDate {
              year
            }
            coverImage {
              extraLarge
              large
              medium
            }
            genres
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
              language
              isDisabled
            }
          }
        }
      `;

      const data =
        await requestAniList(
          query,
          { id }
        );

      if (
        !data.Media ||
        data.Media.isAdult
      ) {
        return res.status(404).json({
          error: "Manga unavailable"
        });
      }

      res.setHeader(
        "Cache-Control",
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
      );

      return res.status(200).json({
        manga: data.Media
      });
    }

    return res.status(400).json({
      error: "Invalid mode"
    });
  } catch (error) {
    console.error(error);

    return res.status(502).json({
      error:
        error.message ||
        "AniList request failed"
    });
  }
};

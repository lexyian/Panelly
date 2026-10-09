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
    const message =
      json.errors?.[0]?.message ||
      `AniList request failed: ${response.status}`;

    throw new Error(message);
  }

  return json.data;
}

module.exports = async function handler(req, res) {
  const mode = String(req.query.mode || "browse");

  try {
    if (mode === "genres") {
      const query = `
        query {
          GenreCollection
        }
      `;

      const data = await requestAniList(query);

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600, s-maxage=86400"
      );

      return res.status(200).json({
        genres: data.GenreCollection || []
      });
    }

    if (mode === "detail") {
      const id = Number(req.query.id);

      if (!Number.isInteger(id) || id <= 0) {
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
            averageScore
            popularity
            trending
            updatedAt
            startDate {
              year
            }
            coverImage {
              extraLarge
              large
              medium
              color
            }
            bannerImage
            genres
            tags {
              name
              rank
              isAdult
              isGeneralSpoiler
              isMediaSpoiler
            }
            staff(perPage: 10) {
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
            siteUrl
          }
        }
      `;

      const data = await requestAniList(query, {
        id
      });

      if (!data.Media || data.Media.isAdult) {
        return res.status(404).json({
          error: "Manga not available"
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

    if (mode === "browse") {
      const search =
        typeof req.query.search === "string" &&
        req.query.search.trim()
          ? req.query.search.trim()
          : null;

      const genre =
        typeof req.query.genre === "string" &&
        req.query.genre.trim()
          ? req.query.genre.trim()
          : null;

      const page = Math.max(
        1,
        Number(req.query.page) || 1
      );

      const perPage = Math.min(
        20,
        Math.max(
          1,
          Number(req.query.perPage) || 8
        )
      );

      const requestedSort =
        String(req.query.sort || "trending");

      let sort = [
        "TRENDING_DESC",
        "POPULARITY_DESC"
      ];

      if (search) {
        sort = [
          "SEARCH_MATCH",
          "POPULARITY_DESC"
        ];
      } else if (requestedSort === "fresh") {
        sort = [
          "UPDATED_AT_DESC",
          "POPULARITY_DESC"
        ];
      } else if (requestedSort === "popular") {
        sort = [
          "POPULARITY_DESC",
          "SCORE_DESC"
        ];
      }

      const query = `
        query (
          $page: Int
          $perPage: Int
          $search: String
          $genre: String
          $sort: [MediaSort]
        ) {
          Page(
            page: $page
            perPage: $perPage
          ) {
            pageInfo {
              currentPage
              hasNextPage
              total
            }
            media(
              type: MANGA
              format_in: [MANGA, ONE_SHOT]
              isAdult: false
              search: $search
              genre: $genre
              sort: $sort
            ) {
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
              averageScore
              popularity
              trending
              updatedAt
              startDate {
                year
              }
              coverImage {
                extraLarge
                large
                medium
                color
              }
              bannerImage
              genres
              tags {
                name
                rank
                isAdult
                isGeneralSpoiler
                isMediaSpoiler
              }
            }
          }
        }
      `;

      const data = await requestAniList(query, {
        page,
        perPage,
        search,
        genre,
        sort
      });

      res.setHeader(
        "Cache-Control",
        "public, max-age=120, s-maxage=600, stale-while-revalidate=3600"
      );

      return res.status(200).json({
        manga: data.Page?.media || [],
        pageInfo: data.Page?.pageInfo || {}
      });
    }

    return res.status(400).json({
      error: "Unknown mode"
    });
  } catch (error) {
    console.error(error);

    return res.status(502).json({
      error: error.message || "AniList request failed"
    });
  }
};

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

function isAllowedMedia(media) {
  if (!media) {
    return false;
  }

  if (media.isAdult) {
    return false;
  }

  const tags =
    Array.isArray(media.tags)
      ? media.tags
      : [];

  const blocked =
    tags.some((tag) => {
      if (tag?.isAdult) {
        return true;
      }

      return (
        String(tag?.name || "")
          .toLowerCase() === "hentai"
      );
    });

  return !blocked;
}

module.exports = async function handler(req, res) {
  const mode =
    String(req.query.mode || "browse");

  try {
    if (mode === "genres") {
      const query = `
        query {
          GenreCollection
        }
      `;

      const data =
        await requestAniList(query);

      const normalGenres =
        Array.isArray(data.GenreCollection)
          ? data.GenreCollection
          : [];

      const genres = [
        ...normalGenres.filter(
          (genre) =>
            String(genre)
              .toLowerCase() !== "hentai"
        ),
        "Girls' Love",
        "Boys' Love"
      ]
        .filter(
          (value, index, array) =>
            array.indexOf(value) === index
        )
        .sort(
          (a, b) =>
            a.localeCompare(b)
        );

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
      );

      return res.status(200).json({
        genres
      });
    }

    if (mode === "detail") {
      const id =
        Number(req.query.id);

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

            averageScore
            popularity
            trending
            updatedAt

            startDate {
              year
              month
              day
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

            siteUrl
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
        !isAllowedMedia(data.Media)
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

    if (mode === "browse") {
      const search =
        typeof req.query.search ===
          "string" &&
        req.query.search.trim()
          ? req.query.search.trim()
          : null;

      const selectedGenre =
        typeof req.query.genre ===
          "string" &&
        req.query.genre.trim()
          ? req.query.genre.trim()
          : null;

      let genre =
        selectedGenre;

      let tag = null;

      if (
        selectedGenre ===
        "Girls' Love"
      ) {
        genre = null;
        tag = "Yuri";
      }

      if (
        selectedGenre ===
        "Boys' Love"
      ) {
        genre = null;
        tag = "Boys' Love";
      }

      const page =
        Math.max(
          1,
          Number(req.query.page) || 1
        );

      const perPage =
        Math.min(
          20,
          Math.max(
            1,
            Number(req.query.perPage) || 8
          )
        );

      const requestedSort =
        String(
          req.query.sort || "trending"
        );

      let sort = [
        "TRENDING_DESC",
        "POPULARITY_DESC"
      ];

      if (search) {
        sort = [
          "SEARCH_MATCH",
          "POPULARITY_DESC"
        ];
      } else if (
        requestedSort === "fresh"
      ) {
        sort = [
          "UPDATED_AT_DESC",
          "POPULARITY_DESC"
        ];
      } else if (
        requestedSort === "popular"
      ) {
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
          $tag: String
          $sort: [MediaSort]
        ) {
          Page(
            page: $page
            perPage: $perPage
          ) {
            pageInfo {
              currentPage
              lastPage
              hasNextPage
              perPage
              total
            }

            media(
              type: MANGA
              format_in: [MANGA, ONE_SHOT]
              isAdult: false
              search: $search
              genre: $genre
              tag: $tag
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
            }
          }
        }
      `;

      const data =
        await requestAniList(
          query,
          {
            page,
            perPage,
            search,
            genre,
            tag,
            sort
          }
        );

      const manga =
        (
          data.Page?.media ||
          []
        ).filter(
          isAllowedMedia
        );

      res.setHeader(
        "Cache-Control",
        "public, max-age=120, s-maxage=600, stale-while-revalidate=3600"
      );

      return res.status(200).json({
        manga,
        pageInfo:
          data.Page?.pageInfo ||
          {}
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

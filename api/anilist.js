const ENDPOINT =
  "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  idMal

  title {
    romaji
    english
    native
  }

  description(
    asHtml: false
  )

  status
  format
  countryOfOrigin
  chapters

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
  synonyms

  tags {
    name
    rank
    isAdult
    isGeneralSpoiler
    isMediaSpoiler
  }

  externalLinks {
    id
    url
    site
    type
    language
    color
    icon
    notes
    isDisabled
  }
`;

async function runQuery(
  query,
  variables
) {
  const response =
    await fetch(
      ENDPOINT,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json"
        },

        body:
          JSON.stringify({
            query,
            variables
          })
      }
    );

  const json =
    await response.json();

  if (
    !response.ok ||
    json.errors
  ) {
    const message =
      json
        ?.errors
        ?.[0]
        ?.message ||
      "AniList request failed";

    throw new Error(
      message
    );
  }

  return json.data;
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

  try {
    const mode =
      String(
        req.query.mode ||
        "search"
      );

    if (
      mode ===
      "detail"
    ) {
      const id =
        Number(
          req.query.id
        );

      if (
        !Number.isInteger(
          id
        ) ||
        id <= 0
      ) {
        return res
          .status(
            400
          )
          .json({
            error:
              "Invalid AniList id"
          });
      }

      const data =
        await runQuery(
          `
            query (
              $id: Int!
            ) {
              Media(
                id: $id,
                type: MANGA,
                isAdult: false
              ) {

                ${MEDIA_FIELDS}

                staff(
                  sort: RELEVANCE,
                  perPage: 12
                ) {
                  edges {
                    role

                    node {
                      name {
                        full
                      }
                    }
                  }
                }
              }
            }
          `,
          {
            id
          }
        );

      res.setHeader(
        "Cache-Control",
        "s-maxage=300, stale-while-revalidate=900"
      );

      return res
        .status(
          200
        )
        .json({
          manga:
            data.Media
        });
    }

    const page =
      Math.max(
        1,
        Number(
          req.query.page ||
          1
        )
      );

    const perPage =
      Math.min(
        30,
        Math.max(
          1,
          Number(
            req.query.perPage ||
            15
          )
        )
      );

    const search =
      String(
        req.query.search ||
        ""
      ).trim() ||
      null;

    const genre =
      String(
        req.query.genre ||
        ""
      ).trim() ||
      null;

    const tag =
      String(
        req.query.tag ||
        ""
      ).trim() ||
      null;

    const country =
      String(
        req.query.country ||
        ""
      )
        .trim()
        .toUpperCase() ||
      null;

    const sort =
      String(
        req.query.sort ||
        "TRENDING_DESC"
      ).trim();

    const allowedSorts =
      new Set([
        "TRENDING_DESC",
        "POPULARITY_DESC",
        "SCORE_DESC",
        "UPDATED_AT_DESC",
        "START_DATE_DESC",
        "FAVOURITES_DESC"
      ]);

    const finalSort =
      allowedSorts.has(
        sort
      )
        ? sort
        : "TRENDING_DESC";

    const data =
      await runQuery(
        `
          query (
            $page: Int,
            $perPage: Int,
            $search: String,
            $genre: String,
            $tag: String,
            $country: CountryCode,
            $sort: [MediaSort]
          ) {

            Page(
              page: $page,
              perPage: $perPage
            ) {

              pageInfo {
                currentPage
                hasNextPage
                total
              }

              media(
                type: MANGA,
                isAdult: false,
                search: $search,
                genre: $genre,
                tag: $tag,
                countryOfOrigin: $country,
                sort: $sort
              ) {

                ${MEDIA_FIELDS}

              }
            }
          }
        `,
        {
          page,
          perPage,
          search,
          genre,
          tag,

          country:
            [
              "JP",
              "KR",
              "CN",
              "TW"
            ].includes(
              country
            )
              ? country
              : null,

          sort:
            [
              finalSort
            ]
        }
      );

    res.setHeader(
      "Cache-Control",
      "s-maxage=180, stale-while-revalidate=600"
    );

    return res
      .status(
        200
      )
      .json({
        items:
          data.Page.media ||
          [],

        pageInfo:
          data.Page.pageInfo ||
          null
      });
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
          error.message ||
          "AniList request failed"
      });
  }
}

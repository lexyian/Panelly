module.exports = async function handler(req, res) {
  const idMal = Number(req.query.idMal);

  if (!Number.isInteger(idMal) || idMal <= 0) {
    return res.status(400).json({
      error: "Invalid MyAnimeList ID"
    });
  }

  try {
    const response = await fetch(
      `https://api.jikan.moe/v4/manga/${idMal}/full`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Panelly-School-Project/1.0"
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Jikan request failed"
      });
    }

    const json = await response.json();
    const manga = json.data;

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    );

    return res.status(200).json({
      idMal: manga?.mal_id || idMal,
      chapters:
        Number(manga?.chapters) || null,
      volumes:
        Number(manga?.volumes) || null,
      status:
        manga?.status || null
    });
  } catch (error) {
    console.error(error);

    return res.status(502).json({
      error: "Jikan request failed"
    });
  }
};

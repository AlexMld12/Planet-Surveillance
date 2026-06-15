import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchWebcams, parseQuery, WindyRequestError } from "../server/windy";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Doar GET este permis" });
    return;
  }

  const apiKey = process.env.WINDY_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "WINDY_API_KEY lipseste pe server" });
    return;
  }

  const host = req.headers.host ?? "localhost";
  const params = new URL(req.url ?? "", `http://${host}`).searchParams;
  const query = parseQuery(params);
  if (!query) {
    res.status(400).json({ error: "Parametri invalizi (lat/lng obligatorii)" });
    return;
  }

  try {
    const data = await fetchWebcams(query, apiKey);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(data);
  } catch (error) {
    const status = error instanceof WindyRequestError ? 502 : 500;
    res.status(status).json({ error: "Eroare la interogarea Windy" });
  }
}

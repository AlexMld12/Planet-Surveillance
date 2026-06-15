import type { Plugin } from "vite";
import { fetchWebcams, parseQuery, WindyRequestError } from "./windy";

export function windyDevApi(apiKey: string | undefined): Plugin {
  return {
    name: "windy-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/webcams", async (req, res) => {
        if (!apiKey) {
          send(res, 500, { error: "WINDY_API_KEY lipseste in .env" });
          return;
        }

        const params = new URL(req.url ?? "", "http://localhost").searchParams;
        const query = parseQuery(params);
        if (!query) {
          send(res, 400, { error: "Parametri invalizi (lat/lng obligatorii)" });
          return;
        }

        try {
          const data = await fetchWebcams(query, apiKey);
          send(res, 200, data);
        } catch (error) {
          const status = error instanceof WindyRequestError ? 502 : 500;
          send(res, status, { error: "Eroare la interogarea Windy" });
        }
      });
    },
  };
}

function send(res: { setHeader: (k: string, v: string) => void; statusCode: number; end: (chunk: string) => void }, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

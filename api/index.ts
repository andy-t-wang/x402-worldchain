import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../src/index.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${proto}://${host}${req.url || "/"}`;

  // Buffer the body for non-GET/HEAD
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: string) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }

  const webRequest = new Request(url, {
    method: req.method || "GET",
    headers,
    body,
  });

  const webResponse = await app.fetch(webRequest);

  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}

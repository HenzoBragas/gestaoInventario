import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const appModule = await import("./dist/server/index.js");
const appServer = appModule.default ?? appModule;

const port = Number(process.env.PORT ?? 3000);
const rawBackendUrl = process.env.BACKEND_URL ?? "http://backend:8080";
const backendBaseUrl = rawBackendUrl.startsWith("http") ? rawBackendUrl : `https://${rawBackendUrl}`;
const clientRoot = fileURLToPath(new URL("./dist/client/", import.meta.url));

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

function resolveClientFile(requestPath) {
  const safePath = normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(clientRoot, safePath);
  return candidate.startsWith(clientRoot) ? candidate : clientRoot;
}

async function serveClientAsset(request, response) {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const filePath = resolveClientFile(pathname);

  try {
    const fileStat = statSync(filePath);
    if (fileStat.isDirectory()) {
      sendText(response, 404, "Not Found");
      return true;
    }

    const contentType = mimeTypes[extname(filePath)] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    createReadStream(filePath).pipe(response);
    return true;
  } catch {
    return false;
  }
}

async function proxyApiRequest(request, response) {
  const strippedPath = (request.url ?? "/").replace(/^\/api/, "");
  const targetUrl = new URL(strippedPath, backendBaseUrl);
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (!value || name === "host" || name === "connection" || name === "content-length") {
      continue;
    }

    headers.set(name, Array.isArray(value) ? value.join(",") : value);
  }

  const method = request.method ?? "GET";
  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : request,
    duplex: method === "GET" || method === "HEAD" ? undefined : "half",
    redirect: "manual",
  });

  const forwardedHeaders = {};
  for (const [name, value] of upstream.headers.entries()) {
    if (name === "transfer-encoding" || name === "connection" || name === "keep-alive") {
      continue;
    }
    forwardedHeaders[name] = value;
  }

  response.writeHead(upstream.status, forwardedHeaders);
  if (upstream.body) {
    Readable.fromWeb(upstream.body).pipe(response);
    return;
  }

  response.end();
}

async function serveApp(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (!value || name === "host" || name === "connection" || name === "content-length") {
      continue;
    }

    headers.set(name, Array.isArray(value) ? value.join(",") : value);
  }

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request;
    init.duplex = "half";
  }

  const upstreamResponse = await appServer.fetch(new Request(url, init));
  const forwardedHeaders = {};

  for (const [name, value] of upstreamResponse.headers.entries()) {
    if (name === "transfer-encoding" || name === "connection" || name === "keep-alive") {
      continue;
    }
    forwardedHeaders[name] = value;
  }

  response.writeHead(upstreamResponse.status, forwardedHeaders);

  if (upstreamResponse.body) {
    Readable.fromWeb(upstreamResponse.body).pipe(response);
    return;
  }

  response.end();
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;

    if ((request.url ?? "").startsWith("/api/")) {
      await proxyApiRequest(request, response);
      return;
    }

    if (pathname.startsWith("/assets/") || pathname === "/placeholder.svg" || pathname === "/favicon.ico") {
      const served = await serveClientAsset(request, response);
      if (served) {
        return;
      }
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await serveApp(request, response);
      return;
    }

    sendText(response, 405, "Method Not Allowed");
  } catch (error) {
    console.error("Frontend server error:", error);
    sendText(response, 500, "Internal Server Error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontend server listening on http://0.0.0.0:${port}`);
});
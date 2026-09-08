import type { IncomingMessage, ServerResponse } from "node:http";

type ApiServerModule = {
  handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

let apiServerPromise: Promise<ApiServerModule> | null = null;

function loadApiServer(): Promise<ApiServerModule> {
  apiServerPromise ??= import("../apps/api/dist/server.js") as Promise<ApiServerModule>;
  return apiServerPromise;
}

function normalizeRequestUrl(request: IncomingMessage) {
  if (!request.url) return;
  request.url = request.url.replace(/^\/api(?=\/|$)/, "") || "/";

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname !== "/dispatch") return;

  request.url = normalizeDispatchTarget(url);
}

function normalizeDispatchTarget(url: URL) {
  const targetPath = url.searchParams.get("path") || "/";
  if (!targetPath.startsWith("/") || targetPath.startsWith("//")) return "/";

  const extraParams = new URLSearchParams(url.searchParams);
  extraParams.delete("path");
  const extraQuery = extraParams.toString();
  if (!extraQuery) return targetPath;

  return `${targetPath}${targetPath.includes("?") ? "&" : "?"}${extraQuery}`;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  normalizeRequestUrl(request);
  const { handleRequest } = await loadApiServer();
  await handleRequest(request, response);
}


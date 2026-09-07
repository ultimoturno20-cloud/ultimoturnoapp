import type { IncomingMessage, ServerResponse } from "node:http";

type ApiServerModule = {
  handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

let apiServerPromise: Promise<ApiServerModule> | null = null;

function loadApiServer(): Promise<ApiServerModule> {
  apiServerPromise ??= import("../apps/api/dist/server.js") as Promise<ApiServerModule>;
  return apiServerPromise;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.url) {
    request.url = request.url.replace(/^\/api(?=\/|$)/, "") || "/";
  }
  const { handleRequest } = await loadApiServer();
  await handleRequest(request, response);
}

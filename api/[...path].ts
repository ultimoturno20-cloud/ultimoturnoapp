import type { IncomingMessage, ServerResponse } from "node:http";
import { handleRequest } from "../apps/api/src/server";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.url) {
    request.url = request.url.replace(/^\/api(?=\/|$)/, "") || "/";
  }
  await handleRequest(request, response);
}

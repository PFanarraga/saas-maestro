import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { culqiWebhook } from "./payments";

const http = httpRouter();

auth.addHttpRoutes(http);

// Payment provider webhooks (Culqi)
http.route({
  path: "/webhooks/culqi",
  method: "POST",
  handler: culqiWebhook,
});

export default http;

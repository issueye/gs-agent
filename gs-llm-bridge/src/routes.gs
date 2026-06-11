import { createHealthController } from "@/controllers/health_controller";
import { createRuntimeController } from "@/controllers/runtime_controller";
import { createAdminController } from "@/controllers/admin_controller";
import { createProxyController } from "@/controllers/proxy_controller";

export function registerRoutes(app, model) {
  let health = createHealthController(model);
  let runtime = createRuntimeController(model);
  let admin = createAdminController(model);
  let proxy = createProxyController(model);

  app.get("/", health.index);
  app.get("/healthz", health.healthz);
  app.get("/readyz", health.readyz);

  app.post("/v1/messages", proxy.anthropic);
  app.post("/v1/chat/completions", proxy.openaiChat);
  app.post("/v1/responses", proxy.openaiResponses);

  app.get("/api/v1/runtime/state", admin.auth, runtime.state);
  app.get("/api/v1/runtime/route-plan", admin.auth, runtime.routePlan);
  app.get("/api/v1/providers", admin.auth, admin.listProviders);
  app.post("/api/v1/providers", admin.auth, admin.saveProvider);
  app.put("/api/v1/providers/:provider_id", admin.auth, admin.saveProvider);
  app.delete("/api/v1/providers/:provider_id", admin.auth, admin.deleteProvider);

  app.get("/api/v1/providers/:provider_id/models", admin.auth, admin.listProviderModels);
  app.post("/api/v1/providers/:provider_id/models", admin.auth, admin.saveProviderModel);
  app.put("/api/v1/providers/:provider_id/models/:id", admin.auth, admin.saveProviderModel);
  app.delete("/api/v1/providers/:provider_id/models/:id", admin.auth, admin.deleteProviderModel);

  app.get("/api/v1/ingress-endpoints", admin.auth, admin.listEndpoints);
  app.post("/api/v1/ingress-endpoints", admin.auth, admin.saveEndpoint);
  app.put("/api/v1/ingress-endpoints/:id", admin.auth, admin.saveEndpoint);
  app.delete("/api/v1/ingress-endpoints/:id", admin.auth, admin.deleteEndpoint);

  app.get("/api/v1/routing-rules", admin.auth, admin.listRoutingRules);
  app.post("/api/v1/routing-rules", admin.auth, admin.saveRoutingRule);
  app.put("/api/v1/routing-rules/:id", admin.auth, admin.saveRoutingRule);
  app.delete("/api/v1/routing-rules/:id", admin.auth, admin.deleteRoutingRule);

  app.get("/api/v1/api-keys", admin.auth, admin.listAPIKeys);
  app.get("/api/v1/api-keys/:id/secret", admin.auth, admin.apiKeySecret);
  app.post("/api/v1/api-keys", admin.auth, admin.createAPIKey);
  app.delete("/api/v1/api-keys/:id", admin.auth, admin.deleteAPIKey);

  app.get("/api/v1/traffic", admin.auth, admin.listTraffic);
  app.delete("/api/v1/traffic", admin.auth, admin.clearTraffic);

  app.all("*", proxy.dynamic);
}

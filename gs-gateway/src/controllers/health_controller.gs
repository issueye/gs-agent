import { ok } from "@/views/response";

export function createHealthController(model) {
  function health(req, res) {
    return ok(res, {
      service: "gs-gateway",
      status: "ok",
      time: (new Date()).toISOString(),
      agent: model.agent.summary(),
    });
  }

  return {
    health: health,
  };
}

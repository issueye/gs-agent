export function createHealthController(model) {
  function index(req, res) {
    return res.json({
      service: "gs-llm-bridge",
      status: "ok",
    });
  }

  function healthz(req, res) {
    return res.json({
      service: "gs-llm-bridge",
      status: "ok",
      time: (new Date()).toISOString(),
    });
  }

  function readyz(req, res) {
    return res.json({
      service: "gs-llm-bridge",
      status: "ready",
      providers: model.store.listProviders().length,
      started_at: model.startedAt,
    });
  }

  return {
    index: index,
    healthz: healthz,
    readyz: readyz,
  };
}

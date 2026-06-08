import { created, ok } from "@/views/response";

export function createIMController(model) {
  function inbound(req, res) {
    return created(res, model.receiveIM(req.body || {}));
  }

  function events(req, res) {
    return ok(res, model.store.listEvents(req.query.limit));
  }

  return {
    inbound: inbound,
    events: events,
  };
}

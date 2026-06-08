import { created, fail, ok } from "@/views/response";

export function createIMController(model) {
  function inbound(req, res) {
    return created(res, model.im.receive(req.body || {}));
  }

  function events(req, res) {
    return ok(res, model.store.listEvents(req.query.limit));
  }

  function createChannel(req, res) {
    return created(res, model.im.createChannel(req.body || {}));
  }

  function listChannels(req, res) {
    return ok(res, model.im.listChannels(req.query || {}));
  }

  function getChannel(req, res) {
    let channel = model.im.getChannel(req.params.id);
    if (!channel) {
      return fail(res, 404, "NOT_FOUND", "IM channel not found");
    }
    return ok(res, channel);
  }

  function updateChannel(req, res) {
    let channel = model.im.updateChannel(req.params.id, req.body || {});
    if (!channel) {
      return fail(res, 404, "NOT_FOUND", "IM channel not found");
    }
    return ok(res, channel);
  }

  function removeChannel(req, res) {
    let channel = model.im.removeChannel(req.params.id);
    if (!channel) {
      return fail(res, 404, "NOT_FOUND", "IM channel not found");
    }
    return ok(res, channel);
  }

  function listConversations(req, res) {
    return ok(res, model.im.listConversations(req.query || {}));
  }

  return {
    inbound: inbound,
    events: events,
    createChannel: createChannel,
    listChannels: listChannels,
    getChannel: getChannel,
    updateChannel: updateChannel,
    removeChannel: removeChannel,
    listConversations: listConversations,
  };
}

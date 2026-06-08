import { createAgentModel } from "@/models/agent";
import { createSkillsModel } from "@/models/skills";
import { createSchedulerModel } from "@/models/scheduler";
import { createAgentBridgeModel } from "@/models/agent_bridge";

export function createGatewayModel(config, store) {
  let agent = createAgentModel(config.gateway.agentRoot);

  function normalizeIMInput(input) {
    let value = input || {};
    return {
      source: "im",
      platform: String(value.platform || ""),
      adapter: String(value.adapter || ""),
      openId: String(value.openId || ""),
      sender: String(value.sender || ""),
      chat: String(value.chat || ""),
      replyTo: String(value.replyTo || value.chat || value.sender || ""),
      text: String(value.text || ""),
      raw: value,
    };
  }

  function receiveIM(input) {
    let normalized = normalizeIMInput(input);
    let subject = normalized.sender || normalized.openId || normalized.chat || "";
    let event = store.addEvent("im", "inbound_message", subject, normalized, "received");
    let task = store.createTask({
      name: "IM message from " + (subject || "unknown"),
      kind: "agent.im",
      status: "pending",
      payload: {
        eventId: event.id,
        im: normalized,
      },
    });
    return {
      event: event,
      task: task,
    };
  }

  function registerClient(kind, body) {
    let name = body.name || body.id || "default";
    let client = store.upsertClient(kind, name, body);
    store.addEvent("client", "register", client.id, body, "accepted");
    return client;
  }

  let gateway = {
    config: config,
    store: store,
    agent: agent,
    receiveIM: receiveIM,
    registerClient: registerClient,
  };
  gateway.skills = createSkillsModel(gateway);
  gateway.scheduler = createSchedulerModel(store);
  gateway.agentBridge = createAgentBridgeModel(gateway);
  return gateway;
}

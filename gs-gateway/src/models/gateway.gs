import { createAgentModel } from "@/models/agent";
import { createSkillsModel } from "@/models/skills";
import { createSchedulerModel } from "@/models/scheduler";
import { createAgentBridgeModel } from "@/models/agent_bridge";

export function createGatewayModel(config, store) {
  let agent = createAgentModel(config.gateway.agentRoot);

  function receiveIM(input) {
    let subject = input.sender || input.openId || input.chat || "";
    let event = store.addEvent("im", "inbound_message", subject, input, "received");
    let task = store.createTask({
      name: "IM message from " + (subject || "unknown"),
      kind: "agent.im",
      status: "pending",
      payload: {
        eventId: event.id,
        input: input,
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

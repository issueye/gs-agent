import { createAgentModel } from "@/models/agent";
import { createSkillsModel } from "@/models/skills";
import { createSchedulerModel } from "@/models/scheduler";
import { createAgentBridgeModel } from "@/models/agent_bridge";
import { createIMRuntime } from "@/models/im_runtime";
import { createWSHub } from "@/models/ws_hub";

export function createGatewayModel(config, store) {
  let agent = createAgentModel(config.gateway.agentRoot);

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
    registerClient: registerClient,
  };
  gateway.im = createIMRuntime(gateway);
  gateway.receiveIM = gateway.im.receive;
  gateway.skills = createSkillsModel(gateway);
  gateway.scheduler = createSchedulerModel(store);
  gateway.agentBridge = createAgentBridgeModel(gateway);
  gateway.wsHub = createWSHub(gateway);
  return gateway;
}

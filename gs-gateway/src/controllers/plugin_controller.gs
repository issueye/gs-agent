import { ok, created } from "@/views/response";

export function createPluginController(model) {
  function plugins(req, res) {
    return ok(res, model.agent.listPlugins());
  }

  function tools(req, res) {
    return ok(res, model.agent.listDynamicTools());
  }

  function registerPlugin(req, res) {
    return created(res, model.registerClient("plugin", req.body || {}));
  }

  return {
    plugins: plugins,
    tools: tools,
    registerPlugin: registerPlugin,
  };
}

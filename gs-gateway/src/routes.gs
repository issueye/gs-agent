import { createHealthController } from "@/controllers/health_controller";
import { createAgentController } from "@/controllers/agent_controller";
import { createIMController } from "@/controllers/im_controller";
import { createSkillController } from "@/controllers/skill_controller";
import { createSkillAdminController } from "@/controllers/skill_admin_controller";
import { createPluginController } from "@/controllers/plugin_controller";
import { createTaskController } from "@/controllers/task_controller";
import { createSchedulerController } from "@/controllers/scheduler_controller";
import { createAgentBridgeController } from "@/controllers/agent_bridge_controller";

export function registerRoutes(app, model) {
  let health = createHealthController(model);
  let agent = createAgentController(model);
  let im = createIMController(model);
  let skills = createSkillController(model);
  let skillAdmin = createSkillAdminController(model);
  let plugins = createPluginController(model);
  let tasks = createTaskController(model);
  let scheduler = createSchedulerController(model.scheduler);
  let bridge = createAgentBridgeController(model.agentBridge);

  app.get("/health", health.health);

  app.get("/api/agent", agent.summary);
  app.get("/api/agent/sessions", agent.sessions);
  app.get("/api/agent/current-session", agent.currentSession);

  app.post("/api/im/inbound", im.inbound);
  app.get("/api/events", im.events);

  app.get("/api/skills", skills.list);
  app.post("/api/skills", skillAdmin.create);
  app.get("/api/skills/:name", skills.get);
  app.put("/api/skills/:name", skillAdmin.update);
  app.delete("/api/skills/:name", skillAdmin.remove);

  app.get("/api/plugins", plugins.plugins);
  app.post("/api/plugins/register", plugins.registerPlugin);
  app.get("/api/tools", plugins.tools);

  app.get("/api/tasks", tasks.list);
  app.post("/api/tasks", tasks.create);
  app.get("/api/tasks/:id", tasks.get);
  app.patch("/api/tasks/:id", tasks.update);
  app.post("/api/tasks/:id/run", bridge.run);

  app.get("/api/schedules", scheduler.list);
  app.post("/api/schedules", scheduler.create);
  app.post("/api/schedules/run-due", scheduler.runDue);
  app.get("/api/schedules/:id", scheduler.get);
  app.patch("/api/schedules/:id", scheduler.update);
  app.delete("/api/schedules/:id", scheduler.remove);
}

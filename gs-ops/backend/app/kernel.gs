import { ConfigManager } from "../services/ConfigManager.gs";
import { LogManager } from "../services/LogManager.gs";
import { ProcessManager } from "../services/ProcessManager.gs";
import { ServiceManager } from "../services/ServiceManager.gs";
import { VersionManager } from "../services/VersionManager.gs";
import { ServiceController } from "../controllers/ServiceController.gs";
import { MonitorController } from "../controllers/MonitorController.gs";
import { LogController } from "../controllers/LogController.gs";
import { ConfigController } from "../controllers/ConfigController.gs";
import { VersionController } from "../controllers/VersionController.gs";
import { ActionController } from "../controllers/ActionController.gs";

export class Kernel {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.configManager = new ConfigManager(rootDir);
    this.logManager = new LogManager();
    this.processManager = new ProcessManager();
    this.serviceManager = new ServiceManager(this.configManager, this.logManager, this.processManager);
    this.versionManager = new VersionManager(this.logManager, this.serviceManager);
  }

  controllers() {
    return {
      serviceController: new ServiceController(this.serviceManager),
      monitorController: new MonitorController(this.serviceManager),
      logController: new LogController(this.logManager),
      configController: new ConfigController(),
      versionController: new VersionController(this.versionManager),
      actionController: new ActionController(this.serviceManager, this.versionManager),
    };
  }
}

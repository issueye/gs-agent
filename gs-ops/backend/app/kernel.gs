import { ConfigManager } from "../services/ConfigManager.gs";
import { LogManager } from "../services/LogManager.gs";
import { ProcessManager } from "../services/ProcessManager.gs";
import { ServiceManager } from "../services/ServiceManager.gs";
import { VersionManager } from "../services/VersionManager.gs";
import { UserManager } from "../services/UserManager.gs";
import { ServiceController } from "../controllers/ServiceController.gs";
import { MonitorController } from "../controllers/MonitorController.gs";
import { LogController } from "../controllers/LogController.gs";
import { ConfigController } from "../controllers/ConfigController.gs";
import { VersionController } from "../controllers/VersionController.gs";
import { ActionController } from "../controllers/ActionController.gs";
import { AuthController } from "../controllers/AuthController.gs";
import { UserController } from "../controllers/UserController.gs";

export class Kernel {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.configManager = new ConfigManager(rootDir);
    this.logManager = new LogManager();
    this.processManager = new ProcessManager();
    this.serviceManager = new ServiceManager(this.configManager, this.logManager, this.processManager);
    this.versionManager = new VersionManager(this.logManager, this.serviceManager);
    this.userManager = new UserManager();
  }

  controllers() {
    return {
      serviceController: new ServiceController(this.serviceManager),
      monitorController: new MonitorController(this.serviceManager),
      logController: new LogController(this.logManager),
      configController: new ConfigController(),
      versionController: new VersionController(this.versionManager),
      actionController: new ActionController(this.serviceManager, this.versionManager),
      authController: new AuthController(this.userManager),
      userController: new UserController(this.userManager),
    };
  }

  // 初始化系统（创建默认管理员）
  initialize() {
    this.userManager.initDefaultAdmin();
  }
}

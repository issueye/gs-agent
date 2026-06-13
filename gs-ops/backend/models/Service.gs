export class Service {
  constructor(input) {
    this.id = input.id;
    this.name = input.name;
    this.displayName = input.display_name || input.displayName;
    this.description = input.description;
    this.version = input.version;
    this.status = input.status;
    this.type = input.type;
    this.installPath = input.install_path || input.installPath;
    this.configPath = input.config_path || input.configPath;
    this.logPath = input.log_path || input.logPath;
    this.port = input.port;
    this.pid = input.pid;
    this.uptime = input.uptime || 0;
    this.startedAt = input.started_at || input.startedAt || null;
    this.autoStart = input.auto_start === 1 || input.autoStart === true;
    this.dependencies = this.parseJsonField(input.dependencies, []);
    this.commands = this.parseJsonField(input.commands, {});
    this.environment = this.parseJsonField(input.environment, {});
    this.healthCheck = this.parseJsonField(input.health_check || input.healthCheck, { enabled: false });
    this.createdAt = input.created_at || input.createdAt;
    this.updatedAt = input.updated_at || input.updatedAt;
  }

  parseJsonField(value, defaultValue) {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (e) {
        return defaultValue;
      }
    }
    return value;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      version: this.version,
      status: this.status,
      type: this.type,
      installPath: this.installPath,
      configPath: this.configPath,
      logPath: this.logPath,
      port: this.port,
      pid: this.pid,
      uptime: this.uptime,
      startedAt: this.startedAt,
      autoStart: this.autoStart,
      dependencies: this.dependencies,
      commands: this.commands,
      environment: this.environment,
      healthCheck: this.healthCheck,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDBRecord() {
    return {
      id: this.id,
      name: this.name,
      display_name: this.displayName,
      description: this.description,
      version: this.version,
      status: this.status,
      type: this.type,
      install_path: this.installPath,
      config_path: this.configPath,
      log_path: this.logPath,
      port: this.port,
      pid: this.pid,
      uptime: this.uptime,
      started_at: this.startedAt,
      auto_start: this.autoStart ? 1 : 0,
      dependencies: JSON.stringify(this.dependencies),
      commands: JSON.stringify(this.commands),
      environment: JSON.stringify(this.environment),
      health_check: JSON.stringify(this.healthCheck),
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }

  static fromDBRecord(record) {
    if (record === null) {
      return null;
    }
    return new Service(record);
  }
}

export class ServiceConfig {
  constructor(input) {
    this.serviceId = input.serviceId || input.service_id;
    this.name = input.name;
    this.commands = input.commands || {};
    this.environment = input.environment || {};
    this.healthCheck = input.healthCheck || input.health_check || { enabled: false };
  }

  toJSON() {
    return {
      serviceId: this.serviceId,
      name: this.name,
      commands: this.commands,
      environment: this.environment,
      healthCheck: this.healthCheck,
    };
  }
}


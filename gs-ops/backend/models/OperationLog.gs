export class OperationLog {
  constructor(input) {
    this.id = input.id;
    this.serviceId = input.service_id || input.serviceId;
    this.operation = input.operation;
    this.status = input.status;
    this.message = input.message;
    this.operator = input.operator;
    this.timestamp = input.timestamp;
  }

  toJSON() {
    return {
      id: this.id,
      serviceId: this.serviceId,
      operation: this.operation,
      status: this.status,
      message: this.message,
      operator: this.operator,
      timestamp: this.timestamp,
    };
  }

  toDBRecord() {
    return {
      service_id: this.serviceId,
      operation: this.operation,
      status: this.status,
      message: this.message,
      operator: this.operator,
      timestamp: this.timestamp,
    };
  }

  static fromDBRecord(record) {
    if (record === null) {
      return null;
    }
    return new OperationLog(record);
  }
}

import { getDatabase } from "../config/database.gs";
import { OperationLog } from "../models/OperationLog.gs";
import { nowIso } from "../utils/system.gs";

export class LogManager {
  constructor() {
    this.db = getDatabase();
  }

  list(serviceId = null, query = "") {
    let queryBuilder = this.db.table("operation_logs");

    if (serviceId !== null) {
      queryBuilder = queryBuilder.where("service_id = ?", serviceId);
    }

    if (query) {
      let needle = "%" + String(query).toLowerCase() + "%";
      queryBuilder = queryBuilder.where(
        "(LOWER(service_id) LIKE ? OR LOWER(operation) LIKE ? OR LOWER(status) LIKE ? OR LOWER(message) LIKE ? OR LOWER(operator) LIKE ?)",
        needle,
        needle,
        needle,
        needle,
        needle
      );
    }

    let records = queryBuilder.orderBy("timestamp DESC").limit(500).find();
    return records.map((record) => OperationLog.fromDBRecord(record).toJSON());
  }

  clear(serviceId = null, operator = "admin") {
    let result;
    if (serviceId === null) {
      result = this.db.table("operation_logs").delete();
    } else {
      result = this.db.table("operation_logs").where("service_id = ?", serviceId).delete();
    }

    let removed = result.rowsAffected || 0;
    this.record(
      serviceId || "system",
      "logs.clear",
      "success",
      "cleared " + String(removed) + " log entries",
      operator
    );

    return { removed: removed };
  }

  record(serviceId, operation, status, message, operator) {
    let log = new OperationLog({
      serviceId: serviceId,
      operation: operation,
      status: status,
      message: message,
      operator: operator,
      timestamp: nowIso(),
    });

    this.db.table("operation_logs").insert(log.toDBRecord());
    return log.toJSON();
  }
}

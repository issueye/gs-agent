function nowIso() {
  return (new Date()).toISOString();
}

function isoAt(value) {
  if (!value) {
    return "";
  }
  return (new Date(value)).toISOString();
}

function addMilliseconds(value, milliseconds) {
  return (new Date((new Date(value)).getTime() + milliseconds)).toISOString();
}

function pad2(value) {
  let n = Number(value || 0);
  if (n < 10) {
    return "0" + String(n);
  }
  return String(n);
}

function dailyNextRunAt(schedule, baseIso) {
  let parts = String(schedule.timeOfDay || schedule.time || "09:00").split(":");
  let hour = Number(parts[0] || 0);
  let minute = Number(parts[1] || 0);
  let second = Number(parts[2] || 0);
  let base = new Date(baseIso || nowIso());
  let day = base.toISOString().slice(0, 10);
  let candidate = new Date(day + "T" + pad2(hour) + ":" + pad2(minute) + ":" + pad2(second) + ".000Z");
  if (candidate.toISOString() <= base.toISOString()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return candidate.toISOString();
}

function nextRunAfter(schedule, baseIso) {
  let type = schedule.type || "manual";
  if (type === "manual") {
    return "";
  }
  if (type === "at") {
    return "";
  }
  if (type === "interval") {
    let every = Number(schedule.everySeconds || 0) * 1000;
    if (!every) {
      every = Number(schedule.everyMinutes || schedule.intervalMinutes || 1) * 60 * 1000;
    }
    return addMilliseconds(baseIso || nowIso(), every);
  }
  if (type === "daily") {
    return dailyNextRunAt(schedule, baseIso);
  }
  return "";
}

function initialNextRunAt(schedule, baseIso) {
  let type = schedule.type || "manual";
  if (type === "manual") {
    return "";
  }
  if (type === "at") {
    return isoAt(schedule.at || schedule.runAt || schedule.nextRunAt || schedule.dueAt);
  }
  if (schedule.nextRunAt) {
    return isoAt(schedule.nextRunAt);
  }
  return nextRunAfter(schedule, baseIso);
}

function normalizeSchedule(input, existing, baseIso) {
  let value = input || {};
  let prior = existing || {};
  let type = String(value.type || prior.type || (value.dueAt ? "at" : "manual"));
  let schedule = {};
  for (let key in prior) {
    schedule[key] = prior[key];
  }
  for (let key in value) {
    schedule[key] = value[key];
  }
  schedule.type = type;
  schedule.nextRunAt = initialNextRunAt(schedule, baseIso);
  return schedule;
}

function normalizeRun(input, existing) {
  let value = input || {};
  let prior = existing || {};
  return {
    prompt: String(("prompt" in value) ? value.prompt : (prior.prompt || "")),
    model: String(("model" in value) ? value.model : (prior.model || "auto")),
    mode: String(("mode" in value) ? value.mode : (prior.mode || "agent")),
    workspaceRoot: String(("workspaceRoot" in value) ? value.workspaceRoot : (prior.workspaceRoot || "")),
    reasoningEffort: String(("reasoningEffort" in value) ? value.reasoningEffort : (prior.reasoningEffort || "medium")),
  };
}

function normalizeLast(input, existing) {
  let value = input || {};
  let prior = existing || {};
  return {
    status: String(("status" in value) ? value.status : (prior.status || "idle")),
    runAt: String(("runAt" in value) ? value.runAt : (prior.runAt || "")),
    taskId: String(("taskId" in value) ? value.taskId : (prior.taskId || "")),
    message: String(("message" in value) ? value.message : (prior.message || "")),
  };
}

function normalizePayload(input, existing) {
  let value = input || {};
  let prior = existing || {};
  let payload = {};
  for (let key in prior) {
    if (key !== "run" && key !== "last") {
      payload[key] = prior[key];
    }
  }
  for (let key in value) {
    if (key !== "run" && key !== "last") {
      payload[key] = value[key];
    }
  }
  return payload;
}

function scheduleRecord(record) {
  if (!record) {
    return undefined;
  }
  let payload = record.payload || {};
  record.run = normalizeRun(payload.run || {}, {});
  record.last = normalizeLast(payload.last || {}, {});
  return record;
}

function scheduleRecords(records) {
  let out = [];
  for (let record of records || []) {
    out.push(scheduleRecord(record));
  }
  return out;
}

function taskPrompt(schedule) {
  if (schedule.run && schedule.run.prompt) {
    return schedule.run.prompt;
  }
  return "";
}

function buildTaskPayload(schedule, runAt, reason) {
  let text = taskPrompt(schedule);
  return {
    source: {
      type: "schedule",
      scheduleId: schedule.id,
      reason: reason || "tick",
    },
    input: {
      text: text,
      displayText: text,
      schedule: {
        id: schedule.id,
        name: schedule.name,
        kind: schedule.kind,
        schedule: schedule.schedule || {},
      },
    },
    run: normalizeRun(schedule.run || {}, {}),
    payload: schedule.payload || {},
    scheduleId: schedule.id,
    runAt: runAt,
  };
}

function patchAfterQueued(schedule, task, runAt, reason) {
  let payload = normalizePayload(schedule.payload || {}, {});
  payload.run = normalizeRun(schedule.run || {}, {});
  payload.last = {
    status: "queued",
    runAt: runAt,
    taskId: task.id,
    message: "",
  };

  let nextSchedule = {};
  for (let key in schedule.schedule || {}) {
    nextSchedule[key] = schedule.schedule[key];
  }

  let status = schedule.status;
  if (reason === "tick") {
    nextSchedule.nextRunAt = nextRunAfter(nextSchedule, runAt);
    if (nextSchedule.type === "at") {
      status = "inactive";
    }
  }

  return {
    status: status,
    schedule: nextSchedule,
    payload: payload,
  };
}

export function createSchedulerModel(store) {
  function create(input) {
    let value = input || {};
    let payload = normalizePayload(value.payload || {}, {});
    payload.run = normalizeRun(value.run || payload.run || {}, {});
    payload.last = normalizeLast(value.last || payload.last || {}, {});
    return scheduleRecord(store.createSchedule({
      name: value.name || "schedule",
      kind: value.kind || "agent.schedule",
      status: value.status || "active",
      schedule: normalizeSchedule(value.schedule || {}, {}, nowIso()),
      payload: payload,
    }));
  }

  function list(options) {
    let query = options || {};
    return scheduleRecords(store.listSchedules(query.status, query.limit));
  }

  function get(id) {
    return scheduleRecord(store.getSchedule(id));
  }

  function update(id, patch) {
    let existing = get(id);
    if (!existing) {
      return undefined;
    }
    let value = patch || {};
    let payload = normalizePayload(("payload" in value) ? value.payload : existing.payload, existing.payload);
    payload.run = normalizeRun(value.run || payload.run || {}, existing.run);
    payload.last = normalizeLast(value.last || payload.last || {}, existing.last);
    return scheduleRecord(store.updateSchedule(id, {
      name: value.name || existing.name,
      kind: value.kind || existing.kind,
      status: value.status || existing.status,
      schedule: normalizeSchedule(("schedule" in value) ? value.schedule : existing.schedule, existing.schedule, nowIso()),
      payload: payload,
    }));
  }

  function remove(id) {
    return scheduleRecord(store.removeSchedule(id));
  }

  function createRunTask(schedule, options, reason) {
    let query = options || {};
    let runAt = isoAt(query.now || nowIso());
    let task = store.createTask({
      name: schedule.name,
      kind: "agent.schedule",
      status: "pending",
      schedule: runAt,
      payload: buildTaskPayload(schedule, runAt, reason),
    });
    let updated = scheduleRecord(store.updateSchedule(schedule.id, patchAfterQueued(schedule, task, runAt, reason)));
    return {
      schedule: updated,
      task: task,
    };
  }

  function tick(options) {
    let query = options || {};
    let dueAt = isoAt(query.now || nowIso());
    let limit = Number(query.limit || 50);
    let schedules = store.listSchedules("active", limit * 4);
    let runs = [];
    for (let item of schedules) {
      let schedule = scheduleRecord(item);
      if (schedule.schedule.type === "manual") {
        continue;
      }
      if (!schedule.schedule.nextRunAt) {
        schedule = update(schedule.id, { schedule: schedule.schedule });
      }
      if (schedule.schedule.nextRunAt && String(schedule.schedule.nextRunAt) <= dueAt) {
        runs.push(createRunTask(schedule, { now: dueAt }, "tick"));
      }
      if (runs.length >= limit) {
        break;
      }
    }
    return {
      now: dueAt,
      count: runs.length,
      schedules: runs.map(function(item) {
        return item.schedule;
      }),
      tasks: runs.map(function(item) {
        return item.task;
      }),
    };
  }

  function run(id, options) {
    let schedule = get(id);
    if (!schedule) {
      return undefined;
    }
    return createRunTask(schedule, options || {}, "manual");
  }

  function status() {
    let schedules = scheduleRecords(store.listSchedules(undefined, 10000));
    let active = 0;
    let nextRunAt = "";
    for (let schedule of schedules) {
      if (schedule.status === "active") {
        active = active + 1;
        if (schedule.schedule && schedule.schedule.nextRunAt) {
          if (!nextRunAt || String(schedule.schedule.nextRunAt) < nextRunAt) {
            nextRunAt = String(schedule.schedule.nextRunAt);
          }
        }
      }
    }
    return {
      total: schedules.length,
      active: active,
      nextRunAt: nextRunAt,
    };
  }

  return {
    create: create,
    list: list,
    get: get,
    update: update,
    remove: remove,
    tick: tick,
    run: run,
    status: status,
  };
}

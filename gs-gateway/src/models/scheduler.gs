export function createSchedulerModel(store) {
  function create(input) {
    return store.createSchedule(input || {});
  }

  function list(options) {
    let query = options || {};
    return store.listSchedules(query.status, query.limit);
  }

  function get(id) {
    return store.getSchedule(id);
  }

  function update(id, patch) {
    return store.updateSchedule(id, patch || {});
  }

  function remove(id) {
    return store.removeSchedule(id);
  }

  function dueToTasks(options) {
    let query = options || {};
    let due = store.listDueSchedules(query.now || (new Date()).toISOString(), query.limit);
    let tasks = [];
    for (let schedule of due) {
      let task = store.createTask({
        name: schedule.name,
        kind: schedule.kind,
        status: "pending",
        schedule: schedule.schedule.dueAt || "",
        payload: {
          scheduleId: schedule.id,
          payload: schedule.payload || {},
        },
      });
      store.updateSchedule(schedule.id, { status: "queued" });
      tasks.push(task);
    }
    return {
      schedules: due,
      tasks: tasks,
    };
  }

  return {
    create: create,
    list: list,
    get: get,
    update: update,
    remove: remove,
    dueToTasks: dueToTasks,
  };
}

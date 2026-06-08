import { fetchJSON } from './http'

export async function listScheduledTasks(baseUrl) {
  const payload = await fetchJSON(baseUrl, '/api/schedules')
  return (Array.isArray(payload) ? payload : payload?.schedules || payload?.tasks || []).map(normalizeTask)
}

export async function listScheduledTaskRuns(baseUrl, taskId) {
  void taskId
  const payload = await fetchJSON(baseUrl, '/api/tasks')
  return (Array.isArray(payload) ? payload : payload?.tasks || []).map(normalizeTaskRun)
}

export async function createScheduledTask(baseUrl, input) {
  const payload = await fetchJSON(baseUrl, '/api/schedules', {
    method: 'POST',
    body: taskPayload(input, { includeId: true }),
  })
  return normalizeTask(payload)
}

export async function updateScheduledTask(baseUrl, taskId, input) {
  const payload = await fetchJSON(baseUrl, `/api/schedules/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: taskPayload(input),
  })
  return normalizeTask(payload)
}

export async function deleteScheduledTask(baseUrl, taskId) {
  await fetchJSON(baseUrl, `/api/schedules/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  })
}

function taskPayload(input, options = {}) {
  const body = {
    name: input.name || '',
    description: input.description || '',
    agent_id: input.agentId || '',
    scheduleType: input.scheduleType || 'interval',
    scheduleValue: input.scheduleValue || '',
    actionType: input.actionType || 'webhook',
    payload: parsePayload(input.payloadText),
    enabled: Boolean(input.enabled),
  }
  if (options.includeId) {
    body.id = input.id || ''
  }
  return body
}

function parsePayload(value) {
  const text = String(value || '').trim()
  if (!text) {
    return {}
  }
  return JSON.parse(text)
}

function normalizeTask(task) {
  return {
    id: task.id,
    name: task.name,
    description: task.description || '',
    agentId: task.agent_id || task.agentId || '',
    scheduleType: task.schedule_type || task.scheduleType || task.type || 'interval',
    scheduleValue: task.schedule_value || task.scheduleValue || task.schedule || '',
    actionType: task.action_type || task.actionType || 'prompt',
    payload: task.payload || {},
    payloadText: JSON.stringify(task.payload || {}, null, 2),
    enabled: Boolean(task.enabled),
    status: task.status || (task.enabled === false ? 'paused' : 'active'),
    lastRunAt: task.last_run_at || task.lastRunAt || '',
    nextRunAt: task.next_run_at || task.nextRunAt || '',
    runCount: task.run_count || task.runCount || 0,
    lastError: task.last_error || task.lastError || '',
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  }
}

function normalizeTaskRun(run) {
  return {
    id: run.id,
    taskId: run.task_id || run.taskId || run.id,
    agentId: run.agent_id || run.agentId || '',
    status: run.status || '',
    summary: run.summary || '',
    error: run.error || '',
    executedAt: run.executed_at || '',
    createdAt: run.created_at || '',
    updatedAt: run.updated_at || '',
  }
}

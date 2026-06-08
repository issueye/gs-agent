import { ok, fail } from "@/views/response";

export function createAgentController(model) {
  function summary(req, res) {
    return ok(res, model.agent.summary());
  }

  function sessions(req, res) {
    return ok(res, model.agent.listSessions(req.query.limit));
  }

  function currentSession(req, res) {
    let session = model.agent.currentSession();
    if (!session) {
      return fail(res, 404, "NOT_FOUND", "current agent session not found");
    }
    return ok(res, session);
  }

  return {
    summary: summary,
    sessions: sessions,
    currentSession: currentSession,
  };
}

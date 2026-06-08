# gs-agent / gs-gateway Redundancy Reduction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce high-risk duplication between `gs-agent` and `gs-gateway` without changing the public gateway API.

**Architecture:** Keep `gs-gateway` as the HTTP, SQLite, scheduling, and dispatch control plane. Move duplicated agent-owned semantics toward `gs-agent` helper modules, and let gateway import or call those helpers for skill rules and IM prompt generation. Keep generated artifacts out of source control.

**Tech Stack:** GoScript, `@std/fs`, `@std/path`, `@std/runtime`, SQLite gateway store, existing smoke tests.

---

### Task 1: Centralize Skill Document Rules

**Files:**
- Modify: `gs-agent/gs-agent/src/agent/tools/skills.gs`
- Modify: `gs-agent/gs-gateway/src/models/skills.gs`
- Modify: `gs-agent/gs-gateway/src/models/agent.gs`
- Test: `gs-agent/gs-gateway/smoke-test.gs`

**Steps:**
1. Export skill name normalization, frontmatter parsing, and skill document rendering from the agent skill tool module.
2. Update gateway skill admin model to use those exported helpers.
3. Update gateway agent summary model to parse `SKILL.md` with the same parser used for writes.
4. Add smoke assertions that gateway rejects an empty skill description and too-long skill names.
5. Run gateway smoke test.

**Expected Result:** Gateway can no longer create skills that agent discovery rejects.

### Task 2: Preserve IM Semantics Across Gateway Dispatch

**Files:**
- Modify: `gs-agent/gs-gateway/src/models/gateway.gs`
- Modify: `gs-agent/gs-agent/gateway-task.gs`
- Test: `gs-agent/gs-gateway/smoke-test.gs`

**Steps:**
1. Keep the existing `POST /api/im/inbound` response shape.
2. Ensure created `agent.im` tasks store a normalized `input` payload with platform, adapter, sender, chat, reply target, and text.
3. Update `gateway-task.gs` to call `imMessagePrompt` for `agent.im` payloads.
4. Keep non-IM tasks using the existing text extraction fallback.
5. Add smoke assertions for the task payload shape.

**Expected Result:** Gateway-dispatched IM tasks reach `gs-agent` with the same prompt context as the direct IM plugin bridge.

### Task 3: Extract Agent Run Completion Helpers

**Files:**
- Modify: `gs-agent/gs-agent/src/agent/app.gs`

**Steps:**
1. Add private helpers for run start log fields and run completion.
2. Refactor `runAgentTask` and `runAgentTurn` to share answer file writing, session event counting, return shape, and failure logging.
3. Preserve session creation behavior: task runs start a new session; turn runs reuse the current session.
4. Run available agent entry smoke tests if present; otherwise run gateway smoke test to exercise `runAgentTask` failure path.

**Expected Result:** CLI, TUI, and gateway agent dispatch keep the same public return fields while reducing duplicated finish logic.

### Task 4: Stop Tracking Generated Gateway Artifacts

**Files:**
- Modify: `gs-agent/.gitignore`
- Git index: `gs-gateway/dist/gs-gateway.exe`, `gs-gateway/dist/gateway.toml`

**Steps:**
1. Add generated directories and local runtime files to `.gitignore`.
2. Remove tracked generated gateway dist files from the Git index while leaving local files intact.
3. Verify `git status --short` shows only source/docs changes and deleted-index entries for generated files.

**Expected Result:** Future builds do not create noisy executable/config diffs.

### Verification

Run:

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s smoke-test.gs
```

from `gs-agent/gs-gateway` when the local interpreter is available. If the local model config is absent, bridge execution may fail, but the smoke test expects that failure to be persisted.

function includes(list, value) {
  if (!list) {
    return false;
  }
  for (let item of list) {
    if (item === value) {
      return true;
    }
  }
  return false;
}

function blockedChildTool(tool) {
  return tool === "create_skill" || tool === "run_subagent" || tool === "run_skill";
}

export function childAgentTools(parentTools, requested) {
  let source = requested;
  if (!source) {
    source = parentTools;
  }
  if (!source) {
    source = [];
  }
  if (source.length === 0) {
    source = parentTools;
  }
  if (!source) {
    source = [];
  }

  let out = [];
  for (let tool of source) {
    if (blockedChildTool(tool)) {
      continue;
    }
    if (!includes(parentTools, tool)) {
      throw new ReferenceError("child agent tool is not enabled for parent agent: " + tool);
    }
    if (!includes(out, tool)) {
      out.push(tool);
    }
  }
  return out;
}

function isSkillNameChar(ch) {
  return (ch >= "a" && ch <= "z")
    || (ch >= "0" && ch <= "9")
    || ch === "-";
}

export function normalizeSkillName(name) {
  let value = String(name || "").trim();
  if (value === "") {
    throw new TypeError("skill name is required");
  }
  if (value.length > 64) {
    throw new TypeError("skill name must be at most 64 characters");
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    throw new TypeError("skill name cannot start or end with hyphen");
  }

  let out = "";
  for (let i = 0; i < value.length; i = i + 1) {
    let ch = value[i];
    if (!isSkillNameChar(ch)) {
      throw new TypeError("skill name may only contain lowercase letters, numbers, and hyphen");
    }
    out = out + ch;
  }

  if (out === "." || out === "..") {
    throw new TypeError("invalid skill name: " + out);
  }
  return out;
}

export function normalizeSkillDescription(description) {
  let value = String(description || "").trim();
  if (value === "") {
    throw new TypeError("skill description is required");
  }
  return value;
}

function yamlString(value) {
  return "\"" + String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ") + "\"";
}

export function defaultSkillContent(name, description) {
  let title = name;
  let intro = "Use this skill when the user's request matches the description in the frontmatter.";
  if (description && description.trim() !== "") {
    intro = description.trim();
  }
  return "# " + title + "\n\n" + intro + "\n\n## Instructions\n\n- Describe the concrete workflow for this skill.\n- Keep guidance concise and procedural.\n- Reference bundled scripts, references, or assets only when they are needed.\n";
}

function hasFrontmatter(content) {
  return String(content || "").replaceAll("\r\n", "\n").startsWith("---\n");
}

function parseScalar(value) {
  let text = String(value || "").trim();
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, text.length - 1);
  }
  return text;
}

export function parseSkillDocument(content) {
  let text = String(content || "").replaceAll("\r\n", "\n");
  if (!hasFrontmatter(text)) {
    return {
      metadata: {},
      body: text,
    };
  }

  let end = text.indexOf("\n---", 4);
  if (end < 0) {
    throw new TypeError("skill content frontmatter is not closed");
  }

  let metadata = {};
  let lines = text.slice(4, end).split("\n");
  for (let line of lines) {
    let trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    let colon = trimmed.indexOf(":");
    if (colon < 0) {
      continue;
    }
    metadata[trimmed.slice(0, colon).trim()] = parseScalar(trimmed.slice(colon + 1));
  }

  let body = text.slice(end + 4);
  while (body.startsWith("\n")) {
    body = body.slice(1);
  }
  return {
    metadata: metadata,
    body: body,
  };
}

export function bodyWithoutFrontmatter(content) {
  return parseSkillDocument(content).body;
}

export function skillDocument(name, description, content) {
  let body = bodyWithoutFrontmatter(content).trim();
  if (!body || body === "") {
    body = defaultSkillContent(name, description).trim();
  }
  return "---\n"
    + "name: " + yamlString(name) + "\n"
    + "description: " + yamlString(description) + "\n"
    + "---\n\n"
    + body + "\n";
}

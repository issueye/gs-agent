export function requireFields(input, fields) {
  let missing = [];

  for (let field of fields) {
    if (!(field in input) || input[field] === null || input[field] === undefined || input[field] === "") {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing: missing,
  };
}

export function isKnownServiceStatus(status) {
  return status === "running" || status === "stopped" || status === "error" || status === "installing";
}


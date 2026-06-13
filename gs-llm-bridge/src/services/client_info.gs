export function headerValue(req, name) {
  let headers = req.headers || {};
  let expected = String(name || "").toLowerCase();
  for (let key in headers) {
    if (String(key).toLowerCase() === expected) {
      return String(headers[key] || "");
    }
  }
  return "";
}

export function clientIP(req) {
  let remote = String((req || {}).remoteAddr || "").trim();
  if (remote.startsWith("[")) {
    let end = remote.indexOf("]");
    if (end > 0) {
      return remote.slice(1, end);
    }
  }
  let colon = remote.lastIndexOf(":");
  if (colon > 0 && remote.indexOf(":") === colon) {
    return remote.slice(0, colon);
  }
  return remote;
}

export function isLoopback(req) {
  let ip = clientIP(req);
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

export function apiKey(req) {
  let key = headerValue(req, "x-api-key");
  if (String(key || "").trim() !== "") {
    return String(key).trim();
  }
  let auth = headerValue(req, "authorization");
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

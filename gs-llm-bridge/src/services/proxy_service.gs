import { ProtocolAnthropic, joinUpstreamURL } from "@/services/protocols";
import { convertRequest, convertResponse, extractUsage } from "@/services/converters";

let http = require("@std/net/http/client");
let crypto = require("@std/crypto");

function nowMillis() {
  return Number((new Date()).getTime());
}

function requestID() {
  return "req-" + crypto.randomUUID();
}

function extractAPIKey(req) {
  let headers = req.headers || {};
  let key = headers["x-api-key"] || headers["X-API-Key"] || "";
  if (String(key || "").trim() !== "") {
    return String(key).trim();
  }
  let auth = String(headers.authorization || headers.Authorization || "");
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function requestModel(body) {
  if (!body) {
    return "";
  }
  return String(body.model || "").trim();
}

function proxyError(res, protocol, status, message) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (protocol === ProtocolAnthropic) {
    return res.status(status).json({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: message,
      },
    });
  }
  return res.status(status).json({
    error: {
      type: "invalid_request_error",
      message: message,
    },
  });
}

function upstreamHeaders(route, req) {
  let headers = {
    "Content-Type": "application/json",
  };
  let accept = (req.headers || {}).accept || (req.headers || {}).Accept || "";
  if (String(accept || "") !== "") {
    headers.Accept = accept;
  }
  if (route.upstream_protocol === ProtocolAnthropic) {
    headers["x-api-key"] = route.provider.api_key || "";
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers.Authorization = "Bearer " + String(route.provider.api_key || "");
  }
  if (String(route.provider.user_agent || "") !== "") {
    headers["User-Agent"] = route.provider.user_agent;
  }
  return headers;
}

function responseBodyJSON(body) {
  if (!body) {
    return undefined;
  }
  if (typeof body !== "string") {
    return body;
  }
  try {
    return JSON.parse(body);
  } catch (err) {
    return undefined;
  }
}

function bodyPreview(config, body) {
  let text = "";
  if (body === undefined || body === null) {
    return {
      request_body: "",
      request_body_bytes: 0,
      request_body_truncated: false,
    };
  }
  try {
    text = JSON.stringify(body);
  } catch (err) {
    text = String(body || "");
  }
  let bytes = text.length;
  if (!config.log || config.log.chainLogBodies !== true) {
    return {
      request_body: "",
      request_body_bytes: bytes,
      request_body_truncated: false,
    };
  }
  let limit = Number(config.log.chainLogMaxBodyBytes || 0);
  if (limit <= 0) {
    return {
      request_body: "",
      request_body_bytes: bytes,
      request_body_truncated: bytes > 0,
    };
  }
  if (text.length > limit) {
    return {
      request_body: text.slice(0, limit),
      request_body_bytes: bytes,
      request_body_truncated: true,
    };
  }
  return {
    request_body: text,
    request_body_bytes: bytes,
    request_body_truncated: false,
  };
}

function record(config, store, req, requestIDValue, downstream, route, statusCode, started, errorText, requestedModel, body, usage) {
  let provider = route ? route.provider || {} : {};
  let tokens = extractUsage({
    usage: usage || {},
  });
  let preview = bodyPreview(config, body);
  store.recordTraffic({
    id: requestIDValue,
    request_id: requestIDValue,
    endpoint: req.url || "",
    method: req.method || "",
    client_ip: "",
    user_agent: (req.headers || {})["user-agent"] || (req.headers || {})["User-Agent"] || "",
    content_type: (req.headers || {})["content-type"] || (req.headers || {})["Content-Type"] || "",
    downstream_protocol: downstream,
    upstream_protocol: route ? route.upstream_protocol : "",
    route_name: route ? route.name : "",
    route_source: route ? route.source : "",
    requested_model: requestedModel || "",
    model: route ? route.model : "",
    provider_id: provider.id || "",
    status_code: statusCode,
    duration_ms: nowMillis() - started,
    input_tokens: tokens.input_tokens,
    output_tokens: tokens.output_tokens,
    total_tokens: tokens.total_tokens,
    error: errorText || "",
    request_body: preview.request_body,
    request_body_bytes: preview.request_body_bytes,
    request_body_truncated: preview.request_body_truncated,
  });
}

export function createProxyService(config, store, resolver) {
  function authorize(req) {
    let key = extractAPIKey(req);
    if (key === "" && config.allowLocalWithoutAuth) {
      return true;
    }
    return key !== "" && store.verifyAPIKey(key, "proxy");
  }

  function handle(req, res, downstream) {
    let started = nowMillis();
    let rid = requestID();
    res.setHeader("X-ICOO-Request-ID", rid);
    if (req.method !== "POST") {
      record(config, store, req, rid, downstream, undefined, 405, started, "method not allowed", "", {});
      return proxyError(res, downstream, 405, "method not allowed");
    }
    if (!authorize(req)) {
      record(config, store, req, rid, downstream, undefined, 401, started, "invalid proxy api key", "", {});
      return proxyError(res, downstream, 401, "invalid proxy api key");
    }

    let body = req.body || {};
    let requestedModel = requestModel(body);
    let route = undefined;
    try {
      route = resolver.resolve(downstream, requestedModel);
    } catch (err) {
      record(config, store, req, rid, downstream, undefined, 400, started, String(err), requestedModel, body);
      return proxyError(res, downstream, 400, String(err));
    }

    let upstreamURL = joinUpstreamURL(route.provider.base_url, route.upstream_protocol);
    if (upstreamURL === "") {
      record(config, store, req, rid, downstream, route, 502, started, "upstream base_url is required", requestedModel, body);
      return proxyError(res, downstream, 502, "upstream base_url is required");
    }

    let upstreamBody = convertRequest(downstream, route.upstream_protocol, body, route.model, route.default_max_tokens);
    try {
      let upstream = http.request({
        method: "POST",
        url: upstreamURL,
        headers: upstreamHeaders(route, req),
        body: upstreamBody,
      });
      let status = Number(upstream.status || 200);
      if (upstream.headers) {
        for (let key in upstream.headers) {
          let lower = String(key).toLowerCase();
          if (lower !== "content-length" && lower !== "transfer-encoding" && lower !== "connection") {
            res.setHeader(key, upstream.headers[key]);
          }
        }
      }
      if (status >= 400) {
        record(config, store, req, rid, downstream, route, status, started, "upstream returned status " + String(status), requestedModel, body);
        return res.status(status).send(upstream.body || "");
      }
      let parsed = responseBodyJSON(upstream.body);
      if (parsed) {
        let converted = convertResponse(downstream, route.upstream_protocol, parsed, route.model);
        record(config, store, req, rid, downstream, route, status, started, "", requestedModel, body, extractUsage(converted));
        return res.status(status).json(converted);
      }
      record(config, store, req, rid, downstream, route, status, started, "", requestedModel, body);
      return res.status(status).send(upstream.body || "");
    } catch (err) {
      record(config, store, req, rid, downstream, route, 502, started, String(err), requestedModel, body);
      return proxyError(res, downstream, 502, "upstream request failed: " + String(err));
    }
  }

  return {
    handle: handle,
  };
}

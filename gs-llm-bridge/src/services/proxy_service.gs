import { ProtocolAnthropic, joinUpstreamURL } from "@/services/protocols";
import { convertRequest, convertResponse, extractUsage } from "@/services/converters";
import { aggregateStreamResponse, canConvertStream, convertStream, streamPreflightError, streamResponseFromBody } from "@/services/stream_converters";
import { apiKey, clientIP, headerValue, isLoopback } from "@/services/client_info";

let http = require("@std/net/http/client");
let crypto = require("@std/crypto");
let stream = require("@std/stream");

function nowMillis() {
  return Number((new Date()).getTime());
}

function requestID() {
  return "req-" + crypto.randomUUID();
}

function inboundRequestID(req) {
  let value = headerValue(req, "x-request-id").trim();
  if (value !== "") {
    return value;
  }
  return requestID();
}

function matchedRuleID(route) {
  let source = String(route ? route.source || "" : "");
  if (source.startsWith("routing_rule:")) {
    return source.slice("routing_rule:".length);
  }
  return "";
}

function matchedRuleName(route) {
  if (matchedRuleID(route) !== "") {
    return route.name || "";
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

function requestWantsStream(body) {
  if (!body) {
    return false;
  }
  return body.stream === true;
}

function routeRequiresStream(route) {
  return route && route.provider && route.provider.only_stream === true;
}

function copyResponseHeaders(res, headers) {
  if (!headers) {
    return;
  }
  for (let key in headers) {
    let lower = String(key).toLowerCase();
    if (lower !== "content-length" && lower !== "transfer-encoding" && lower !== "connection") {
      res.setHeader(key, headers[key]);
    }
  }
}

function headerFrom(headers, name) {
  let wanted = String(name || "").toLowerCase();
  for (let key in headers || {}) {
    if (String(key).toLowerCase() === wanted) {
      return String(headers[key] || "");
    }
  }
  return "";
}

function responseIsSSE(headers) {
  return headerFrom(headers, "content-type").toLowerCase().indexOf("text/event-stream") >= 0;
}

function requestIncludesUsageChunk(body) {
  let options = body ? body.stream_options || body.streamOptions || {} : {};
  return options.include_usage === true || options.includeUsage === true;
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
    client_ip: clientIP(req),
    user_agent: headerValue(req, "user-agent"),
    content_type: headerValue(req, "content-type"),
    downstream_protocol: downstream,
    upstream_protocol: route ? route.upstream_protocol : "",
    route_name: route ? route.name : "",
    route_source: route ? route.source : "",
    matched_rule_id: matchedRuleID(route),
    matched_rule_name: matchedRuleName(route),
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
    let key = apiKey(req);
    if (key === "" && config.allowLocalWithoutAuth && isLoopback(req)) {
      return true;
    }
    return key !== "" && store.verifyAPIKey(key, "proxy");
  }

  function handle(req, res, downstream) {
    let started = nowMillis();
    let rid = inboundRequestID(req);
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
    if (routeRequiresStream(route)) {
      upstreamBody.stream = true;
    }
    try {
      let wantsStream = requestWantsStream(body);
      let shouldStream = wantsStream || routeRequiresStream(route);
      if (shouldStream && (downstream === route.upstream_protocol || canConvertStream(downstream, route.upstream_protocol))) {
        let upstreamStream = http.stream({
          method: "POST",
          url: upstreamURL,
          headers: upstreamHeaders(route, req),
          body: upstreamBody,
        });
        let streamStatus = Number(upstreamStream.status || 200);
        copyResponseHeaders(res, upstreamStream.headers);
        if (streamStatus >= 400) {
          let errorBody = "";
          if (upstreamStream.body) {
            errorBody = upstreamStream.body.readAll();
          }
          if (upstreamStream.close) {
            upstreamStream.close();
          }
          record(config, store, req, rid, downstream, route, streamStatus, started, "upstream returned status " + String(streamStatus), requestedModel, body);
          return res.status(streamStatus).send(errorBody || "");
        }
        if (wantsStream && !responseIsSSE(upstreamStream.headers)) {
          let fallbackBody = "";
          if (upstreamStream.body) {
            fallbackBody = upstreamStream.body.readAll();
          }
          if (upstreamStream.close) {
            upstreamStream.close();
          }
          let parsedFallback = responseBodyJSON(fallbackBody);
          if (!parsedFallback) {
            record(config, store, req, rid, downstream, route, 502, started, "upstream stream returned non-SSE response", requestedModel, body);
            return proxyError(res, downstream, 502, "upstream stream returned non-SSE response");
          }
          let convertedFallback = convertResponse(downstream, route.upstream_protocol, parsedFallback, route.model);
          record(config, store, req, rid, downstream, route, streamStatus, started, "", requestedModel, body, extractUsage(convertedFallback));
          res.status(streamStatus);
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          streamResponseFromBody(downstream, convertedFallback, res, route.model, requestIncludesUsageChunk(body));
          return undefined;
        }
        if (!wantsStream && routeRequiresStream(route)) {
          let aggregateResult = aggregateStreamResponse(route.upstream_protocol, upstreamStream, route.model) || {};
          let aggregateBody = aggregateResult.body || {};
          if (upstreamStream.close) {
            upstreamStream.close();
          }
          let convertedBody = convertResponse(downstream, route.upstream_protocol, aggregateBody, route.model);
          record(config, store, req, rid, downstream, route, streamStatus, started, aggregateResult.error || "", requestedModel, body, aggregateResult.usage || extractUsage(convertedBody));
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          return res.status(streamStatus).json(convertedBody);
        }
        res.status(streamStatus);
        if (downstream === route.upstream_protocol) {
          record(config, store, req, rid, downstream, route, streamStatus, started, "", requestedModel, body);
          return res.stream(upstreamStream.body);
        }
        let upstreamStreamText = "";
        if (upstreamStream.body) {
          upstreamStreamText = upstreamStream.body.readAll();
        }
        if (upstreamStream.close) {
          upstreamStream.close();
        }
        let preflightError = streamPreflightError(upstreamStreamText);
        if (preflightError !== "") {
          record(config, store, req, rid, downstream, route, 502, started, preflightError, requestedModel, body);
          return proxyError(res, downstream, 502, preflightError);
        }
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        let replayStream = {
          status: streamStatus,
          headers: upstreamStream.headers || {},
          body: stream.fromString(upstreamStreamText),
        };
        let streamResult = convertStream(downstream, route.upstream_protocol, replayStream, res, route.model) || {};
        record(config, store, req, rid, downstream, route, streamStatus, started, streamResult.error || "", requestedModel, body, streamResult.usage || {});
        return undefined;
      }

      let upstream = http.request({
        method: "POST",
        url: upstreamURL,
        headers: upstreamHeaders(route, req),
        body: upstreamBody,
      });
      let status = Number(upstream.status || 200);
      copyResponseHeaders(res, upstream.headers);
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

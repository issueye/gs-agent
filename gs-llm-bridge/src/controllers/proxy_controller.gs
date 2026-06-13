import { ProtocolAnthropic, ProtocolOpenAIChat, ProtocolOpenAIResponses } from "@/services/protocols";

function requestPath(url) {
  let text = String(url || "");
  let queryIndex = text.indexOf("?");
  if (queryIndex >= 0) {
    text = text.slice(0, queryIndex);
  }
  return text;
}

export function createProxyController(model) {
  function anthropic(req, res) {
    return model.proxy.handle(req, res, ProtocolAnthropic);
  }

  function openaiChat(req, res) {
    return model.proxy.handle(req, res, ProtocolOpenAIChat);
  }

  function openaiResponses(req, res) {
    return model.proxy.handle(req, res, ProtocolOpenAIResponses);
  }

  function dynamic(req, res) {
    let endpoint = model.store.findEnabledEndpointByPath(requestPath(req.url));
    if (endpoint) {
      return model.proxy.handle(req, res, endpoint.downstream_protocol);
    }
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "route not found",
      },
    });
  }

  return {
    anthropic: anthropic,
    openaiChat: openaiChat,
    openaiResponses: openaiResponses,
    dynamic: dynamic,
  };
}

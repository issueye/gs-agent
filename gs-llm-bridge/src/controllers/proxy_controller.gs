import { ProtocolAnthropic, ProtocolOpenAIChat, ProtocolOpenAIResponses } from "@/services/protocols";

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
    if (req.url === "/v1/messages") {
      return anthropic(req, res);
    }
    if (req.url === "/v1/responses") {
      return openaiResponses(req, res);
    }
    if (req.url === "/v1/chat/completions") {
      return openaiChat(req, res);
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

export const ProtocolAnthropic = "anthropic";
export const ProtocolOpenAIChat = "openai_chat";
export const ProtocolOpenAIResponses = "openai_responses";

export function endpointFor(protocol) {
  if (protocol === ProtocolAnthropic) {
    return "/v1/messages";
  }
  if (protocol === ProtocolOpenAIResponses) {
    return "/v1/responses";
  }
  return "/v1/chat/completions";
}

export function joinUpstreamURL(baseURL, protocol) {
  let base = String(baseURL || "").trim();
  while (base.endsWith("/")) {
    base = base.slice(0, base.length - 1);
  }
  if (base === "") {
    return "";
  }
  let endpoint = endpointFor(protocol);
  if (base.endsWith(endpoint)) {
    return base;
  }
  if (base.endsWith("/v1")) {
    return base + endpoint.slice(3);
  }
  return base + endpoint;
}

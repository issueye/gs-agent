// 允许配置 base URL 或完整 messages endpoint，兼容不同 Anthropic 兼容服务。
export function messagesUrl(baseUrl) {
  let url = baseUrl;
  while (url.endsWith("/")) {
    url = url.slice(0, url.length - 1);
  }

  if (url.endsWith("/messages")) {
    return url;
  }
  if (url.endsWith("/v1")) {
    return url + "/messages";
  }
  return url + "/v1/messages";
}

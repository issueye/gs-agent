// lib/utils.gs - 通用工具函数

// 字段提取
export function extractField(obj, ...keys) {
  for (let key of keys) {
    let val = obj[key];
    if (val !== null && val !== undefined) {
      return val;
    }
  }
  return "";
}

// 安全字符串转换
export function safeString(value, fallback) {
  if (fallback === undefined) {
    fallback = "";
  }
  return String(value || fallback);
}

// JSON 操作
export function parseJSON(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch (error) {
    return {};
  }
}

export function sendJSON(ws, data) {
  ws.sendText(JSON.stringify(data || {}));
}

export function safeSend(ws, data) {
  try {
    sendJSON(ws, data);
    return true;
  } catch (error) {
    return false;
  }
}

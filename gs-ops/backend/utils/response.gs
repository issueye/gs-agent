export function ok(res, data, message = "ok") {
  res.setHeader("Content-Type", "application/json");
  let body = JSON.stringify({
    success: true,
    message: message,
    data: data,
  });
  return res.send(body);
}

export function created(res, data, message = "created") {
  res.status(201);
  res.setHeader("Content-Type", "application/json");
  let body = JSON.stringify({
    success: true,
    message: message,
    data: data,
  });
  return res.send(body);
}

export function fail(res, statusCode, message, details = null) {
  res.status(statusCode);
  res.setHeader("Content-Type", "application/json");
  let body = JSON.stringify({
    success: false,
    message: message,
    details: details,
  });
  return res.send(body);
}

// 成功响应（返回 JSON 对象，不是 res 对象）
export function success(message = "ok", data = null) {
  return {
    success: true,
    message: message,
    data: data,
  };
}

// 错误响应（返回 JSON 对象，不是 res 对象）
export function error(message = "error", details = null) {
  return {
    success: false,
    message: message,
    details: details,
  };
}



export function ok(res, data, message = "ok") {
  return res.json({
    success: true,
    message: message,
    data: data,
  });
}

export function created(res, data, message = "created") {
  return res.status(201).json({
    success: true,
    message: message,
    data: data,
  });
}

export function fail(res, statusCode, message, details = null) {
  return res.status(statusCode).json({
    success: false,
    message: message,
    details: details,
  });
}


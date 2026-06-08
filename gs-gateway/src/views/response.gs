export function ok(res, data) {
  return res.json({
    ok: true,
    data: data,
  });
}

export function created(res, data) {
  return res.status(201).json({
    ok: true,
    data: data,
  });
}

export function fail(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: {
      code: code,
      message: message,
    },
  });
}

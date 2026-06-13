export function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: "route not found",
  });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  return res.status(500).json({
    success: false,
    message: "internal server error",
  });
}


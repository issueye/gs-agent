export function logger(req, res, next) {
  console.log("[" + new Date().toISOString() + "] " + req.method + " " + req.path);
  return next();
}


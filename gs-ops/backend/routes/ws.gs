export function registerWsRoutes(app, controllers) {
  app.get("/ws/services/:id/logs", (req, res) => {
    res.status(501).json({
      success: false,
      message: "websocket log stream is reserved for the next phase",
    });
  });
}


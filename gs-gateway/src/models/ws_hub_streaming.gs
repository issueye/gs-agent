  function runTaskForClientWithStreaming(ws, payload) {
    let requestId = extractField(payload, "requestId", "request_id", "messageId", "message_id");
    let conversationId = extractField(payload, "conversationId", "conversation_id", "chat", "chatId");
    let inbound = gateway.im.receive(normalizeClientPayload(payload));
    let task = inbound.task;
    clientList(task.id).push(ws);

    let ctx = createSessionContext(conversationId, task.id, requestId);
    let stream = createStreamEmitter(broadcast, task.id, ctx);

    sendJSON(ws, ctx.frame("session/accepted", {
      metadata: { taskId: task.id, streaming: true }
    }));

    sendJSON(ws, ctx.frame("session/update", {
      update: toolUpdate(task, "running", task.payload && task.payload.input ? task.payload.input.text : "", null)
    }));

    sendJSON(ws, {
      type: "task_created",
      at: now(),
      conversation_id: conversationId,
      session_id: task.id,
      request_id: requestId,
      task: task,
    });

    let timeout = createTimeoutController(config.gateway.timeout);

    timeout.start(function() {
      if (!timeout.isCancelled()) {
        broadcast(task.id, ctx.frame("session/error", {
          code: ErrorCodes.AGENT_TIMEOUT,
          error: "任务执行超时",
          metadata: { taskId: task.id, timeoutMs: config.gateway.timeout }
        }));
        removeClient(task.id, ws);
      }
    });

    go(function() {
      try {
        let answer = "";

        // 创建流式桥接，处理实时数据块
        let streamingBridge = {
          onChunk: function(chunk) {
            answer = answer + chunk;
            stream.emit(chunk);
          },
          onDone: function(result) {
            timeout.cancel();
            stream.done(answer);

            broadcast(task.id, ctx.frame("session/update", {
              update: toolUpdate(result, "completed", null, result.result || answer)
            }));
            broadcast(task.id, ctx.frame("session/completed", {
              stopReason: "completed",
              metadata: { taskId: task.id }
            }));
            broadcast(task.id, {
              type: "done",
              at: now(),
              conversation_id: conversationId,
              session_id: task.id,
              request_id: requestId,
              task: result,
              answer: answer,
            });
            removeClient(task.id, ws);
          },
          onError: function(error) {
            timeout.cancel();
            broadcast(task.id, ctx.frame("session/error", {
              code: ErrorCodes.AGENT_TASK_FAILED,
              error: error.message || String(error),
              metadata: { taskId: task.id }
            }));
            broadcast(task.id, {
              type: "error",
              at: now(),
              conversation_id: conversationId,
              session_id: task.id,
              request_id: requestId,
              taskId: task.id,
              error: error.message || String(error),
            });
            removeClient(task.id, ws);
          },
        };

        // 调用支持流式的 Agent Bridge（当前降级为普通调用）
        let updated = gateway.agentBridge.runTask(task.id);

        // 降级处理：如果没有流式数据，模拟一次性推送
        if (updated.result && updated.result.answer) {
          answer = updated.result.answer;
          streamingBridge.onChunk(answer);
        }
        streamingBridge.onDone(updated);

      } catch (error) {
        if (streamingBridge && streamingBridge.onError) {
          streamingBridge.onError(error);
        }
      }
    });
  }

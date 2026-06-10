// lib/stream.gs - 流式处理工具

export function createStreamEmitter(broadcast, taskId, ctx) {
  return {
    emit: function(chunk) {
      broadcast(taskId, ctx.frame("session/stream", {
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: String(chunk) },
          done: false,
        },
      }));
    },

    done: function(fullText) {
      broadcast(taskId, ctx.frame("session/stream", {
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: String(fullText || "") },
          done: true,
        },
      }));
    },
  };
}

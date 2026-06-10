// models/streaming_bridge.gs - 流式 Agent Bridge

import { config } from "@/lib/config";

export function createStreamingBridge(runtime, onChunk, onDone, onError) {
  return {
    runTask: function(taskId) {
      let chunks = [];
      let result = null;

      try {
        // 模拟流式调用 - 实际应调用支持流式的 runtime
        let output = runtime.callScript("gateway-task.gs", "runAgentTask", {
          taskId: taskId,
          stream: true,
        });

        // 如果 Agent 返回流式数据
        if (output && output.chunks) {
          for (let chunk of output.chunks) {
            chunks.push(chunk);
            if (onChunk) {
              onChunk(chunk);
            }
          }
          result = output.result;
        } else {
          // 降级：非流式返回
          result = output;
          if (onChunk && output.result && output.result.answer) {
            onChunk(output.result.answer);
          }
        }

        if (onDone) {
          onDone(result);
        }

        return result;
      } catch (error) {
        if (onError) {
          onError(error);
        }
        throw error;
      }
    },
  };
}

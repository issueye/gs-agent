// fake provider 只用于显式本地测试：按预设步骤返回工具调用或 assistant 消息。
export function createScriptedProvider(steps) {
  let step = 0;

  function next(messages, tools, turnOptions) {
    if (step < steps.length) {
      let current = steps[step];
      step = step + 1;
      return current;
    }

    return {
      role: "assistant",
      content: "No scripted provider response remaining.",
    };
  }

  return {
    next: next,
  };
}

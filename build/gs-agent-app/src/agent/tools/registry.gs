let schema = require("@std/schema");

// 工具定义保持接近 LLM tool schema：名字、说明、输入 schema、执行函数。
export function createTool(name, description, inputSchema, run) {
  return {
    name: name,
    description: description,
    inputSchema: inputSchema,
    run: run,
  };
}

// registry 负责工具发现、参数校验和安全执行，是模型与本地能力之间的边界。
export function createRegistry() {
  let tools = [];

  function register(tool) {
    tools.push(tool);
    return tool;
  }

  function registerAll(nextTools) {
    for (let tool of nextTools) {
      register(tool);
    }
    return tools.length;
  }

  function list() {
    return tools.map(function(tool) {
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      };
    });
  }

  function get(name) {
    for (let i = 0; i < tools.length; i = i + 1) {
      if (tools[i].name === name) {
        return tools[i];
      }
    }
    return undefined;
  }

  function call(name, args) {
    let tool = get(name);
    if (!tool) {
      throw new ReferenceError("unknown tool: " + name);
    }

    let checked = schema.validate(tool.inputSchema, args);
    if (!checked.valid) {
      throw new TypeError("invalid args for " + name + ": " + checked.errors.join("; "));
    }

    return tool.run(args);
  }

  function safeCall(name, args) {
    let tool = get(name);
    try {
      return {
        ok: true,
        name: name,
        result: call(name, args),
      };
    } catch (err) {
      return {
        ok: false,
        name: name,
        error: String(err),
        expectedInputSchema: tool ? tool.inputSchema : undefined,
      };
    }
  }

  return {
    register: register,
    registerAll: registerAll,
    list: list,
    get: get,
    call: call,
    safeCall: safeCall,
  };
}

// lib/config.gs - 配置管理

export const config = {
  gateway: {
    host: process.env.GATEWAY_HOST || "0.0.0.0",
    port: parseInt(process.env.GATEWAY_PORT || "18878"),
    timeout: parseInt(process.env.TASK_TIMEOUT || "30000"),
  },
  agent: {
    bridge: process.env.AGENT_BRIDGE || "http://localhost:8080",
  },
};

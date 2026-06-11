// 简单的 API 测试脚本
let http = require("@std/http");
let json = require("@std/json");

let config = {
  apiKey: "sk-e6c8365a723d4510ac42c00e4ea82644",
  baseUrl: "https://api.deepseek.com/anthropic/v1/messages",
  model: "deepseek-v4-flash"
};

let payload = {
  model: config.model,
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: "请用一句话介绍你自己，并计算 123 + 456 的结果。"
    }
  ]
};

println("正在调用 DeepSeek API...");
println("Endpoint: " + config.baseUrl);
println("Model: " + config.model);
println("");

let response = http.post({
  url: config.baseUrl,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
    "anthropic-version": "2023-06-01"
  },
  body: json.stringify(payload),
  timeout: 30000
});

println("状态码: " + String(response.status));
println("");

if (response.status === 200) {
  let result = json.parse(response.body);
  println("=== API 响应成功 ===");
  println("ID: " + result.id);
  println("Model: " + result.model);
  println("Role: " + result.role);
  println("");
  println("=== 回答内容 ===");
  if (result.content && result.content.length > 0) {
    println(result.content[0].text);
  }
  println("");
  println("✅ 测试成功！");
} else {
  println("=== API 错误 ===");
  println(response.body);
  println("");
  println("❌ 测试失败");
}

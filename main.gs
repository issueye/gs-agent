import { runAgentApp } from "@/agent/app";

// GoScript 项目入口：加载配置、运行 agent，并把最终回答与会话位置打印出来。
function main() {
  let result = runAgentApp();

  println(result.answer);
  println("events=" + String(result.events));
  println("session=" + result.sessionFile);
  println("answer=" + result.answerFile);
}

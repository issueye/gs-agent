import { runAgentApp } from "@/agent/app";
import { runAgentTui } from "@/tui/app";

let process = require("@std/process");

function hasArg(name) {
  for (let arg of process.argv) {
    if (arg === name) {
      return true;
    }
  }
  return false;
}

// GoScript 项目入口：加载配置、运行 agent，并把最终回答与会话位置打印出来。
function main() {
  if (hasArg("--tui")) {
    runAgentTui();
    return;
  }

  let result = runAgentApp();

  println(result.answer);
  println("events=" + String(result.events));
  println("session=" + result.sessionFile);
  println("answer=" + result.answerFile);
  println("log=" + result.logFile);
  println("latestLog=" + result.latestLogFile);
}

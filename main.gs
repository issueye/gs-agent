import { runAgentApp, runAgentIMBridge } from "@/agent/app";
import { runAgentTui } from "@/tui/app";

let process = require("@std/process");
let timers = require("@std/timers");

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

  if (hasArg("--im")) {
    let bridge = runAgentIMBridge({});
    println("im bridge started");
    println("events=" + bridge.events.join(","));
    println("session=" + bridge.app.sessionFile);
    while (true) {
      timers.sleep(1000);
    }
  }

  let result = runAgentApp();

  println(result.answer);
  println("events=" + String(result.events));
  println("session=" + result.sessionFile);
  println("answer=" + result.answerFile);
  println("log=" + result.logFile);
  println("latestLog=" + result.latestLogFile);
}

import { runAgentApp, runAgentIMBridge } from "@/agent/app";

let cli = require("@std/cli");
let timers = require("@std/timers");

function runMain(cmd, args) {
  if (cmd.flag("tui")) {
    let tui = require("@/tui/app");
    let runAgentTui = tui.runAgentTui;
    runAgentTui();
    return;
  }

  if (cmd.flag("im")) {
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

// GoScript 项目入口：加载配置、运行 agent，并把最终回答与会话位置打印出来。
function main() {
  let root = cli.command({
    use: "gs-agent",
    short: "AI agent runtime",
    run: runMain,
  });
  root.flags().bool("tui", "", false, "run the terminal UI");
  root.flags().bool("im", "", false, "run the IM bridge");
  root.execute();
}

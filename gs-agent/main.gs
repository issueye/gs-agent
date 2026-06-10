import { runAgentApp } from "@/agent/app";

let cli = require("@std/cli");

function runMain(cmd, args) {
  let session = cmd.flag("session");
  if (cmd.flag("tui")) {
    let tui = require("@/tui/app");
    let runAgentTui = tui.runAgentTui;
    runAgentTui({
      session: session,
    });
    return;
  }

  let result = runAgentApp({
    session: session,
  });

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
  root.flags().string("session", "s", "", "continue a session by id, directory, session.jsonl path, or current");
  root.execute();
}

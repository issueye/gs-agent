import { appRootForLaunch } from "@/agent/app";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  appRootForLaunch("E:\\codes\\gts_codes\\gs-agent\\gs.exe", [], "E:\\codes\\gts_codes\\gs-agent") === "E:\\codes\\gts_codes\\gs-agent",
  "gs.exe launch should use cwd"
);

assert(
  appRootForLaunch("E:\\apps\\gs-agent\\gs-agent.exe", [], "C:\\Users\\issue") === "E:\\apps\\gs-agent",
  "packaged launch should use executable directory"
);

assert(
  appRootForLaunch("/usr/local/bin/gs", [], "/work/gs-agent") === "/work/gs-agent",
  "gs interpreter launch should use cwd"
);

assert(
  appRootForLaunch("/opt/gs-agent/gs-agent", [], "/tmp") === "/opt/gs-agent",
  "packaged unix launch should use executable directory"
);

println("app-root:ok");

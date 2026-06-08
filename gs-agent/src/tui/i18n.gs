export function uiLanguage(state) {
  if (state && state.uiLanguage === "zh") {
    return "zh";
  }
  return "en";
}

export function setUiLanguage(state, language) {
  if (language === "zh") {
    state.uiLanguage = "zh";
  } else {
    state.uiLanguage = "en";
  }
}

export function toggleUiLanguage(state) {
  if (uiLanguage(state) === "zh") {
    setUiLanguage(state, "en");
  } else {
    setUiLanguage(state, "zh");
  }
}

let Text = {
  en: {
    answerReady: "answer=ready",
    alreadyRunning: "already running",
    cancelling: "cancelling",
    chars: "chars",
    commandPanel: "Command panel",
    commandPanelStatus: "command panel",
    commandQuery: "query",
    commandsHeader: "/ commands",
    commandHelp: "Type to filter, Enter to run, Esc to close",
    details: "Details",
    done: "done",
    enterRun: "Enter run",
    enterSend: "Enter newline",
    error: "error",
    escClose: "Esc close",
    focus: "focus",
    inputCleared: "input cleared",
    interrupted: "interrupted",
    interruptRequested: "interrupt requested",
    idle: "idle",
    languageChanged: "language: English",
    languageToggleName: "language",
    languageToggleDescription: "Switch interface language",
    loadSession: "Ctrl+O load session",
    log: "log",
    messages: "messages",
    modified: "modified",
    newSession: "new session",
    noRecentSession: "no recent session",
    noCommands: "No commands match.",
    noEvent: "no event",
    noEventSelected: "No event selected.",
    noMessages: "No messages yet. Write a task below and press Ctrl+R.",
    prompt: "Prompt",
    quit: "Ctrl+C to quit",
    restoreSession: "Use Ctrl+O to restore the latest session.",
    running: "running",
    saved: "saved",
    sessionLoaded: "session loaded",
    send: "send",
    sendHelp: "Ctrl+R send",
    task: "Task",
    taskEmpty: "task is empty",
    timeline: "Run Timeline",
    transcript: "Transcript",
    unsavedExit: "unsaved task, press Ctrl+C again to quit",
    width: "width",
  },
  zh: {
    answerReady: "答案=就绪",
    alreadyRunning: "正在运行",
    cancelling: "正在中断",
    chars: "字符",
    commandPanel: "指令面板",
    commandPanelStatus: "指令面板",
    commandQuery: "查询",
    commandsHeader: "/ 指令",
    commandHelp: "输入筛选，Enter 执行，Esc 关闭",
    details: "详情",
    done: "完成",
    enterRun: "Enter 执行",
    enterSend: "Enter 换行",
    error: "错误",
    escClose: "Esc 关闭",
    focus: "焦点",
    inputCleared: "输入已清空",
    interrupted: "已中断",
    interruptRequested: "已请求中断",
    idle: "空闲",
    languageChanged: "语言：中文",
    languageToggleName: "language",
    languageToggleDescription: "切换界面语言",
    loadSession: "Ctrl+O 加载会话",
    log: "日志",
    messages: "消息",
    modified: "已修改",
    newSession: "新会话",
    noRecentSession: "没有最近会话",
    noCommands: "没有匹配的指令。",
    noEvent: "无事件",
    noEventSelected: "未选择事件。",
    noMessages: "还没有消息。请在下方输入任务，然后按 Ctrl+R。",
    prompt: "输入",
    quit: "Ctrl+C 退出",
    restoreSession: "使用 Ctrl+O 恢复最近会话。",
    running: "运行中",
    saved: "已保存",
    sessionLoaded: "会话已加载",
    send: "send",
    sendHelp: "Ctrl+R 发送",
    task: "任务",
    taskEmpty: "任务为空",
    timeline: "运行时间线",
    transcript: "会话记录",
    unsavedExit: "任务未保存，再按一次 Ctrl+C 退出",
    width: "宽度",
  },
};

export function tr(state, key) {
  let language = uiLanguage(state);
  if (Text[language] && key in Text[language]) {
    return Text[language][key];
  }
  if (key in Text.en) {
    return Text.en[key];
  }
  return key;
}

export function commandItems(state) {
  if (uiLanguage(state) === "zh") {
    return [
      { id: "send", name: "send", description: "发送当前输入", aliases: ["发送"] },
      { id: "new", name: "new", description: "开始新会话", aliases: ["新会话"] },
      { id: "load", name: "load", description: "加载最近会话", aliases: ["加载"] },
      { id: "save", name: "save", description: "保存输入草稿", aliases: ["保存"] },
      { id: "clear", name: "clear", description: "清空输入框", aliases: ["清空"] },
      { id: "focus", name: "focus", description: "切换输入和会话记录焦点", aliases: ["焦点"] },
      { id: "language", name: "language", description: "切换中文/英文界面", aliases: ["语言", "中文", "english", "en", "zh"] },
      { id: "quit", name: "quit", description: "退出 TUI", aliases: ["退出"] },
    ];
  }

  return [
    { id: "send", name: "send", description: "Send the current prompt", aliases: [] },
    { id: "new", name: "new", description: "Start a new session", aliases: [] },
    { id: "load", name: "load", description: "Load the latest session", aliases: [] },
    { id: "save", name: "save", description: "Save the prompt draft", aliases: [] },
    { id: "clear", name: "clear", description: "Clear the prompt input", aliases: [] },
    { id: "focus", name: "focus", description: "Switch between prompt and transcript", aliases: [] },
    { id: "language", name: "language", description: "Switch interface language", aliases: ["lang", "中文", "english", "en", "zh"] },
    { id: "quit", name: "quit", description: "Quit the TUI", aliases: [] },
  ];
}

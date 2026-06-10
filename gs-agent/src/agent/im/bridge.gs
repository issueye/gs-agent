function hasOwn(value, key) {
  if (!value) {
    return false;
  }
  return key in value;
}

function field(value, key) {
  if (!value) {
    return undefined;
  }
  if (typeof value !== "OBJECT") {
    return undefined;
  }
  if (key in value) {
    return value[key];
  }
  return undefined;
}

function firstString(values) {
  for (let i = 0; i < values.length; i = i + 1) {
    let value = values[i];
    if (value !== undefined && value !== null) {
      let text = String(value);
      if (text.trim() !== "") {
        return text;
      }
    }
  }
  return "";
}

function keyPart(value) {
  let text = String(value || "").trim();
  if (text === "") {
    return "_";
  }
  text = text.replaceAll("\\", "_");
  text = text.replaceAll("/", "_");
  text = text.replaceAll(":", "_");
  text = text.replaceAll("|", "_");
  return text;
}

function eventData(event) {
  if (!event) {
    return {};
  }
  if (event.data) {
    return event.data;
  }
  if (event.payload) {
    return event.payload;
  }
  return event;
}

export function imConversationKey(input) {
  if (!input) {
    return "";
  }
  let identity = firstString([
    input.conversationId,
    input.conversation_id,
    input.openId,
    input.sender,
    input.replyTo,
    input.chat,
  ]);
  if (identity === "") {
    return "";
  }
  return [
    "im",
    keyPart(input.platform),
    keyPart(input.adapter),
    keyPart(identity),
  ].join(":");
}

export function normalizeIMMessage(event) {
  let data = eventData(event);
  let message = field(data, "message");
  if (!message) {
    message = field(data, "msg");
  }
  if (!message || typeof message !== "OBJECT") {
    message = {};
  }
  let text = firstString([
    field(data, "text"),
    field(data, "content"),
    field(data, "messageText"),
    field(message, "text"),
    field(message, "content"),
    field(message, "message"),
    field(message, "raw_message"),
  ]);
  if (text === "") {
    return undefined;
  }

  let adapter = firstString([
    field(data, "adapter"),
    field(data, "adapterName"),
    field(data, "bot"),
    field(data, "name"),
    field(message, "adapter"),
  ]);
  let platform = firstString([
    field(data, "platform"),
    field(data, "channel"),
    field(message, "platform"),
    event ? event.module : "",
  ]);
  let sender = firstString([
    field(data, "from"),
    field(data, "fromId"),
    field(data, "userId"),
    field(data, "senderId"),
    field(message, "from"),
    field(message, "user_id"),
    field(message, "open_id"),
  ]);
  let openId = firstString([
    field(data, "openId"),
    field(data, "openid"),
    field(data, "open_id"),
    field(data, "userOpenId"),
    field(data, "unionId"),
    field(data, "union_id"),
    field(message, "openId"),
    field(message, "openid"),
    field(message, "open_id"),
    field(message, "userOpenId"),
    field(message, "unionId"),
    field(message, "union_id"),
    sender,
  ]);
  let chat = firstString([
    field(data, "chat"),
    field(data, "chatId"),
    field(data, "groupId"),
    field(data, "conversationId"),
    field(message, "chat"),
    field(message, "group_id"),
    field(message, "chat_id"),
  ]);
  let replyTo = firstString([
    field(data, "replyTo"),
    field(data, "to"),
    field(data, "sessionId"),
    chat,
    sender,
  ]);
  let conversationId = firstString([
    field(data, "conversationId"),
    field(data, "conversation_id"),
    field(data, "sessionId"),
    chat,
  ]);

  return {
    source: "im",
    adapter: adapter,
    platform: platform,
    conversationId: conversationId,
    openId: openId,
    sender: sender,
    chat: chat,
    replyTo: replyTo,
    text: text,
    raw: event,
  };
}

export function imMessagePrompt(input) {
  let lines = [];
  lines.push("IM message received.");
  if (input.platform) {
    lines.push("Platform: " + input.platform);
  }
  if (input.adapter) {
    lines.push("Adapter: " + input.adapter);
  }
  if (input.chat) {
    lines.push("Chat: " + input.chat);
  }
  if (input.sender) {
    lines.push("From: " + input.sender);
  }
  if (input.openId && input.openId !== input.sender) {
    lines.push("OpenID: " + input.openId);
  }
  lines.push("");
  lines.push(input.text);
  return lines.join("\n");
}

export function emitIMEvent(bus, event) {
  let input = normalizeIMMessage(event);
  if (!input) {
    return undefined;
  }
  bus.emit("agent_input", input);
  return input;
}

function listenToPlugin(plugin, eventName, handler) {
  if (!plugin || !plugin.on) {
    return false;
  }
  plugin.on(eventName, handler);
  return true;
}

export function attachIMBotToBus(bus, options) {
  if (!options) {
    options = {};
  }
  let plugin = options.plugin;
  if (!plugin) {
    throw new ReferenceError("IM bot plugin is not available");
  }

  let events = options.events;
  if (!events) {
    events = ["message", "message_create", "im_message", "inbound_message"];
  }

  let attached = 0;
  function handler(event) {
    emitIMEvent(bus, event);
  }
  for (let i = 0; i < events.length; i = i + 1) {
    let name = events[i];
    if (listenToPlugin(plugin, name, handler)) {
      attached = attached + 1;
    }
  }

  return {
    events: events,
    attached: attached,
  };
}

export function sendIMReply(plugin, input, text) {
  if (!plugin || !plugin.send) {
    return undefined;
  }
  if (!input || !input.replyTo) {
    return undefined;
  }
  let options = {
    adapter: input.adapter,
    to: input.replyTo,
    text: text,
  };
  if (input.chat) {
    options.toType = "group";
  } else {
    options.toType = "private";
  }
  if (hasOwn(input, "raw")) {
    options.extra = {
      inbound: input.raw,
    };
  }
  return plugin.send(options);
}

let http = require("@std/net/http/client");

function now() {
  return (new Date()).toISOString();
}

function sleep(ms) {
  let start = Date.now();
  while (Date.now() - start < ms) {
    // 同步忙等待，简化实现；生产环境可替换为语言侧 timer
  }
}

function field(reply, camel, snake) {
  if (camel in reply) {
    return reply[camel];
  }
  if (snake in reply) {
    return reply[snake];
  }
  return "";
}

function sendConsole(reply, channel) {
  println("[IM outbound] channel=" + channel.id + " chat=" + field(reply, "chatId", "chat_id") + " text=" + field(reply, "text", "text"));
  return true;
}

function sendWebhook(reply, channel, options) {
  let url = options.webhookUrl || "";
  if (url === "") {
    console.warn("[IM outbound] webhook adapter enabled but webhookUrl is empty");
    return false;
  }
  let payload = {
    conversationId: field(reply, "conversationId", "conversation_id"),
    taskId: field(reply, "taskId", "task_id"),
    eventId: field(reply, "eventId", "event_id"),
    channelId: field(reply, "channelId", "channel_id"),
    chatId: field(reply, "chatId", "chat_id"),
    senderId: field(reply, "senderId", "sender_id"),
    messageId: field(reply, "messageId", "message_id"),
    text: field(reply, "text", "text"),
    platform: channel.platform,
    adapter: channel.adapter,
    at: now(),
  };
  try {
    let response = http.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.warn("[IM outbound] webhook failed: " + String(error));
    return false;
  }
}

function sendReply(reply, channel, options) {
  let adapter = channel.config && channel.config.outboundAdapter ? channel.config.outboundAdapter : options.adapter;
  if (adapter === "webhook") {
    return sendWebhook(reply, channel, options);
  }
  return sendConsole(reply, channel);
}

function processPendingReply(store, reply, options) {
  let conversationId = field(reply, "conversationId", "conversation_id");
  let channelId = field(reply, "channelId", "channel_id");
  let conversation = store.getIMConversation(conversationId);
  if (!conversation) {
    console.warn("[IM outbound] conversation not found: " + conversationId);
    store.updateIMReply(reply.id, { status: "failed" });
    return;
  }
  let channel = store.getIMChannel(channelId);
  if (!channel) {
    console.warn("[IM outbound] channel not found: " + channelId);
    store.updateIMReply(reply.id, { status: "failed" });
    return;
  }

  let attempts = 0;
  let maxAttempts = Math.max(1, Number(options.retryMax || 3) + 1);
  let delayMs = Number(options.retryDelayMs || 1000);
  while (attempts < maxAttempts) {
    attempts = attempts + 1;
    let ok = false;
    try {
      ok = sendReply(reply, channel, options);
    } catch (error) {
      console.warn("[IM outbound] sendReply error: " + String(error));
    }
    if (ok) {
      store.updateIMReply(reply.id, { status: "sent" });
      return;
    }
    if (attempts < maxAttempts) {
      sleep(delayMs);
    }
  }
  store.updateIMReply(reply.id, { status: "failed" });
}

function tick(store, options) {
  let limit = Number(options.batchLimit || 50);
  let replies = store.listIMReplies("pending", limit);
  for (let reply of replies) {
    processPendingReply(store, reply, options);
  }
  return {
    processed: replies.length,
    at: now(),
  };
}

export function tick(store, options) {
  let opts = options || {};
  let limit = Number(opts.batchLimit || 50);
  let replies = store.listIMReplies("pending", limit);
  for (let reply of replies) {
    processPendingReply(store, reply, opts);
  }
  return {
    processed: replies.length,
    at: now(),
  };
}

export function startOutboundPoller(model, options) {
  let opts = options || {};
  if (opts.enabled === false) {
    return {
      stop: function() {},
    };
  }

  let running = true;
  let intervalMs = Math.max(1000, Number(opts.pollIntervalMs || 3000));

  go(function() {
    while (running) {
      try {
        tick(model.store, opts);
      } catch (error) {
        console.warn("[IM outbound] poller tick failed: " + String(error));
      }
      sleep(intervalMs);
    }
  });

  return {
    stop: function() {
      running = false;
    },
  };
}

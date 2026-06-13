function now() {
  return (new Date()).toISOString();
}

function mergeObject(base, extra) {
  let out = {};
  for (let key in base) {
    out[key] = base[key];
  }
  if (extra) {
    for (let key in extra) {
      out[key] = extra[key];
    }
  }
  return out;
}

function textValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function channelIdFor(input) {
  if (input.channelId) {
    return textValue(input.channelId);
  }
  let platform = textValue(input.platform || "im");
  let adapter = textValue(input.adapter || "default");
  return platform + ":" + adapter;
}

export function createIMRuntime(gateway) {
  let store = gateway.store;

  function normalizeInbound(input) {
    let value = input || {};
    let platform = textValue(value.platform || "im");
    let adapter = textValue(value.adapter || "default");
    let senderId = textValue(value.senderId || value.sender || value.openId || value.userId || "");
    let chatId = textValue(value.chatId || value.chat || value.conversationId || value.roomId || senderId);
    let conversationId = textValue(value.conversationId || value.conversation_id || "");
    let messageId = textValue(value.messageId || value.message_id || value.id || "");
    let agentId = textValue(value.agentId || value.agent_id || value.agent || "");
    let channelId = channelIdFor({
      channelId: value.channelId || value.channel_id,
      platform: platform,
      adapter: adapter,
    });
    return {
      channelId: channelId,
      conversationId: conversationId,
      messageId: messageId,
      chatId: chatId,
      senderId: senderId,
      text: textValue(value.text || value.content || value.message || ""),
      agentId: agentId,
      platform: platform,
      adapter: adapter,
      replyTo: textValue(value.replyTo || value.reply_to || chatId || senderId),
      raw: value,
    };
  }

  function ensureChannel(input) {
    let defaultAdapter = "console";
    if (gateway.config && gateway.config.im && gateway.config.im.outbound) {
      defaultAdapter = gateway.config.im.outbound.adapter || defaultAdapter;
    }
    let channel = store.getIMChannel(input.channelId);
    if (channel) {
      if (!channel.config || !channel.config.outboundAdapter) {
        return store.updateIMChannel(input.channelId, {
          config: mergeObject(channel.config || {}, { outboundAdapter: defaultAdapter }),
        });
      }
      return channel;
    }
    return store.createIMChannel({
      id: input.channelId,
      platform: input.platform,
      adapter: input.adapter,
      name: input.platform + "/" + input.adapter,
      config: {
        outboundAdapter: defaultAdapter,
      },
    });
  }

  function receive(input) {
    let inbound = normalizeInbound(input);
    let channel = ensureChannel(inbound);
    let subject = inbound.chatId || inbound.senderId || inbound.messageId || "";
    let event = store.addEvent("im", "inbound_message", subject, inbound, "received");
    let conversation = store.upsertIMConversation({
      id: inbound.conversationId || undefined,
      channelId: inbound.channelId,
      chatId: inbound.chatId,
      senderId: inbound.senderId,
      subject: subject,
      lastMessageId: inbound.messageId,
      lastText: inbound.text,
      lastEventId: event.id,
      lastAt: now(),
      meta: {
        platform: inbound.platform,
        adapter: inbound.adapter,
        replyTo: inbound.replyTo,
      },
    });
    let task = store.createTask({
      name: "IM message from " + (inbound.senderId || inbound.chatId || "unknown"),
      kind: "agent.im",
      status: "pending",
      payload: {
        source: {
          type: "im",
          eventId: event.id,
          channelId: inbound.channelId,
          conversationId: conversation.id,
          messageId: inbound.messageId,
        },
        input: {
          text: inbound.text,
          agentId: inbound.agentId,
          im: {
            source: "im",
            conversationId: conversation.id,
            channelId: inbound.channelId,
            messageId: inbound.messageId,
            chatId: inbound.chatId,
            chat: inbound.chatId,
            senderId: inbound.senderId,
            sender: inbound.senderId,
            openId: inbound.senderId,
            platform: inbound.platform,
            adapter: inbound.adapter,
            replyTo: inbound.replyTo,
            agentId: inbound.agentId,
            text: inbound.text,
          },
        },
        run: {
          mode: "im",
          agentId: inbound.agentId,
        },
        raw: inbound.raw,
      },
    });
    return {
      event: event,
      channel: channel,
      conversation: conversation,
      task: task,
    };
  }

  function createChannel(input) {
    return store.createIMChannel(input || {});
  }

  function listChannels(options) {
    let query = options || {};
    return store.listIMChannels(query.limit);
  }

  function getChannel(id) {
    return store.getIMChannel(id);
  }

  function updateChannel(id, patch) {
    return store.updateIMChannel(id, patch || {});
  }

  function removeChannel(id) {
    return store.removeIMChannel(id);
  }

  function listConversations(options) {
    let query = options || {};
    return store.listIMConversations(query.channelId || query.channel_id, query.limit);
  }

  function listConversationMessages(id) {
    return store.listIMConversationMessages(id);
  }

  function removeConversation(id) {
    return store.removeIMConversation(id);
  }

  return {
    normalizeInbound: normalizeInbound,
    receive: receive,
    createChannel: createChannel,
    listChannels: listChannels,
    getChannel: getChannel,
    updateChannel: updateChannel,
    removeChannel: removeChannel,
    listConversations: listConversations,
    listConversationMessages: listConversationMessages,
    removeConversation: removeConversation,
  };
}

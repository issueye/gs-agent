function clip(text, max) {
  text = String(text || "");
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max) + "...";
}

function compactWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function decodeHtml(text) {
  return String(text || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&nbsp;", " ");
}

function removeBlocks(text, startTag, endTag) {
  let out = "";
  let rest = String(text || "");
  while (true) {
    let lower = rest.toLowerCase();
    let start = lower.indexOf(startTag);
    if (start < 0) {
      return out + rest;
    }
    out = out + rest.slice(0, start) + " ";
    let end = lower.indexOf(endTag, start);
    if (end < 0) {
      return out;
    }
    rest = rest.slice(end + endTag.length);
  }
}

function htmlToText(html) {
  let text = String(html || "");
  text = removeBlocks(text, "<script", "</script>");
  text = removeBlocks(text, "<style", "</style>");
  text = removeBlocks(text, "<svg", "</svg>");
  text = removeBlocks(text, "<noscript", "</noscript>");
  text = text.replace(/<meta[^>]*>/gi, " ");
  text = text.replace(/<link[^>]*>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  return compactWhitespace(decodeHtml(text));
}

function sanitizeSearchResult(item) {
  return {
    title: clip(compactWhitespace(decodeHtml(item.title || "")), 120),
    url: clip(compactWhitespace(decodeHtml(item.url || "")), 240),
    description: clip(compactWhitespace(decodeHtml(item.description || "")), 220),
  };
}

function sanitizeWebSearch(result) {
  if (!result || !result.result || !result.result.results) {
    return result;
  }

  let next = {
    ok: result.ok,
    name: result.name,
    result: {
      ok: result.result.ok,
      provider: result.result.provider,
      query: result.result.query,
      results: [],
    },
  };

  for (let item of result.result.results) {
    if (next.result.results.length >= 5) {
      break;
    }
    next.result.results.push(sanitizeSearchResult(item));
  }
  return next;
}

function sanitizeWebFetch(result) {
  if (!result || !result.result) {
    return result;
  }

  let fetched = result.result;
  let text = fetched.text || "";
  let contentType = String(fetched.contentType || "").toLowerCase();
  if (contentType.includes("html") || text.includes("<html") || text.includes("<!DOCTYPE")) {
    text = htmlToText(text);
  } else {
    text = compactWhitespace(decodeHtml(text));
  }

  text = clip(text, 1800);
  return {
    ok: result.ok,
    name: result.name,
    result: {
      ok: fetched.ok,
      url: fetched.url,
      status: fetched.status,
      statusText: fetched.statusText,
      contentType: fetched.contentType,
      contentLength: fetched.contentLength,
      truncated: fetched.truncated || String(fetched.text || "").length !== text.length,
      text: text,
    },
  };
}

export function sanitizeToolResult(name, result) {
  if (name === "web_search") {
    return sanitizeWebSearch(result);
  }
  if (name === "web_fetch") {
    return sanitizeWebFetch(result);
  }
  return result;
}

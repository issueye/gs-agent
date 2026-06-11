function trim(value) {
  return String(value || "").trim();
}

function findProvider(store, key) {
  let providers = store.listProviderSecrets();
  for (let provider of providers) {
    if (provider.enabled === false) {
      continue;
    }
    if (provider.id === key || provider.name === key) {
      return provider;
    }
  }
  return undefined;
}

function findModel(store, providerID, name) {
  let models = store.listProviderModels(providerID);
  for (let model of models) {
    if (model.enabled === false) {
      continue;
    }
    if (model.name === name || model.id === name) {
      return model;
    }
  }
  return undefined;
}

function patternMatches(pattern, model) {
  let p = trim(pattern);
  let text = trim(model);
  if (p === "") {
    return text === "";
  }
  if (p === "*") {
    return true;
  }
  if (p.indexOf("*") < 0) {
    return p === text;
  }
  let pieces = p.split("*");
  let cursor = 0;
  for (let i = 0; i < pieces.length; i = i + 1) {
    let part = pieces[i];
    if (part === "") {
      continue;
    }
    let found = text.indexOf(part, cursor);
    if (found < 0) {
      return false;
    }
    if (i === 0 && !p.startsWith("*") && found !== 0) {
      return false;
    }
    cursor = found + part.length;
  }
  let last = pieces[pieces.length - 1];
  if (!p.endsWith("*") && last !== "" && !text.endsWith(last)) {
    return false;
  }
  return true;
}

function ruleMatches(rule, downstream, requestedModel) {
  if (trim(rule.match_protocol) !== "" && trim(rule.match_protocol) !== downstream) {
    return false;
  }
  return patternMatches(rule.match_model_pattern, requestedModel);
}

function makeRoute(name, provider, upstreamProtocol, model, source, priority, maxTokens) {
  return {
    name: name,
    upstream_protocol: upstreamProtocol || provider.protocol,
    model: model,
    default_max_tokens: maxTokens,
    source: source,
    priority: priority || 0,
    provider: provider,
  };
}

export function createRouteResolver(store, config) {
  function resolve(downstream, requestedModel) {
    let modelName = trim(requestedModel);
    if (modelName.indexOf("/") > 0) {
      let parts = modelName.split("/");
      let providerName = trim(parts[0]);
      let directModelName = trim(parts.slice(1).join("/"));
      let provider = findProvider(store, providerName);
      if (!provider) {
        throw "direct route provider " + providerName + " was not found or is disabled";
      }
      let model = findModel(store, provider.id, directModelName);
      if (!model) {
        throw "direct route model " + directModelName + " was not found or is disabled for provider " + providerName;
      }
      return makeRoute(provider.name + "/" + model.name, provider, provider.protocol, model.name, "direct", 0, model.max_tokens || config.defaultMaxTokens);
    }

    let rules = store.listEnabledRoutingRules();
    for (let rule of rules) {
      if (!ruleMatches(rule, downstream, modelName)) {
        continue;
      }
      let provider = findProvider(store, trim(rule.target_provider_id));
      if (!provider) {
        throw "routing rule " + rule.name + " targets missing or disabled provider " + rule.target_provider_id;
      }
      let targetModel = trim(rule.target_model) || modelName;
      if (targetModel === "") {
        throw "routing rule " + rule.name + " did not specify a target model";
      }
      let model = findModel(store, provider.id, targetModel);
      if (!model) {
        throw "routing rule " + rule.name + " targets missing or disabled model " + targetModel + " for provider " + provider.name;
      }
      return makeRoute(rule.name, provider, trim(rule.upstream_protocol) || provider.protocol, model.name, "routing_rule:" + rule.id, rule.priority, model.max_tokens || config.defaultMaxTokens);
    }

    if (modelName === "") {
      throw "no route matched downstream protocol " + downstream;
    }
    throw "no route matched downstream protocol " + downstream + " and model " + modelName;
  }

  function plan(downstream, requestedModel) {
    let out = {
      downstream_protocol: downstream,
      requested_model: requestedModel || "",
      candidates: [],
    };
    try {
      out.candidates.push(resolve(downstream, requestedModel));
    } catch (err) {
      out.error = String(err);
    }
    return out;
  }

  return {
    resolve: resolve,
    plan: plan,
  };
}

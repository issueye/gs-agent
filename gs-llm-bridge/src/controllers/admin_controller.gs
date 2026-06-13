import { ok, created, fail, page } from "@/views/response";
import { apiKey, isLoopback } from "@/services/client_info";

function notFound(res, message) {
  return fail(res, 404, "NOT_FOUND", message);
}

function param(req, snake, camel) {
  let params = (req || {}).params || {};
  return params[snake] || params[camel] || "";
}

export function createAdminController(model) {
  let store = model.store;

  function auth(req, res, next) {
    let key = apiKey(req);
    if (key === "" && model.config.allowLocalWithoutAuth && isLoopback(req)) {
      return next();
    }
    if (key !== "" && store.verifyAPIKey(key, "admin")) {
      return next();
    }
    return fail(res, 401, "UNAUTHORIZED", "invalid admin api key");
  }

  function listProviders(req, res) {
    return ok(res, page(store.listProviders(), req.query || {}));
  }

  function saveProvider(req, res) {
    let body = req.body || {};
    let providerID = param(req, "provider_id", "providerId");
    if (providerID) {
      body.id = providerID;
    }
    return ok(res, store.saveProvider(body));
  }

  function deleteProvider(req, res) {
    let item = store.deleteProvider(param(req, "provider_id", "providerId"));
    if (!item) {
      return notFound(res, "provider not found");
    }
    return ok(res, { deleted: true });
  }

  function listProviderModels(req, res) {
    let providerID = param(req, "provider_id", "providerId");
    if (!store.getProvider(providerID)) {
      return notFound(res, "provider not found");
    }
    return ok(res, page(store.listProviderModels(providerID), req.query || {}));
  }

  function saveProviderModel(req, res) {
    let body = req.body || {};
    let providerID = param(req, "provider_id", "providerId");
    if (req.params && req.params.id) {
      body.id = req.params.id;
    }
    let item = store.saveProviderModel(providerID, body);
    if (!item) {
      return notFound(res, "provider not found");
    }
    return ok(res, item);
  }

  function deleteProviderModel(req, res) {
    let providerID = param(req, "provider_id", "providerId");
    if (!store.getProvider(providerID)) {
      return notFound(res, "provider not found");
    }
    let item = store.deleteProviderModel(providerID, req.params.id);
    if (!item) {
      return notFound(res, "provider model not found");
    }
    return ok(res, { deleted: true });
  }

  function listEndpoints(req, res) {
    return ok(res, page(store.listEndpoints(), req.query || {}));
  }

  function saveEndpoint(req, res) {
    let body = req.body || {};
    if (req.params && req.params.id) {
      body.id = req.params.id;
    }
    return ok(res, store.saveEndpoint(body));
  }

  function deleteEndpoint(req, res) {
    let item = store.deleteEndpoint(req.params.id);
    if (!item) {
      return notFound(res, "endpoint not found");
    }
    return ok(res, { deleted: true });
  }

  function listRoutingRules(req, res) {
    return ok(res, page(store.listRoutingRules(), req.query || {}));
  }

  function saveRoutingRule(req, res) {
    let body = req.body || {};
    if (req.params && req.params.id) {
      body.id = req.params.id;
    }
    return ok(res, store.saveRoutingRule(body));
  }

  function deleteRoutingRule(req, res) {
    let item = store.deleteRoutingRule(req.params.id);
    if (!item) {
      return notFound(res, "routing rule not found");
    }
    return ok(res, { deleted: true });
  }

  function listAPIKeys(req, res) {
    return ok(res, page(store.listAPIKeys(), req.query || {}));
  }

  function apiKeySecret(req, res) {
    let item = store.getAPIKeySecret(req.params.id);
    if (!item) {
      return notFound(res, "api key not found");
    }
    return ok(res, item);
  }

  function createAPIKey(req, res) {
    return created(res, store.createAPIKey(req.body || {}));
  }

  function deleteAPIKey(req, res) {
    let item = store.deleteAPIKey(req.params.id);
    if (!item) {
      return notFound(res, "api key not found");
    }
    return ok(res, { deleted: true });
  }

  function listTraffic(req, res) {
    return ok(res, page(store.listTraffic(req.query ? req.query.limit : 500), req.query || {}));
  }

  function clearTraffic(req, res) {
    store.clearTraffic();
    return ok(res, { cleared: true });
  }

  return {
    auth: auth,
    listProviders: listProviders,
    saveProvider: saveProvider,
    deleteProvider: deleteProvider,
    listProviderModels: listProviderModels,
    saveProviderModel: saveProviderModel,
    deleteProviderModel: deleteProviderModel,
    listEndpoints: listEndpoints,
    saveEndpoint: saveEndpoint,
    deleteEndpoint: deleteEndpoint,
    listRoutingRules: listRoutingRules,
    saveRoutingRule: saveRoutingRule,
    deleteRoutingRule: deleteRoutingRule,
    listAPIKeys: listAPIKeys,
    apiKeySecret: apiKeySecret,
    createAPIKey: createAPIKey,
    deleteAPIKey: deleteAPIKey,
    listTraffic: listTraffic,
    clearTraffic: clearTraffic,
  };
}

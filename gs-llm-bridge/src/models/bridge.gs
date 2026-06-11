import { openBridgeStore } from "@/models/store";
import { createRouteResolver } from "@/services/route_resolver";
import { createProxyService } from "@/services/proxy_service";

export function createBridgeModel(config) {
  let store = openBridgeStore(config.storePath, config);
  let resolver = createRouteResolver(store, config);
  let proxy = createProxyService(config, store, resolver);

  return {
    config: config,
    store: store,
    resolver: resolver,
    proxy: proxy,
    startedAt: (new Date()).toISOString(),
  };
}

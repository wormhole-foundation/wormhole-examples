import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { listen } from "./listen";
import { worker } from "./worker";
import { rest } from "./rest";
import * as helpers from "./helpers";
import { logger } from "./helpers";
import { PromHelper } from "./promHelpers";

var configFile: string = ".env";
if (process.env.PYTH_RELAY_CONFIG) {
  configFile = process.env.PYTH_RELAY_CONFIG;
}

console.log("Loading config file [%s]", configFile);
require("dotenv").config({ path: configFile });

setDefaultWasm("node");

// Set up the logger.
helpers.initLogger();

var listenOnly: boolean = false;
for (let idx = 0; idx < process.argv.length; ++idx) {
  if (process.argv[idx] === "--listen_only") {
    logger.info("running in listen only mode, will not relay anything!");
    listenOnly = true;
  }
}
// Start the Prometheus client with the app name and http port
var promPort = 8081;
if (process.env.PROM_PORT) {
  promPort = parseInt(process.env.PROM_PORT);
}
logger.info("prometheus client listening on port " + promPort);
const promClient = new PromHelper("pyth_relay", promPort);

// Start the spy listener to listen to the guardians.
listen(listenOnly, promClient);

if (!listenOnly) {
  // Start the spy worker to relay messages.
  worker(promClient);

  // Start the REST server, if configured.
  if (process.env.REST_PORT) {
    var restPort = parseInt(process.env.REST_PORT);
    if (!restPort) {
      logger.error(
        "Environment variable REST_PORT is set to [" +
          process.env.REST_PORT +
          "], which is not a valid port number."
      );
      process.exit(1);
    }

    rest(restPort);
  }
}

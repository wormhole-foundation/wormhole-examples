import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { listen } from "./listen";
import { worker } from "./worker";
import { rest } from "./rest";
import * as helpers from "./helpers";
import { logger } from "./helpers";

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

// Start the spy listener to listen to the guardians.
listen(listenOnly);

// Start the spy worker to relay messages.
if (!listenOnly) {
  worker();
}

// Start the REST server, if configured.
if (!listenOnly && process.env.REST_PORT) {
  var restPort = parseInt(process.env.REST_PORT);
  if (!restPort) {
    console.error(
      "Environment variable REST_PORT is set to [%s], which is not a valid port number.",
      process.env.REST_PORT
    );
    process.exit(1);
  }

  rest(restPort);
}

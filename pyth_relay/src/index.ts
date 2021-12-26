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

var runListen: boolean = true;
var runWorker: boolean = true;
var runRest: boolean = true;
var foundOne: boolean = false;

for (let idx = 0; idx < process.argv.length; ++idx) {
  if (process.argv[idx] === "--listen_only") {
    if (foundOne) {
      console.error(
        'May only specify one of "--listen_only", "--worker_only" or "--rest_only"'
      );
      process.exit(1);
    }
    runWorker = false;
    runRest = false;
    foundOne = true;
  }

  if (process.argv[idx] === "--worker_only") {
    if (foundOne) {
      console.error(
        'May only specify one of "--listen_only", "--worker_only" or "--rest_only"'
      );
      process.exit(1);
    }
    runListen = false;
    runRest = false;
    foundOne = true;
  }

  if (process.argv[idx] === "--rest_only") {
    if (foundOne) {
      console.error(
        'May only specify one of "--listen_only", "--worker_only" or "--rest_only"'
      );
      process.exit(1);
    }
    runListen = false;
    runWorker = false;
    foundOne = true;
  }
}

// Start the spy listener to listen to the guardians.
if (runListen) {
  listen();
}

// Start the spy worker to process VAAs from the store.
if (runWorker) {
  worker();
}

// Start the REST server, if configured.
if (runRest && process.env.REST_PORT) {
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

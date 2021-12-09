import { spy_listen } from "./spy_listen";
import { spy_worker } from "./spy_worker";
import { spy_rest } from "./spy_rest";
import * as helpers from "./helpers";

require("dotenv").config();

// Start the spy listener to listen to the guardians.
spy_listen();

// Start the spy worker to process VAAs from the store.
spy_worker();

// Start the REST server, if configured.
if (process.env.SPY_REST_PORT) {
  var restPort = parseInt(process.env.SPY_REST_PORT);
  if (!restPort) {
    console.error(
      "Environment variable SPY_REST_PORT is set to [%s], which is not a valid port number.",
      process.env.SPY_REST_PORT
    );
    process.exit(1);
  }

  spy_rest(restPort);
}

import { createClient } from "redis";
import * as helpers from "./helpers";

const express = require("express");
const app = express();

require("dotenv").config();
if (!process.env.SPY_REST_PORT) {
  console.error("Missing environment variable SPY_REST_PORT");
  process.exit(1);
}

const RestPort = process.env.SPY_REST_PORT;
app.listen(RestPort, () => console.log("listening on port %d!", RestPort));

(async () => {
  const rclient = createClient();
  await rclient.connect();

  app.get("/query/:chain_id/:emitter_address/:sequence", async (req, res) => {
    var key: helpers.StoreKey = {
      chain_id: parseInt(req.params.chain_id),
      emitter_address: req.params.emitter_address,
      sequence: parseInt(req.params.sequence),
    };

    var result = await rclient.get(helpers.storeKeyToJson(key));
    console.log(
      "look up of [%s] returning [%s]",
      helpers.storeKeyToJson(key),
      result
    );

    res.json(result);
  });

  app.get("/", (req, res) =>
    res.json("/query/<chain_id>/<emitter_address>/<sequence>")
  );
})();

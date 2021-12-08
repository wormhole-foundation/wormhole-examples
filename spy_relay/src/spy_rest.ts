import { ChainId } from "@certusone/wormhole-sdk";

import { createClient } from "redis";
import * as helpers from "./helpers";

import axios from "axios";

const RELAYER_URL = "http://localhost:3001/relay";

const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());

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

  app.get("/submit/:chain_id/:emitter_address/:sequence", async (req, res) => {
    var key: helpers.StoreKey = {
      chain_id: parseInt(req.params.chain_id),
      emitter_address: req.params.emitter_address,
      sequence: parseInt(req.params.sequence),
    };

    var payload = await rclient.get(helpers.storeKeyToJson(key));
    if (payload) {
      var vaaBytes = helpers.storePayloadFromJson(payload).vaa_bytes;
      console.log(
        "submitting [%s] payload [%s], vaaBytes:",
        helpers.storeKeyToJson(key),
        payload,
        vaaBytes
      );

      const result = await axios.post(RELAYER_URL, {
        chainId: key.chain_id as ChainId,
        signedVAA: vaaBytes,
      });

      // result = "submitted";
      res.json(result);
    } else {
      res.json(null);
    }
  });

  app.get("/", (req, res) =>
    res.json("/query/<chain_id>/<emitter_address>/<sequence>")
  );
})();

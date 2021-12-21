import { createClient } from "redis";
import axios from "axios";
import { ChainId } from "@certusone/wormhole-sdk";
import * as helpers from "./helpers";
import { query } from "./relay/main";

export async function rest(restPort: number) {
  const RELAYER_URL = "http://localhost:3001/relay";

  const express = require("express");
  const cors = require("cors");
  const app = express();
  app.use(cors());

  app.listen(restPort, () =>
    console.log("listening on REST port %d!", restPort)
  );

  (async () => {
    app.get("/querydb/:product_id/:price_id", async (req, res) => {
      var key: helpers.StoreKey = {
        product_id: req.params.product_id,
        price_id: req.params.price_id,
      };

      const rclient = createClient();
      await rclient.connect();

      await rclient.select(helpers.INCOMING);
      var result = await rclient.get(helpers.storeKeyToJson(key));
      if (result) {
        console.log(
          "REST query of [%s] found entry in incoming store, returning [%s]",
          helpers.storeKeyToJson(key),
          result
        );
      } else {
        await rclient.select(helpers.WORKING);
        var result = await rclient.get(helpers.storeKeyToJson(key));
        console.log(
          "REST query of [%s] looked for entry in incoming store, returning [%s]",
          helpers.storeKeyToJson(key),
          result
        );
      }

      res.json(result);
    });

    app.get("/queryterra/:product_id", async (req, res) => {
      var result = await query(req.params.product_id);
      res.json(result);
    });

    app.get("/", (req, res) =>
      res.json(["/querydb/<product_id>/<price_id>", "/queryterra/<product_id>"])
    );
  })();
}

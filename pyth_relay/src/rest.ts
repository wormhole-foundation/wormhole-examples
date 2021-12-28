import { createClient } from "redis";
import axios from "axios";
import { ChainId } from "@certusone/wormhole-sdk";
import * as helpers from "./helpers";
import { logger } from "./helpers";
import { getStatus } from "./worker";
import { query } from "./relay/main";

export async function rest(restPort: number) {
  const RELAYER_URL = "http://localhost:3001/relay";

  const express = require("express");
  const cors = require("cors");
  const app = express();
  app.use(cors());

  app.listen(restPort, () =>
    logger.debug("listening on REST port " + restPort)
  );

  (async () => {
    app.get("/status", async (req, res) => {
      var result = await getStatus();
      res.json(result);
    });

    app.get("/queryterra/:product_id", async (req, res) => {
      var result = await query(req.params.product_id);
      res.json(result);
    });

    app.get("/", (req, res) =>
      res.json(["/status", "/queryterra/<product_id>"])
    );
  })();
}

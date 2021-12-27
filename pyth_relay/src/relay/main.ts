import {
  connectToTerra,
  queryTerra,
  relayTerra,
  TerraConnectionData,
} from "./terra";

export type ConnectionData = {
  terraData: TerraConnectionData;
};

import { logger } from "../helpers";

export function connectRelayer(workerIdx: number): ConnectionData {
  var td = connectToTerra(workerIdx);
  return { terraData: td };
}

export async function relay(
  signedVAA: string,
  connectionData: ConnectionData
): Promise<any> {
  return await relayTerra(connectionData.terraData, signedVAA);
}

export async function query(productIdStr: string): Promise<any> {
  var result: any;
  try {
    var terraData = connectToTerra(0);
    result = await queryTerra(terraData, productIdStr);
  } catch (e) {
    logger.error("query failed: %o", e);
    result = "Error: " + e.message;
  }

  return result;
}

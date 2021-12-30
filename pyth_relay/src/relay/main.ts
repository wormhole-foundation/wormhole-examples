import {
  connectToTerra,
  queryBalanceOnTerra,
  queryTerra,
  relayTerra,
  TerraConnectionData,
} from "./terra";

export type ConnectionData = {
  terraData: TerraConnectionData;
};

import { logger } from "../helpers";

export function connectRelayer(): ConnectionData {
  var td = connectToTerra();
  return { terraData: td };
}

export async function relay(
  signedVAA: string,
  connectionData: ConnectionData
): Promise<any> {
  return await relayTerra(connectionData.terraData, signedVAA);
}

export async function query(priceIdStr: string): Promise<any> {
  var result: any;
  try {
    var terraData = connectToTerra();
    result = await queryTerra(terraData, priceIdStr);
  } catch (e) {
    logger.error("query failed: %o", e);
    result = "Error: " + e.message;
  }

  return result;
}

export async function queryBalance(
  connectionData: ConnectionData
): Promise<number> {
  var balance: number = NaN;
  try {
    balance = await queryBalanceOnTerra(connectionData.terraData);
  } catch (e) {
    logger.error("balance query failed: %o", e);
  }

  return balance;
}

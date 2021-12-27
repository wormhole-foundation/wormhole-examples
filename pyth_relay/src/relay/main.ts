import {
  connectToTerra,
  queryTerra,
  relayTerra,
  TerraConnectionData,
} from "./terra";

export type ConnectionData = {
  terraData: TerraConnectionData;
};

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
  var terraData = connectToTerra(0);
  return await queryTerra(terraData, productIdStr);
}

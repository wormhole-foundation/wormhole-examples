import { useCallback, useState } from "react";
import { useSnackbar } from "notistack";
import {
  ChainId,
  getEmitterAddressTerra,
  parseSequenceFromLogTerra,
} from "@certusone/wormhole-sdk";
import getSignedVAAWithRetry from "@certusone/wormhole-sdk/lib/esm/rpc/getSignedVAAWithRetry";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/esm/solana/wasm";
import { ChainUI } from "./ChainUI";
import { MsgExecuteContract, LCDClient } from "@terra-money/terra.js";
import { useTerraWallet } from "./contexts/TerraWalletContext";
import { address as TERRA_CONTRACT_ADDRESS } from "./contract-addresses/terra";
import { SentVaaData, parseError, WORMHOLE_RPC_HOSTS } from "./App";

export function TerraChain({
  name,
  chainId,
  addMessage,
  getSelectedVaa,
  appMsgIdx,
}: {
  name: string;
  chainId: ChainId;
  addMessage: (m: SentVaaData) => void;
  getSelectedVaa: () => SentVaaData;
  appMsgIdx: number;
}) {
  const {
    //    connect: terraConnect,
    //    disconnect: terraDisconnect,
    connected: terraConnected,
    wallet: terraWallet,
  } = useTerraWallet();
  const [messageText, setMessageText] = useState("");
  const [resultText, setResultText] = useState("");
  const { enqueueSnackbar } = useSnackbar(); //closeSnackbar

  const handleChange = useCallback((event) => {
    setMessageText(event.target.value);
  }, []);

  const processClickHandler = useCallback(() => {
    console.log("---Process---- idx:" + appMsgIdx);
    const vaaData = getSelectedVaa();
    console.log(
      "vaa seq: " +
        vaaData.vaa.sequence +
        " chain: " +
        vaaData.vaa.emitter_chain +
        " will be processed on:" +
        chainId
    );
    console.log("string was: " + Buffer.from(vaaData.vaa.payload).toString());
    // console.log('emmiter: '+vaaData.vaa.emitter_address);
    if (!terraConnected) return;
    (async () => {
      try {
        // TBD: Verify on messenger
        setResultText(
          "Partial Success: " + Buffer.from(vaaData.vaa.payload).toString()
        );
      } catch (e) {
        console.log("receiveBytes failed ", e);
        setResultText("Exception: " + parseError(e));
        enqueueSnackbar("EXCEPTION in Process: " + parseError(e), {
          persist: false,
        });
      }
    })();
  }, [terraConnected, chainId, appMsgIdx, getSelectedVaa, enqueueSnackbar]);

  const sendClickHandler = useCallback(() => {
    if (!terraConnected) return;
    (async () => {
      try {
        // Sending message to Wormhole and waiting for it to be signed.
        // 1. Create and post string transaction.
        const sendMsg = new MsgExecuteContract(
          terraWallet.wallets[0].terraAddress,
          TERRA_CONTRACT_ADDRESS,
          {
            SendMessage: {
              nonce: 1,
              text: messageText,
            },
          },
          {}
        );

        const txResult = await terraWallet.post({
          msgs: [sendMsg],
          //memo: "???",
        });

        // 2. Wait for receipt.
        const TERRA_HOST = {
          URL: "http://localhost:1317",
          chainID: "columbus-5",
          name: "localterra",
        };
        const lcd = new LCDClient(TERRA_HOST);
        let info;
        while (!info) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          try {
            info = await lcd.tx.txInfo(txResult.result.txhash);
          } catch (e) {
            console.error(e);
          }
        }
        if (info.code !== undefined && info.code !== 0) {
          // error code
          throw new Error(
            `Tx ${txResult.result.txhash}: error code ${info.code}: ${info.raw_log}`
          );
        }

        const sequence = parseSequenceFromLogTerra(info);
        console.log(sequence);

        // 3. Retrieve signed VAA. For this chain and sequence.
        const { vaaBytes } = await getSignedVAAWithRetry(
          WORMHOLE_RPC_HOSTS,
          chainId,
          await getEmitterAddressTerra(TERRA_CONTRACT_ADDRESS),
          sequence.toString()
        );
        // 4. Parse signed VAA and store it for display and use.
        // VAA use example is in part2.
        const { parse_vaa } = await importCoreWasm();
        const parsedVaa = parse_vaa(vaaBytes);
        console.log(parsedVaa);
        addMessage({ vaa: parsedVaa, bytes: vaaBytes });
      } catch (e) {
        console.log("EXCEPTION in Send: " + e);
        enqueueSnackbar("EXCEPTION in Send: " + parseError(e), {
          persist: false,
        });
      }
    })();
  }, [
    chainId,
    messageText,
    addMessage,
    enqueueSnackbar,
    terraConnected,
    terraWallet,
  ]);

  return ChainUI(
    name,
    messageText,
    handleChange,
    sendClickHandler,
    terraConnected ? "Y" : undefined,
    processClickHandler,
    appMsgIdx,
    resultText
  );
}

import { useCallback, useState } from "react";
import { useSnackbar } from "notistack";
import {
  ChainId,
  createNonce,
  //getBridgeFeeIx,
  getEmitterAddressEth,
  parseSequenceFromLogEth,
} from "@certusone/wormhole-sdk";

import getSignedVAAWithRetry from "@certusone/wormhole-sdk/lib/esm/rpc/getSignedVAAWithRetry";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/esm/solana/wasm";
import { ChainUI } from "./ChainUI";
import { useEthereumProvider } from "./contexts/EthereumProviderContext";
import { Messenger__factory } from "./ethers-contracts";
import {
  SentVaaData,
  switchProviderNetwork,
  chainToContract,
  parseError,
  WORMHOLE_RPC_HOSTS,
} from "./App";

export function EVMChain({
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
  const { provider, signer, signerAddress } = useEthereumProvider();
  const [messageText, setMessageText] = useState("");
  const [resultText, setResultText] = useState("");
  const handleChange = useCallback((event) => {
    setMessageText(event.target.value);
  }, []);
  const { enqueueSnackbar } = useSnackbar(); //closeSnackbar

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
    if (!signer || !provider) return;
    (async () => {
      try {
        await switchProviderNetwork(provider, chainId);
        const Messenger = Messenger__factory.connect(
          chainToContract(chainId),
          signer
        );
        const nonce = createNonce();
        const sendTx = await Messenger.receiveBytes(vaaData.bytes, nonce);
        const sendReceipt = await sendTx.wait();
        console.log(sendReceipt);
        setResultText(
          "Success: " + Buffer.from(vaaData.vaa.payload).toString()
        );
      } catch (e) {
        console.log("receiveBytes failed ", e);
        setResultText("Exception: " + parseError(e));
        enqueueSnackbar("EXCEPTION in Process: " + parseError(e), {
          persist: false,
        });
      }
    })();
  }, [signer, provider, chainId, appMsgIdx, getSelectedVaa, enqueueSnackbar]); //appMsgIdx, getSelectedVaa]);

  const sendClickHandler = useCallback(() => {
    if (!signer || !provider) return;
    (async () => {
      try {
        await switchProviderNetwork(provider, chainId);
        const Messenger = Messenger__factory.connect(
          chainToContract(chainId),
          signer
        );
        const nonce = createNonce();
        // Sending message to Wormhole and waiting for it to be signed.
        // 1. Send string transaction. And wait for Receipt.
        // sendStr is defined in example contract Messenger.sol
        const sendTx = await Messenger.sendStr(
          new Uint8Array(Buffer.from(messageText)),
          nonce
        );
        const sendReceipt = await sendTx.wait();
        // 2. Call into wormhole sdk to get this message sequence.
        // Sequence is specific to originator.
        const sequence = parseSequenceFromLogEth(
          sendReceipt,
          await Messenger.wormhole()
        );
        // 3. Retrieve signed VAA. For this chain and sequence.
        const { vaaBytes } = await getSignedVAAWithRetry(
          WORMHOLE_RPC_HOSTS,
          chainId,
          getEmitterAddressEth(chainToContract(chainId)),
          sequence.toString()
        );
        // 4. Parse signed VAA and store it for display and use.
        // VAA use example is in part2.
        const { parse_vaa } = await importCoreWasm();
        addMessage({ vaa: parse_vaa(vaaBytes), bytes: vaaBytes });
      } catch (e) {
        console.log("EXCEPTION in Send: " + e);
        enqueueSnackbar("EXCEPTION in Send: " + parseError(e), {
          persist: false,
        });
      }
    })();
  }, [provider, signer, chainId, messageText, addMessage, enqueueSnackbar]);
  return ChainUI(
    name,
    messageText,
    handleChange,
    sendClickHandler,
    signerAddress,
    processClickHandler,
    appMsgIdx,
    resultText
  );
}

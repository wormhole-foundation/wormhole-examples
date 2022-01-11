import { useCallback, useState } from "react";
import { useSnackbar } from "notistack";
import {
  ChainId,
  CHAIN_ID_SOLANA,
  getEmitterAddressSolana,
  hexToNativeString,
  ixFromRust,
  parseSequenceFromLogSolana,
  postVaaSolanaWithRetry,
  getClaimAddressSolana,
} from "@certusone/wormhole-sdk";
import getSignedVAAWithRetry from "@certusone/wormhole-sdk/lib/esm/rpc/getSignedVAAWithRetry";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/esm/solana/wasm";
import { ChainUI } from "./ChainUI";
import {
  Connection,
  Keypair,
  //  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { useSolanaWallet } from "./contexts/SolanaWalletContext";
import {
  SentVaaData,
  parseError,
  SOLANA_HOST,
  SOLANA_PROGRAM,
  WORMHOLE_RPC_HOSTS,
} from "./App";
//import { ExplicitTwoTone } from "@mui/icons-material";
//import { PublicKey } from "@solana/web3.js";

const SOLANA_BRIDGE_ADDRESS = "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o";

export function SolanaChain({
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
  const { publicKey, signTransaction } = useSolanaWallet();
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
    if (!publicKey || !signTransaction) return;
    (async () => {
      try {
        const connection = new Connection(SOLANA_HOST, "confirmed");
        // Verify VAA on core bridge and create VAA R/O account.
        //console.log("vaaData.bytes.length=" + vaaData.bytes.length);
        await postVaaSolanaWithRetry(
          connection,
          signTransaction,
          SOLANA_BRIDGE_ADDRESS,
          publicKey.toString(),
          Buffer.from(vaaData.bytes),
          0
        );

        // Check if this VAA was processed already. This will be re-checked on contract.
        const claimAddress = await getClaimAddressSolana(
          SOLANA_PROGRAM, // for claims on bridge use SOLANA_BRIDGE_ADDRESS,
          vaaData.bytes
        );
        const claimInfo = await connection.getAccountInfo(claimAddress);
        // Check if this VAA has been processed already. It will be checked in the contract also.
        console.log("claimAddress: " + claimAddress.toString());
        if (!claimInfo) {
          //  console.log("Not Claimed");
        } else {
          //  console.log("Claimed");
          throw new Error("This message was already processed");
        }

        // Call into messenger with signed VAA.
        const { confirm_message_ix } = await import(
          "wormhole-messenger-solana"
        );
        const ix = ixFromRust(
          confirm_message_ix(
            SOLANA_PROGRAM,
            publicKey.toString(),
            claimAddress.toString(),
            new Uint8Array(Buffer.from(vaaData.bytes)) // Vaa is needed to form instruction. It is not used by contract.
          )
        );
        const transaction = new Transaction().add(ix);
        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
        const signed = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signed.serialize());
        console.log(txid);
        await connection.confirmTransaction(txid);
        // All back
        setResultText(
          "Success. Message: " + Buffer.from(vaaData.vaa.payload).toString()
        );
      } catch (e) {
        console.log("receiveBytes failed ", e);
        setResultText("Exception: " + parseError(e));
        enqueueSnackbar("EXCEPTION in Process: " + parseError(e), {
          persist: false,
        });
      }
    })();
  }, [
    publicKey,
    signTransaction,
    chainId,
    appMsgIdx,
    getSelectedVaa,
    enqueueSnackbar,
  ]);

  const sendClickHandler = useCallback(() => {
    console.log("Solana account key: " + publicKey);
    if (!publicKey || !signTransaction) return;
    (async () => {
      try {
        const connection = new Connection(SOLANA_HOST, "confirmed");
        const { send_message_ix } = await import("wormhole-messenger-solana");
        const messageKey = Keypair.generate();
        console.log("message key: ", messageKey.publicKey.toString());
        const emitter = hexToNativeString(
          await getEmitterAddressSolana(SOLANA_PROGRAM),
          CHAIN_ID_SOLANA
        );
        if (!emitter) {
          throw new Error(
            "An error occurred while calculating the emitter address"
          );
        }
        const ix = ixFromRust(
          send_message_ix(
            SOLANA_PROGRAM,
            publicKey.toString(),
            emitter,
            messageKey.publicKey.toString(),
            new Uint8Array(Buffer.from(messageText))
          )
        );
        const transaction = new Transaction().add(ix);
        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
        transaction.partialSign(messageKey);
        const signed = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signed.serialize());
        console.log(txid);
        await connection.confirmTransaction(txid);
        const info = await connection.getTransaction(txid);
        console.log(info);
        if (!info) {
          throw new Error(
            "An error occurred while fetching the transaction info"
          );
        }
        const sequence = parseSequenceFromLogSolana(info);
        console.log("seq: " + sequence);
        console.log("emitter: " + emitter);
        // 3. Retrieve signed VAA. For this chain and sequence.
        const { vaaBytes } = await getSignedVAAWithRetry(
          WORMHOLE_RPC_HOSTS,
          chainId,
          await getEmitterAddressSolana(SOLANA_PROGRAM),
          sequence.toString()
        );
        // 4. Parse signed VAA and store it for display and use.
        // VAA use example is in part2.
        const { parse_vaa } = await importCoreWasm();
        const parsedVaa = parse_vaa(vaaBytes);
        addMessage({ vaa: parsedVaa, bytes: vaaBytes });
        console.log(parsedVaa);
      } catch (e) {
        console.log("EXCEPTION in Send: " + e);
        enqueueSnackbar("EXCEPTION in Send: " + parseError(e), {
          persist: false,
        });
      }
    })();
  }, [
    publicKey,
    signTransaction,
    chainId,
    messageText,
    addMessage,
    enqueueSnackbar,
  ]);
  return ChainUI(
    name,
    messageText,
    handleChange,
    sendClickHandler,
    (publicKey && publicKey.toString()) || undefined,
    processClickHandler,
    appMsgIdx,
    resultText
  );
}

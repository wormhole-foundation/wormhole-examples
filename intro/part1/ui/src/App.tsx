import React, { useCallback, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";

// Wormhole
import {
  ChainId,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  createNonce,
  //  getBridgeFeeIx,
  getEmitterAddressEth,
  getEmitterAddressSolana,
  getEmitterAddressTerra,
  hexToNativeString,
  ixFromRust,
  parseSequenceFromLogEth,
  parseSequenceFromLogSolana,
  parseSequenceFromLogTerra,
} from "@certusone/wormhole-sdk";
import { uint8ArrayToNative } from "@certusone/wormhole-sdk/lib/esm";
import getSignedVAAWithRetry from "@certusone/wormhole-sdk/lib/esm/rpc/getSignedVAAWithRetry";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/esm/solana/wasm";

// Ethereum
import { hexlify, hexStripZeros } from "@ethersproject/bytes";
import { Web3Provider } from "@ethersproject/providers";
import { useEthereumProvider } from "./contexts/EthereumProviderContext";
import { Messenger__factory } from "./ethers-contracts";

// Terra
import { MsgExecuteContract, LCDClient } from "@terra-money/terra.js";
import { useTerraWallet } from "./contexts/TerraWalletContext";

// Solana
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { useSolanaWallet } from "./contexts/SolanaWalletContext";

// Deployed contract addresses.
import { address as ETH_CONTRACT_ADDRESS } from "./contract-addresses/development";
import { address as BSC_CONTRACT_ADDRESS } from "./contract-addresses/development2";
import { address as TERRA_CONTRACT_ADDRESS } from "./contract-addresses/terra";

interface ParsedVaa {
  consistency_level: number;
  emitter_address: Uint8Array;
  emitter_chain: ChainId;
  guardian_set_index: number;
  nonce: number;
  payload: Uint8Array;
  sequence: number;
  signatures: any;
  timestamp: number;
  version: number;
}

//const SOLANA_BRIDGE_ADDRESS = "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o";
const SOLANA_PROGRAM = require("./contract-addresses/solana.json").programId;
const SOLANA_HOST = "http://localhost:8899";
const WORMHOLE_RPC_HOSTS = ["http://localhost:7071"];

const chainToNetworkDec = (c: ChainId) => (c === 2 ? 1337 : c === 4 ? 1397 : 0);

const chainToNetwork = (c: ChainId) =>
  hexStripZeros(hexlify(chainToNetworkDec(c)));

const chainToContract = (c: ChainId) =>
  c === 2
    ? ETH_CONTRACT_ADDRESS
    : c === 4
    ? BSC_CONTRACT_ADDRESS
    : c === 3
    ? TERRA_CONTRACT_ADDRESS // This is actually not used because terra has separate TerraChain handler.
    : "";

const chainToName = (c: ChainId) =>
  c === 1
    ? "Solana"
    : c === 2
    ? "Ethereum"
    : c === 4
    ? "BSC"
    : c === 3
    ? "terra"
    : "Unknown";

const MM_ERR_WITH_INFO_START =
  "VM Exception while processing transaction: revert ";
const parseError = (e: any) =>
  e?.data?.message?.startsWith(MM_ERR_WITH_INFO_START)
    ? e.data.message.replace(MM_ERR_WITH_INFO_START, "")
    : e?.response?.data?.error // terra error
    ? e.response.data.error
    : e?.message
    ? e.message
    : "An unknown error occurred";

// This is metamask, Ethereum.
const switchProviderNetwork = async (
  provider: Web3Provider,
  chainId: ChainId
) => {
  await provider.send("wallet_switchEthereumChain", [
    { chainId: chainToNetwork(chainId) },
  ]);
  const cNetwork = await provider.getNetwork();
  // This is workaround for when Metamask fails to switch network.
  if (cNetwork.chainId !== chainToNetworkDec(chainId)) {
    console.log("switchProviderNetwork did not work");
    throw new Error("Metamask could not switch network");
  }
};

function Chain({
  name,
  value,
  onChange,
  onClick,
  disabled,
}: {
  name: string;
  value: string;
  onChange: any;
  onClick: any;
  disabled?: boolean;
}) {
  return (
    <Card sx={{ m: 2 }}>
      <CardHeader title={name} />
      <CardContent>
        <TextField
          multiline
          fullWidth
          rows="3"
          placeholder="Type a message"
          value={value}
          onChange={onChange}
        />
      </CardContent>
      <CardActions>
        <Button onClick={onClick} variant="contained" disabled={disabled}>
          Send
        </Button>
      </CardActions>
    </Card>
  );
}

function EVMChain({
  name,
  chainId,
  addMessage,
}: {
  name: string;
  chainId: ChainId;
  addMessage: (m: ParsedVaa) => void;
}) {
  const { provider, signer, signerAddress } = useEthereumProvider();
  const [messageText, setMessageText] = useState("");
  const { enqueueSnackbar } = useSnackbar(); //closeSnackbar

  const handleChange = useCallback((event) => {
    setMessageText(event.target.value);
  }, []);

  const sendClickHandler = useCallback(() => {
    if (!signer || !provider) return;
    (async () => {
      try {
        await switchProviderNetwork(provider, chainId);
        const sendMsg = Messenger__factory.connect(
          chainToContract(chainId),
          signer
        );
        const nonce = createNonce();
        // Sending message to Wormhole and waiting for it to be signed.
        // 1. Send string transaction. And wait for Receipt.
        // sendStr is defined in example contract Messenger.sol
        const sendTx = await sendMsg.sendStr(
          new Uint8Array(Buffer.from(messageText)),
          nonce
        );
        const sendReceipt = await sendTx.wait();
        // 2. Call into wormhole sdk to get this message sequence.
        // Sequence is specific to originator.
        const sequence = parseSequenceFromLogEth(
          sendReceipt,
          await sendMsg.wormhole()
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
        const parsedVaa = parse_vaa(vaaBytes);
        addMessage(parsedVaa);
      } catch (e) {
        console.log("EXCEPTION in Send: " + e);
        enqueueSnackbar("EXCEPTION in Send: " + parseError(e), {
          persist: false,
        });
      }
    })();
  }, [provider, signer, chainId, messageText, addMessage, enqueueSnackbar]);

  return (
    <Chain
      name={name}
      value={messageText}
      onChange={handleChange}
      onClick={sendClickHandler}
      disabled={!signerAddress}
    />
  );
}

function SolanaChain({
  name,
  chainId,
  addMessage,
}: {
  name: string;
  chainId: ChainId;
  addMessage: (m: ParsedVaa) => void;
}) {
  const { publicKey, signTransaction } = useSolanaWallet();
  const [messageText, setMessageText] = useState("");
  const { enqueueSnackbar } = useSnackbar(); //closeSnackbar

  const handleChange = useCallback((event) => {
    setMessageText(event.target.value);
  }, []);

  const sendClickHandler = useCallback(() => {
    if (!publicKey || !signTransaction) return;
    (async () => {
      try {
        const connection = new Connection(SOLANA_HOST, "confirmed");
        // const transferIx = await getBridgeFeeIx(
        //   connection,
        //   SOLANA_BRIDGE_ADDRESS,
        //   publicKey.toString()
        // );
        const { send_message_ix } = await import("wormhole-messenger-solana");
        const messageKey = Keypair.generate();
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
        //        const transaction = new Transaction().add(transferIx, ix);
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
        console.log(sequence);
        console.log(emitter);
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
        console.log(parsedVaa);
        addMessage(parsedVaa);
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

  return (
    <Chain
      name={name}
      value={messageText}
      onChange={handleChange}
      onClick={sendClickHandler}
      disabled={!publicKey}
    />
  );
}

function TerraChain({
  name,
  chainId,
  addMessage,
}: {
  name: string;
  chainId: ChainId;
  addMessage: (m: ParsedVaa) => void;
}) {
  const {
    //    connect: terraConnect,
    //    disconnect: terraDisconnect,
    connected: terraConnected,
    wallet: terraWallet,
  } = useTerraWallet();
  const [messageText, setMessageText] = useState("");
  const { enqueueSnackbar } = useSnackbar(); //closeSnackbar

  const handleChange = useCallback((event) => {
    setMessageText(event.target.value);
  }, []);

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
        addMessage(parsedVaa);
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

  return (
    <Chain
      name={name}
      value={messageText}
      onChange={handleChange}
      onClick={sendClickHandler}
      disabled={!terraConnected}
    />
  );
}

function App() {
  const { connect, disconnect, signerAddress } = useEthereumProvider();
  const {
    wallet: solanaWallet,
    wallets: solanaWallets,
    select: solanaSelect,
    connect: connectSolanaWallet,
    disconnect: disconnectSolanaWallet,
    publicKey: solanaPublicKey,
  } = useSolanaWallet();
  const {
    connect: terraConnect,
    disconnect: terraDisconnect,
    connected: terraConnected,
    wallet: terraWallet,
  } = useTerraWallet();
  //  const terraAddrStr = (terraWallet && terraWallet.walletAddress) || "";
  const terraAddrStr =
    (terraWallet &&
      terraWallet.wallets &&
      terraWallet.wallets.length > 0 &&
      terraWallet.wallets[0].terraAddress) ||
    "";
  const [messages, setMessages] = useState<ParsedVaa[]>([]);
  const addMessage = useCallback((message: ParsedVaa) => {
    setMessages((arr) => [message, ...arr]);
  }, []);
  console.log(solanaPublicKey ? solanaPublicKey.toString() : "null");
  return (
    <Box my={2}>
      <Typography variant="h4" component="h1" sx={{ textAlign: "center" }}>
        Send messages via Wormhole
      </Typography>
      <Box sx={{ textAlign: "center", mt: 2, mb: 1 }}>
        {signerAddress ? (
          <Button
            variant="outlined"
            color="inherit"
            onClick={disconnect}
            sx={{ textTransform: "none" }}
          >
            {signerAddress.substr(0, 5)}
            ...
            {signerAddress.substr(signerAddress.length - 3)}
          </Button>
        ) : (
          <Button variant="contained" color="secondary" onClick={connect}>
            Connect Metamask
          </Button>
        )}
        {solanaPublicKey ? (
          <Button
            variant="outlined"
            color="inherit"
            onClick={disconnectSolanaWallet}
            sx={{ textTransform: "none", ml: 1 }}
          >
            {solanaPublicKey.toString().substr(0, 5)}
            ...
            {solanaPublicKey
              .toString()
              .substr(solanaPublicKey.toString().length - 3)}
          </Button>
        ) : solanaWallet ? (
          <Button
            variant="contained"
            color="secondary"
            onClick={connectSolanaWallet}
            sx={{ ml: 1 }}
          >
            Connect {solanaWallet.name}
          </Button>
        ) : (
          solanaWallets.map((wallet) => (
            <Button
              variant="contained"
              color="secondary"
              key={wallet.name}
              onClick={() => {
                solanaSelect(wallet.name);
              }}
              sx={{ ml: 1 }}
            >
              Select {wallet.name}
            </Button>
          ))
        )}
        {terraConnected ? (
          <Button
            variant="outlined"
            color="inherit"
            onClick={terraDisconnect}
            sx={{ ml: 1 }}
          >
            {terraAddrStr.substr(0, 5)}
            ...
            {terraAddrStr.substr(terraAddrStr.toString().length - 3)}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="secondary"
            onClick={terraConnect}
            sx={{ ml: 1 }}
          >
            Connect Terra
          </Button>
        )}
      </Box>
      <Box sx={{ display: "flex" }}>
        <Box sx={{ flexBasis: "66%" }}>
          <TerraChain
            name="Terra"
            chainId={CHAIN_ID_TERRA}
            addMessage={addMessage}
          />
          <SolanaChain
            name="Solana"
            chainId={CHAIN_ID_SOLANA}
            addMessage={addMessage}
          />
          <EVMChain
            name="Ethereum"
            chainId={CHAIN_ID_ETH}
            addMessage={addMessage}
          />
          <EVMChain
            name="BSC "
            chainId={CHAIN_ID_BSC}
            addMessage={addMessage}
          />
        </Box>
        <Box sx={{ flexGrow: 1, p: 2, pl: 0 }}>
          <Card sx={{ width: "100%", height: "100%" }}>
            <CardHeader title="Observed Messages" />
            <CardContent>
              <List>
                {messages.map((message) => {
                  const key = `${chainToName(
                    message.emitter_chain
                  )}-${uint8ArrayToNative(
                    message.emitter_address,
                    message.emitter_chain
                  )}-${message.sequence}`;
                  return (
                    <ListItem key={key} divider>
                      <ListItemText
                        primary={Buffer.from(message.payload).toString()}
                        secondary={key}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

export default App;

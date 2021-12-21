import {
  ChainId,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  createNonce,
  getEmitterAddressEth,
  parseSequenceFromLogEth,
} from "@certusone/wormhole-sdk";
import { uint8ArrayToNative } from "@certusone/wormhole-sdk/lib/esm";
import getSignedVAAWithRetry from "@certusone/wormhole-sdk/lib/esm/rpc/getSignedVAAWithRetry";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/esm/solana/wasm";
import { hexlify, hexStripZeros } from "@ethersproject/bytes";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
  } from "@mui/material";
import React, { useCallback, useState } from "react";
import { address as ETH_CONTRACT_ADDRESS } from "./contract-addresses/development";
import { address as BSC_CONTRACT_ADDRESS } from "./contract-addresses/development2";
import { useEthereumProvider } from "./EthereumProviderContext";
import { Messenger__factory } from "./ethers-contracts";

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
interface SentVaaData {
  vaa: ParsedVaa;
  bytes: Uint8Array;
}

const WORMHOLE_RPC_HOSTS = ["http://localhost:7071"];

const chainToNetwork = (c: ChainId) =>
  hexStripZeros(hexlify(c === 2 ? 1337 : c === 4 ? 1397 : 0));
const chainToContract = (c: ChainId) =>
  c === 2 ? ETH_CONTRACT_ADDRESS : c === 4 ? BSC_CONTRACT_ADDRESS : "";
const chainToName = (c: ChainId) =>
  c === 2
    ? "Ethereum"
    : c === 4
    ? "BSC"
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

function Chain({
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

  const processClickHandler = useCallback(() => {
    console.log('---Process---- idx:' + appMsgIdx);
    const vaaData = getSelectedVaa();
    console.log('vaa seq: '+vaaData.vaa.sequence+' chain: '+vaaData.vaa.emitter_chain+' will be processed on:'+chainId);
    console.log('string was: '+Buffer.from(vaaData.vaa.payload).toString());
    console.log('emmiter: '+vaaData.vaa.emitter_address);

    if (!signer || !provider) return;
    (async () => {
      await provider.send("wallet_switchEthereumChain", [
         { chainId: chainToNetwork(chainId) },
      ]);
      const Messenger = Messenger__factory.connect(
        chainToContract(chainId),
        signer
      );
      const nonce = createNonce();

      try {
        const sendTx = await Messenger.receiveBytes(
          vaaData.bytes,
          nonce
        );
        const sendReceipt = await sendTx.wait();
        console.log(sendReceipt);
        setResultText('Success: ' + Buffer.from(vaaData.vaa.payload).toString());
      } catch (ex) {
        console.log("receiveBytes failed ", ex);
        setResultText('Exception.' + parseError(ex));
      }
    })();
  }, [signer, provider, chainId, appMsgIdx, getSelectedVaa]);   //appMsgIdx, getSelectedVaa]);

  const sendClickHandler = useCallback(() => {
    if (!signer || !provider) return;
    (async () => {
      await provider.send("wallet_switchEthereumChain", [
        { chainId: chainToNetwork(chainId) },
      ]);
      const Messenger = Messenger__factory.connect(
        chainToContract(chainId),
        signer
      );
      const nonce = createNonce();
      const bytesToSend = Buffer.from(messageText);
      const sendTx = await Messenger.sendStr(
        new Uint8Array(bytesToSend),
        nonce
      );
      const sendReceipt = await sendTx.wait();
      const sequence = parseSequenceFromLogEth(
        sendReceipt,
        await Messenger.wormhole()
      );
      const { vaaBytes } = await getSignedVAAWithRetry(
        WORMHOLE_RPC_HOSTS,
        chainId,
        getEmitterAddressEth(chainToContract(chainId)),
        sequence.toString()
      );
      const { parse_vaa } = await importCoreWasm();
      addMessage({vaa:parse_vaa(vaaBytes), bytes:vaaBytes});
    })();
  }, [provider, signer, chainId, messageText, addMessage]);

  return (
    <Card sx={{ m: 2 }}>
      <CardHeader title={name} />
      <CardContent>
        <TextField
          multiline
          fullWidth
          rows="3"
          placeholder="Type a message"
          value={messageText}
          onChange={handleChange}
        />
      </CardContent>
      <CardActions>
        <Button sx={{mr: 2}}
          onClick={sendClickHandler}
          variant="contained"
          disabled={!signerAddress}
        >
          Send
        </Button>
        <Button 
          onClick={processClickHandler}
          variant="contained"
          disabled={appMsgIdx < 0}
        >
          Process
        </Button>
        <br/>
        <TextField
          sx={{ml: 5, mr: 5, color: 'black'}}
          inputProps={{readOnly: true}}
          fullWidth
          id="process-result"
          label="last process result"
          variant="standard"
          value={resultText}
        >
        </TextField>
      </CardActions>
    </Card>
  );
}

function App() {
  const { connect, disconnect, signerAddress } = useEthereumProvider();
  const [messages, setMessages] = useState<SentVaaData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const getSelectedVaa = (() => {
    return messages[selectedIndex];
  });
  const addMessage = useCallback((message: SentVaaData) => {
    setMessages((arr) => [message, ...arr]);
  }, []);
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
            Connect Wallet
          </Button>
        )}
      </Box>
      <Box sx={{ display: "flex" }}>
        <Box sx={{ flexBasis: "66%" }}>
          <Chain
            name="Ethereum"
            chainId={CHAIN_ID_ETH}
            addMessage={addMessage}
            getSelectedVaa={getSelectedVaa}
            appMsgIdx={selectedIndex}
          ></Chain>
          <Chain
            name="BSC"
            chainId={CHAIN_ID_BSC}
            addMessage={addMessage}
            getSelectedVaa={getSelectedVaa}
            appMsgIdx={selectedIndex}
          ></Chain>
        </Box>
        <Box sx={{ flexGrow: 1, p: 2, pl: 0 }}>
          <Card sx={{ width: "100%", height: "100%" }}>
            <CardHeader title="Observed Messages" />
            <CardContent>
              <List dense={true} sx={{maxHeight: 400, overflow: 'auto',}}>
                {messages.map((message, index) => {
                  const key = `${chainToName(message.vaa.emitter_chain)}-${uint8ArrayToNative(
                    message.vaa.emitter_address,
                    message.vaa.emitter_chain
                  )}-${message.vaa.sequence}`;
                  return (
                    <ListItem key={key} divider>
                      <ListItemButton
                        selected={selectedIndex === index}
                        onClick={()=>{setSelectedIndex(index);}}
                      >
                        <ListItemText
                          primary={Buffer.from(message.vaa.payload).toString()}
                          secondary={key}
                        />
                        </ListItemButton>
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

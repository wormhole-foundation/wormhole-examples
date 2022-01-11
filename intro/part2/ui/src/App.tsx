import React, { useCallback, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";

// Wormhole
import {
  ChainId,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
} from "@certusone/wormhole-sdk";
import { uint8ArrayToNative } from "@certusone/wormhole-sdk/lib/esm";

// Ethereum
import { hexlify, hexStripZeros } from "@ethersproject/bytes";
import { Web3Provider } from "@ethersproject/providers";
import { useEthereumProvider } from "./contexts/EthereumProviderContext";

// Terra
import { useTerraWallet } from "./contexts/TerraWalletContext";

// Solana
import { useSolanaWallet } from "./contexts/SolanaWalletContext";

// Deployed contract addresses.
import { address as ETH_CONTRACT_ADDRESS } from "./contract-addresses/development";
import { address as BSC_CONTRACT_ADDRESS } from "./contract-addresses/development2";
import { address as TERRA_CONTRACT_ADDRESS } from "./contract-addresses/terra";
import { EVMChain } from "./EVMChain";
import { SolanaChain } from "./SolanaChain";
import { TerraChain } from "./TerraChain";
export const SOLANA_PROGRAM =
  require("./contract-addresses/solana.json").programId;

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
export interface SentVaaData {
  vaa: ParsedVaa;
  bytes: Uint8Array;
}

//const SOLANA_BRIDGE_ADDRESS = "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o";
export const SOLANA_HOST = "http://localhost:8899";
export const WORMHOLE_RPC_HOSTS = ["http://localhost:7071"];

const chainToNetworkDec = (c: ChainId) => (c === 2 ? 1337 : c === 4 ? 1397 : 0);

const chainToNetwork = (c: ChainId) =>
  hexStripZeros(hexlify(chainToNetworkDec(c)));

export const chainToContract = (c: ChainId) =>
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
export const parseError = (e: any) =>
  e?.data?.message?.startsWith(MM_ERR_WITH_INFO_START)
    ? e.data.message.replace(MM_ERR_WITH_INFO_START, "")
    : e?.response?.data?.error // terra error
    ? e.response.data.error
    : e?.message
    ? e.message
    : "An unknown error occurred";

export const switchProviderNetwork = async (
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

  const [messages, setMessages] = useState<SentVaaData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const getSelectedVaa = () => {
    return messages[selectedIndex];
  };
  const addMessage = useCallback((message: SentVaaData) => {
    // setMessages((arr) => arr.concat(message)); // Recent at the bottom
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
            getSelectedVaa={getSelectedVaa}
            appMsgIdx={selectedIndex}
          />
          <SolanaChain
            name="Solana"
            chainId={CHAIN_ID_SOLANA}
            addMessage={addMessage}
            getSelectedVaa={getSelectedVaa}
            appMsgIdx={selectedIndex}
          />
          <EVMChain
            name="Ethereum"
            chainId={CHAIN_ID_ETH}
            addMessage={addMessage}
            getSelectedVaa={getSelectedVaa}
            appMsgIdx={selectedIndex}
          ></EVMChain>
          <EVMChain
            name="BSC"
            chainId={CHAIN_ID_BSC}
            addMessage={addMessage}
            getSelectedVaa={getSelectedVaa}
            appMsgIdx={selectedIndex}
          ></EVMChain>
        </Box>
        <Box sx={{ flexGrow: 1, p: 2, pl: 0 }}>
          <Card sx={{ width: "100%", height: "100%" }}>
            <CardHeader title="Observed Messages" />
            <CardContent>
              <List dense={true} sx={{ maxHeight: 400, overflow: "auto" }}>
                {messages.map((message, index) => {
                  const key = `${chainToName(
                    message.vaa.emitter_chain
                  )}-${uint8ArrayToNative(
                    message.vaa.emitter_address,
                    message.vaa.emitter_chain
                  )}-${message.vaa.sequence}`;
                  return (
                    <ListItem key={key} divider>
                      <ListItemButton
                        selected={selectedIndex === index}
                        onClick={() => {
                          setSelectedIndex(index);
                        }}
                      >
                        <ListItemText
                          sx={{ wordBreak: "break-all" }}
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

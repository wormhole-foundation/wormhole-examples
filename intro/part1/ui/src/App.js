import {
  createNonce,
  getEmitterAddressEth,
  parseSequenceFromLogEth,
} from "@certusone/wormhole-sdk";
import getSignedVAAWithRetry from "@certusone/wormhole-sdk/lib/esm/rpc/getSignedVAAWithRetry";
import { hexlify, hexStripZeros } from "@ethersproject/bytes";
import React, { useCallback, useState } from "react";
import "./App.css";
import ETH_CONTRACT_ADDRESS from "./contract-addresses/development";
import BSC_CONTRACT_ADDRESS from "./contract-addresses/development2";
import { useEthereumProvider } from "./EthereumProviderContext";
import { Messenger__factory } from "./ethers-contracts";
import "./index.css";

const WORMHOLE_RPC_HOSTS = ["http://localhost:7071"];
const ETH_RPC = "http://localhost:8545";
const BSC_RPC = "http://localhost:8546";

const chainToNetwork = (c) =>
  hexStripZeros(hexlify(c === 2 ? 1337 : c === 4 ? 1397 : 0));
const networkToChain = (n) => (n === 1337 ? 2 : n === 1397 ? 4 : 0);
const chainToContract = (c) =>
  c === 2 ? ETH_CONTRACT_ADDRESS : c === 4 ? BSC_CONTRACT_ADDRESS : "";

function EthChain({ c, sendCB, fetchCb }) {
  //  const { connect, disconnect, signerAddress } = useEthereumProvider();
  const chainId = 2;
  const clr = "#202020";
  const staId = "sta" + c;
  const rtaId = "rta" + c;
  const { connect, provider, signer, signerAddress } = useEthereumProvider();
  //  const { connect, disconnect, signerAddress } = useEthereumProvider();

  console.log("Chain render " + c);

  const sendClickHandler = useCallback(() => {
    connect();
    const SentText = document.getElementById(staId).value;
    sendCB(SentText); // Update top text
    if (!signer) {
      console.log("No signer");
      return;
    }
    (async () => {
      await provider.send("wallet_switchEthereumChain", [
        { chainId: chainToNetwork(chainId) },
      ]);
      const toChain = chainId === 2 ? 4 : 2;
      const sendMsg = Messenger__factory.connect(
        chainToContract(chainId),
        signer
      );
      const nonce = createNonce();
      console.log("sskk nonce: " + nonce.inspect());

      const sendTx = await sendMsg.sendStr(
        new Uint8Array(Buffer.from(SentText)),
        nonce
      );

      const sendReceipt = await sendTx.wait();
      console.log(sendReceipt);

      const sequence = parseSequenceFromLogEth(
        sendReceipt,
        await sendMsg.wormhole()
        //        '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550'  //TBD!
      );
      const { vaaBytes } = await getSignedVAAWithRetry(
        WORMHOLE_RPC_HOSTS,
        chainId,
        getEmitterAddressEth(chainToContract(chainId)),
        sequence.toString()
      );
      console.log(vaaBytes);
    })();
  }, [connect, provider, sendCB, signer, staId]);
  const receiveClickHandler = () => {
    document.getElementById(rtaId).value = fetchCb();
  };

  return (
    <li
      style={{
        backgroundColor: clr,
        marginTop: 10,
        padding: 0,
        borderRadius: 10,
      }}
    >
      <p style={{ marginTop: 0, textAlign: "left" }}> {c}</p>
      <button className="chain-row-button" onClick={sendClickHandler}>
        Send
      </button>
      <textarea
        id={staId}
        className="chain-row-text-area"
        placeholder="message to send"
        defaultValue="eth test"
      />
      <button className="chain-row-button" onClick={receiveClickHandler}>
        Receive
      </button>
      <textarea id={rtaId} className="chain-row-text-area" readOnly />
    </li>
  );
}

function Chain({ c, sendCB, fetchCb }) {
  const [sendText, setSendText] = useState();
  const clr = "#202020";
  const staId = "sta" + c;
  const rtaId = "rta" + c;

  console.log("Chain render " + c);
  const sendClickHandler = () => {
    sendCB(document.getElementById(staId).value);
  };
  const receiveClickHandler = () => {
    document.getElementById(rtaId).value = fetchCb();
  };

  return (
    <li
      style={{
        backgroundColor: clr,
        marginTop: 10,
        padding: 0,
        borderRadius: 10,
      }}
    >
      <p style={{ marginTop: 0, textAlign: "left" }}> {c}</p>
      <button className="chain-row-button" onClick={sendClickHandler}>
        Send
      </button>
      <textarea
        id={staId}
        className="chain-row-text-area"
        placeholder="message to send"
        defaultValue={sendText}
      />
      <button className="chain-row-button" onClick={receiveClickHandler}>
        Receive
      </button>
      <textarea id={rtaId} className="chain-row-text-area" readOnly />
    </li>
  );
}

function App() {
  const [lastSent, setLastSent] = useState(null);
  const [lastSentSource, setLastSentSource] = useState(null);

  //  const lastSentCbEther = useCallback((txt) => {setLastSent(txt); setLastSentSource("Ether")}, []);
  const lastSentCbEther = (txt) => {
    setLastSent(txt);
    setLastSentSource("Ether");
  };
  const lastSentCbSolana = (txt) => {
    setLastSent(txt);
    setLastSentSource("Solana");
  };
  const lastSentCbTerra = (txt) => {
    setLastSent(txt);
    setLastSentSource("Terra");
  };

  const lastFetchCbEther = () => {
    return lastSent;
  };
  const lastFetchCbSolana = () => {
    return lastSent;
  };
  const lastFetchCbTerra = () => {
    return lastSent;
  };

  return (
    <div className="App">
      <header className="App-header">
        <p style={{ fontSize: "calc(10px + 2vmin)" }}>
          Post messages via Wormhole
        </p>
        <div>
          Last message sent: <br />
          <pre>
            <mark>{lastSent}</mark>
          </pre>
          from {lastSentSource}
        </div>
        <ul
          style={{ listStyleType: "none", margin: 0, padding: 0, width: "90%" }}
        >
          <EthChain
            c="Ethereum"
            sendCB={lastSentCbEther}
            fetchCb={lastFetchCbEther}
          ></EthChain>
          {/* <Chain c='Solana' sendCB={lastSentCbSolana} fetchCb={lastFetchCbSolana}></Chain>
          <Chain c='Terra' sendCB={lastSentCbTerra} fetchCb={lastFetchCbTerra}></Chain> */}
        </ul>
      </header>
    </div>
  );
}

export default App;

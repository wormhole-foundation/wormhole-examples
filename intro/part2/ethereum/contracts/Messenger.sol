// contracts/Messenger.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./interfaces/IWormhole.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Messenger is Ownable {
    // Hardcode the Wormhole Core Bridge contract address
    // In a real contract, we would set this in a constructor or Setup
    address a = address(0xC89Ce4735882C9F0f0FE26686c53074E09B0D550);
    IWormhole _wormhole = IWormhole(a);

    mapping(bytes32 => bool) _completedMessages;
    mapping(uint16 => bytes32) _bridgeContracts;

    // sendStr sends bytes to the wormhole.
    function sendStr(bytes memory str, uint32 nonce) public returns (uint64 sequence) {
        sequence = _wormhole.publishMessage(nonce, str, 1);
        return sequence;
    }

    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        bytes memory bytesArray = new bytes(64);
        for (i = 0; i < bytesArray.length; i++) {
            bytesArray[i] = toByte((_bytes32[i/2] >> 4) & 0x0f);
            i = i + 1;
            bytesArray[i] = toByte(_bytes32[i/2] & 0x0f);
        }
        return string(bytesArray);
    }

    function toByte(bytes1 _b1) public pure returns (bytes1) {
        uint8 _b  = uint8(_b1);
        return (_b < 10)? bytes1(_b + 48): bytes1(_b + 87);
    }

    // receiveStr confirms VAA and processes message on the receiving chain.
    // Returns true when bytes are seen first time.
    function receiveBytes(bytes memory encodedVm, uint32 /*nonce*/) public {
        (IWormhole.VM memory vm, bool valid, string memory reason) = _wormhole.parseAndVerifyVM(encodedVm);
        // 1. check wormhole signatures/
        require(valid, reason);

        // 2. Check if emtter chain contract is registered.
        // Print incoming emitter address.
        // string memory smsg = string(abi.encodePacked(" invalid em ", Strings.toString(vm.emitterChainId), "-", bytes32ToString(vm.emitterAddress)));
        // Print map entry address.
        string memory smsg = string(abi.encodePacked(" invalid_emitter ", Strings.toString(vm.emitterChainId), "+", bytes32ToString(_bridgeContracts[vm.emitterChainId])));
        
        require(verifyBridgeVM(vm), smsg);

        // 3. Drop duplicate VAA.
        require(!_completedMessages[vm.hash], " message already received");
        _completedMessages[vm.hash] = true;

        // Action place..
        // At this point payload is good to be used for what actual contract needs to do. Like transfer(s) etc
    }

    // Check if receiveBytes emmiter is actually registered chan.
    function verifyBridgeVM(IWormhole.VM memory vm) internal view returns (bool){
        return (_bridgeContracts[vm.emitterChainId] == vm.emitterAddress);
    }
    // We register chain,bridge in [mpn run register] command.
    function registerChain(uint16 chainId_, bytes32 bridgeContract_) public onlyOwner {
        _bridgeContracts[chainId_] = bridgeContract_;
    }

    function wormhole() public view returns (IWormhole) {
        return _wormhole;
    }
}


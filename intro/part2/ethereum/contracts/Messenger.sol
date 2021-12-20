// contracts/Messenger.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./interfaces/IWormhole.sol";

contract Messenger {
    // Hardcode the Wormhole Core Bridge contract address
    // In a real contract, we would set this in a constructor or Setup
    address a = address(0xC89Ce4735882C9F0f0FE26686c53074E09B0D550);
    IWormhole _wormhole = IWormhole(a);

    mapping(bytes32 => bool) _completedMessages;


    // sendStr sends bytes to the wormhole.
    function sendStr(bytes memory str, uint32 nonce) public returns (uint64 sequence) {
        sequence = _wormhole.publishMessage(nonce, str, 1);
        return sequence;
    }

    // receiveStr confirms VAA and processes message on the receiving chain.
    // Returns true when bytes are seen first time.
    function receiveBytes(bytes memory encodedVm, uint32 /*nonce*/) public returns (bool result) {
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(encodedVm);

//        if(!valid) return false;
        require(valid, reason);
//        require(verifyBridgeVM(vm), "invalid emitter");

//        if(_completedMessages[vm.hash]) return false;
        require(!_completedMessages[vm.hash], "message already received");
        _completedMessages[vm.hash] = true;

        return true;
    }

    function wormhole() public view returns (IWormhole) {
        return _wormhole;
    }
}


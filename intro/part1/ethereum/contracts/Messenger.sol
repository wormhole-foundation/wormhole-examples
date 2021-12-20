// contracts/Messenger.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./interfaces/IWormhole.sol";

contract Messenger {
    // Hardcode the Wormhole Core Bridge contract address
    // In a real contract, we would set this in a constructor or Setup
    address a = address(0xC89Ce4735882C9F0f0FE26686c53074E09B0D550);
    IWormhole _wormhole = IWormhole(a);

    function sendStr(bytes memory str, uint32 nonce) public returns (uint64 sequence) {
        sequence = _wormhole.publishMessage(nonce, str, 1);
        return sequence;
    }
    function wormhole() public view returns (IWormhole) {
        return _wormhole;
    }
}


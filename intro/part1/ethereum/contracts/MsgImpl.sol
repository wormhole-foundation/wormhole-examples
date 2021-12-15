// contracts/MsgImpl.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

// import "./NFTGetters.sol";
// import "./NFTSetters.sol";
// import "./NFTStructs.sol";
// import "./libraries/external/BytesLib.sol";

import "./interfaces/IWormhole.sol";
//import "./MsgState.sol";

// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/utils/Context.sol";
// import "@openzeppelin/contracts/utils/Address.sol";
// import "@openzeppelin/contracts/utils/Strings.sol";

contract MsgImpl {
    address a = address(0xC89Ce4735882C9F0f0FE26686c53074E09B0D550);
    IWormhole _wormhole = IWormhole(a);
    // IWormhole wormhole = new IWormhole("0xC89Ce4735882C9F0f0FE26686c53074E09B0D550");

    function sendStr(bytes memory str, uint32 nonce) public returns (uint64 sequence) {
        // bytes memory encoded = abi.encode(str);
        sequence = _wormhole.publishMessage(nonce, str, 1);
        return sequence;
    }
    function wormhole() public view returns (IWormhole) {
        return _wormhole;
    }
}


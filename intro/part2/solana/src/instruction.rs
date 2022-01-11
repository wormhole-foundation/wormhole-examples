use borsh::BorshSerialize;
use solana_program::instruction::{
    AccountMeta,
    Instruction,
};
use solana_program::pubkey::Pubkey;
use solana_program::system_program;
use solana_program::sysvar::{
    clock,
    rent,
};
//use solana_program::pubkey::Pubkey::find_program_address;
use wormhole_sdk::{VAA};

use wormhole_sdk::{
    id,
    config,
    fee_collector,
    sequence,
};

use sha3::Digest;
use byteorder::{
    BigEndian,
    WriteBytesExt,
};
use std::io::{
    Cursor,
    Write,
};
//use std::slice;

use crate::Instruction::{
    SendMessage,
    ConfirmMessage,
    RegisterChain,
};

use web_sys::console;

/// Create a RegisterChain instruction.
pub fn register_chain(
    program_id: Pubkey,
    payer: Pubkey,
    chain_id: u16,
    emitter: String,    // This is expected to be 32 byte as 64 char hex string.
) -> Instruction {
    // Derive chainId -> emitter PDA.
    let chain_id_bytes = chain_id.to_le_bytes();
    let (emitter_address, _) = Pubkey::find_program_address(&[b"EmitterAddress", &chain_id_bytes], &program_id);
    // ChainId,emitter go into data Payload.
    let mut payload: Vec<u8> = chain_id_bytes.to_vec();
    payload.extend(hex::decode(emitter).unwrap());
    console::log_1(&format!("--- register_chain size: {}", payload.len()).into());
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer, true),
            AccountMeta::new(emitter_address, false),
            AccountMeta::new_readonly(system_program::id(), false),
            AccountMeta::new_readonly(rent::id(), false),
            AccountMeta::new_readonly(clock::id(), false),
        ],
        data: RegisterChain(payload).try_to_vec().unwrap(),
    }
}

/// Create a SendMessage instruction.
pub fn send_message(
    program_id: Pubkey,
    payer: Pubkey,
    emitter: Pubkey,
    message: Pubkey,
    payload: Vec<u8>,
) -> Instruction {
    let wormhole = id();
    let config = config(&wormhole);
    let fee_collector = fee_collector(&wormhole);
    let sequence = sequence(&wormhole, &emitter);

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(emitter, false),
            AccountMeta::new(message, true),
            AccountMeta::new(config, false),
            AccountMeta::new(fee_collector, false),
            AccountMeta::new(sequence, false),
            AccountMeta::new_readonly(wormhole, false),
            AccountMeta::new_readonly(system_program::id(), false),
            AccountMeta::new_readonly(rent::id(), false),
            AccountMeta::new_readonly(clock::id(), false),
        ],
        data: SendMessage(payload).try_to_vec().unwrap(),
    }
}

// Convert a full VAA structure into the serialization of its unique components, this structure is
// what is hashed and verified by Guardians.
fn serialize_vaa(vaa: &VAA) -> Vec<u8> {
    let mut v = Cursor::new(Vec::new());
    v.write_u32::<BigEndian>(vaa.timestamp).unwrap();
    v.write_u32::<BigEndian>(vaa.nonce).unwrap();
    v.write_u16::<BigEndian>(vaa.emitter_chain.clone() as u16).unwrap();
    v.write(&vaa.emitter_address).unwrap();
    v.write_u64::<BigEndian>(vaa.sequence).unwrap();
    v.write_u8(vaa.consistency_level).unwrap();
    v.write(&vaa.payload).unwrap();
    v.into_inner()
}

/// Create a ConfirmMessage instruction.
/// Payload is signedVAA.
pub fn confirm_message(
    program_id: Pubkey,
    payer: Pubkey,
    claim: Pubkey,
    payload: Vec<u8>,
) -> Instruction {
    let wormhole = wormhole_sdk::id();
    let config = config(&wormhole);
    let fee_collector = fee_collector(&wormhole);

    // Hash a VAA extract (serialize_vaa function does it), to derive VAA key.
    let vaa = VAA::from_bytes(payload.as_slice()).unwrap();
    let bbf: Vec<u8> =serialize_vaa(&vaa);
    console::log_1(&format!("--- Size1: {}", bbf.len()).into());
    let mut h = sha3::Keccak256::default();
    h.write(bbf.as_slice()).unwrap();
    let vaa_hash: [u8; 32] = h.finalize().into();
    let (vaa_key, _bump) = solana_program::pubkey::Pubkey::find_program_address(&["PostedVAA".as_bytes(), &vaa_hash], &wormhole);
    console::log_1(&format!("-++> signedVAA: {}", vaa_key).into());

    // Derive chainId -> emitter PDA.
    let chain_id_bytes = (vaa.emitter_chain.clone() as u16).to_le_bytes();
    let (emitter_address, _) = Pubkey::find_program_address(&[b"EmitterAddress", &chain_id_bytes], &program_id);

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer, true),
            AccountMeta::new(config, false),
            AccountMeta::new(claim, false),
            AccountMeta::new_readonly(emitter_address, false),
            AccountMeta::new(fee_collector, false),
            AccountMeta::new_readonly(vaa_key, false),
            AccountMeta::new_readonly(wormhole, false),
            AccountMeta::new_readonly(system_program::id(), false),
            AccountMeta::new_readonly(rent::id(), false),
            AccountMeta::new_readonly(clock::id(), false),
        ],
        data: ConfirmMessage.try_to_vec().unwrap(),
    }
}

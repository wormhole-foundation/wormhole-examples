#![deny(unused_must_use)]

// A common serialization library used in the blockchain space, which we'll use to serialize our
// cross chain message payloads.
use borsh::{
    BorshDeserialize,
    BorshSerialize,
};

// Solana SDK imports to interact with the solana runtime.
use solana_program::account_info::{
    next_account_info,
    AccountInfo,
};
use solana_program::entrypoint::ProgramResult;
use solana_program::program::invoke_signed;
use solana_program::pubkey::Pubkey;
use solana_program::{
    entrypoint,
};

// Import Solana Wormhole SDK.
use wormhole_sdk::{
    instructions::post_message,
    ConsistencyLevel,
};

#[cfg(feature = "wasm")]
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
extern crate wasm_bindgen;

#[cfg(feature = "wasm")]
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub mod wasm;

pub mod instruction;

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub enum Instruction {
    /// This instruction is used to send a message to another chain by emitting it as a wormhole message
    /// 0: Payer         [Signer]
    /// 1: Emitter       [Signer]
    /// 2: Message       [PDA]
    /// 3: Worm Config   [Worm PDA]
    /// 4: Worm Fee      [Worm PDA]
    /// 5: Worm Sequence [Worm PDA]
    /// 6: Wormhole      [Program]   -- Needed for invoke_signed.
    /// 7: System        [Program]   -- Needed for wormhole to take fees.
    /// 8: Rent          [Program]   -- Needed for fee calculation on the message account.
    /// 9: Clock         [Program]   -- Needed for message generation
    SendMessage(Vec<u8>),
}


entrypoint!(process_instruction);

/// The Solana entrypoint, here we deserialize our Borsh encoded Instruction and dispatch to our
/// program handlers.
pub fn process_instruction(id: &Pubkey, accs: &[AccountInfo], data: &[u8]) -> ProgramResult {
    match BorshDeserialize::try_from_slice(data).unwrap() {
        Instruction::SendMessage(msg) => send_message(id, accs, msg),
    }?;
    Ok(())
}


/// Sends a message from this chain to a remote target chain.
fn send_message(id: &Pubkey, accs: &[AccountInfo], payload: Vec<u8>) -> ProgramResult {
    let accounts = &mut accs.iter();
    let payer = next_account_info(accounts)?;
    let _emitter = next_account_info(accounts)?;
    let message = next_account_info(accounts)?;
    let _config = next_account_info(accounts)?;
    let _fee_collector = next_account_info(accounts)?;

    // Read remaining unreferenced accounts.
    let _sequence = next_account_info(accounts)?;
    let _wormhole = next_account_info(accounts)?;
    let _system = next_account_info(accounts)?;
    let _rent = next_account_info(accounts)?;
    let _clock = next_account_info(accounts)?;

    // Emit Message via the Wormhole.
    let (emitter, mut seeds, bump) = wormhole_sdk::emitter(id);
    let bump = &[bump];
    seeds.push(bump);

    invoke_signed(
        &post_message(
            wormhole_sdk::id(),
            *payer.key,
            emitter,
            *message.key,
            0,
            payload,
            ConsistencyLevel::Confirmed,
        )
        .unwrap(),
        accs,
        &[&seeds],
    )?;

    Ok(())
}
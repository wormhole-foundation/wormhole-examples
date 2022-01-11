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
//use solana_program::program::invoke_signed;       // For non-SDK calls
use solana_program::pubkey::Pubkey;
use solana_program::{
    entrypoint,
};

// Import Solana Wormhole SDK.
use wormhole_sdk::{
//    instructions::post_message,   // For non-SDK calls
//    read_config,                  // For non-SDK calls
//    fee_collector,                // For non-SDK calls
    post_message,           // SDK call.
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


/// Sends a message from this chain to wormhole.
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

    // Use SDK: 
    // Extract seeds for emitter account only if needed to pass to post_message
    // let (emitter, mut seeds, bump) = wormhole_sdk::emitter(id);
    // let bump = &[bump];
    // seeds.push(bump);

    post_message(
        *id,
        *payer.key,
        *message.key,
        payload,
        ConsistencyLevel::Confirmed,
        None,       //Some(&seeds),  // If needed.
        accs,
        0
    )?;

    /*
    // Emit Message via the Wormhole.
   let (emitter, mut seeds, bump) = wormhole_sdk::emitter(id);
   let bump = &[bump];
   seeds.push(bump);


   // Test from SDK.
    // Filter for the Config AccountInfo so we can access its data.
    let config = wormhole_sdk::config(&wormhole_sdk::id());
    let config = accs.iter().find(|item| *item.key == config).unwrap();
    let config = read_config(config).unwrap();

    let fee_collector = fee_collector(&wormhole_sdk::id());
    invoke_signed(
      &solana_program::system_instruction::transfer(
        payer.key,
        &fee_collector,
        config.fee
      ),
      accs,
      &[&seeds],
    )?;

    //zz Use instructions: 
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
*/
    Ok(())
}
#![deny(unused_must_use)]

// A common serialization library used in the blockchain space, which we'll use to serialize our
// cross chain message payloads.
use borsh::{
    BorshDeserialize,
    BorshSerialize,
};

// Solana SDK imports to interact with the solana runtime.
use solana_program::msg;
use solana_program::account_info::{
    next_account_info,
    AccountInfo,
};
use solana_program::entrypoint::ProgramResult;
use solana_program::program::invoke_signed;
//use solana_program::pubkey::Pubkey::{find_program_address };
use solana_program::pubkey::Pubkey;
use solana_program::rent::Rent;
use solana_program::{
    entrypoint,
    system_instruction,
};

// Import Solana Wormhole SDK.
use wormhole_sdk::{
    read_vaa,
    ConsistencyLevel,
    post_message,    // SDK call.
    id as bridge_id,              // Get Bridge Id
};


#[cfg(feature = "wasm")]
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
extern crate wasm_bindgen;

#[cfg(feature = "wasm")]
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub mod wasm;

pub mod instruction;

// Define contract errors.
use thiserror::Error;
use solana_program::program_error::ProgramError;
#[derive(Error, Debug, Copy, Clone)]
pub enum MessengerError {
    /// Invalid SignedVAA owner.
    #[error("Invalid SignedVAA owner")]
    InvalidSignedVAAOwner,
    /// Unknown VAA emitter chain.
    #[error("Unknown VAA emitter chain")]
    UnknownVAAEmitterChain,
    /// Invalid VAA Emitter.
    #[error("Invalid VAA Emitter")]
    InvalidVAAEmitter,
}
impl From<MessengerError> for ProgramError {
    fn from(e: MessengerError) -> Self {
        ProgramError::Custom(e as u32)
    }
}


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

    /// ConfirmMessage instruction is used to check validity of signed VAA, check that it was not processed yet and Process it.
    /// ConfirmMessage instruction checks that VAAs were emitted from known address.
    /// 0: Payer         [Signer]
    /// 2: Worm Config   [Worm PDA]
    /// 3: Claim         [this program PDA]
    /// 4: Chain         [this program PDA] Derived from chainId, 32bytes data.
    /// 5: Worm Fee      [Worm PDA]
    /// 6: Message       [Worm PDA] ???
    /// 7: Wormhole      [Program]   -- Needed for invoke_signed.
    /// 8: System        [Program]   -- Needed for wormhole to take fees.
    /// 9: Rent          [Program]   -- Needed for fee calculation on the message account.
    /// 10: Clock         [Program]   -- Needed for message generation
    ConfirmMessage,

    /// RegisterChain instruction is used to create or update emitter address for chainId data. 
    /// 0: Payer         [Signer]
    /// 1: Chain         [this program PDA] Derived from chainId, 32bytes data.
    /// 2: System        [Program]   -- Needed for wormhole to take fees.
    /// 3: Rent          [Program]   -- Needed for fee calculation on the message account.
    /// 4: Clock         [Program]   -- Needed for message generation
    RegisterChain(Vec<u8>),
}


entrypoint!(process_instruction);

/// The Solana entrypoint, here we deserialize our Borsh encoded Instruction and dispatch to our
/// program handlers.
pub fn process_instruction(id: &Pubkey, accs: &[AccountInfo], data: &[u8]) -> ProgramResult {
    match BorshDeserialize::try_from_slice(data).unwrap() {
        Instruction::SendMessage(msg) => send_message(id, accs, msg),
        Instruction::ConfirmMessage => confirm_message(id, accs),
        Instruction::RegisterChain(msg) => register_chain(id, accs, msg),
    }?;
    Ok(())
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
struct ChainEmitter {
    chain_id: u16,
    emitter_addr: [u8;32],
}

/// Regiter chai emitter address
fn register_chain(id: &Pubkey, accs: &[AccountInfo], payload: Vec<u8>) -> ProgramResult {
    let accounts = &mut accs.iter();
    let payer = next_account_info(accounts)?;
    let chain =  next_account_info(accounts)?;
    let system = next_account_info(accounts)?;

    let chain_info: ChainEmitter = ChainEmitter::try_from_slice(&payload).unwrap();
    msg!("bblp 0. chain: {}", chain.key);
    msg!("bblp 1. register_chain, data len: {} id: {} addr: {:?}", payload.len(), chain_info.chain_id, chain_info.emitter_addr);

    if **chain.lamports.borrow() != 0  {
        msg!("bblp Chain PDA already exist");
    }
    else
    {
        // Create the data account for new chain.
        let emitter_chain = &*chain_info.chain_id.to_le_bytes().to_vec();
        let mut chain_seeds:  Vec<&[u8]> = vec![b"EmitterAddress", emitter_chain ];
        let (chain_key, chain_bump) = Pubkey::find_program_address(&chain_seeds, &id);
    
        let cb = &[chain_bump];
        chain_seeds.push(cb);
    
        let chain_emitter_size = 32;             // put size if there is state stored in claim.
        msg!("bblp Create Chain PDA key: {}", chain_key);
        // Create Clain will fail if it is alredy there.
        let chain_ix = system_instruction::create_account(
            payer.key,
            &chain_key,
            Rent::default().minimum_balance(chain_emitter_size),
            chain_emitter_size as u64,
            id
        );
        invoke_signed(&chain_ix,
        &[
            payer.clone(),
            chain.clone(),
            system.clone(),
        ],
        &[&chain_seeds])?;
    }
    
    if chain.is_writable {
        // data: Rc<RefCell<&'a mut [u8]>>,
        msg!("bblp data[31] was: {}", chain.data.borrow()[31]);
        chain.data.borrow_mut().copy_from_slice(&chain_info.emitter_addr[..]);
        msg!("bblp data[31] became: {}", chain.data.borrow()[31]);
    } else {
        msg!("bblp Chain PDA is not wriable!");
    }

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

    msg!("bblp Processing send_message");
    
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

    Ok(())
}

/// Checks wormhole message to be correct and signed.
/// payload is signed VAA bytes. It is not used here because it needs to be re - checked.
/// Instead we can use payload from signed_vaa. It is what was signed by Core Bridge and can not be spoofed.
fn confirm_message(id: &Pubkey, accs: &[AccountInfo]) -> ProgramResult {
    // Read remaining unreferenced accounts.
    let accounts = &mut accs.iter();
    let payer = next_account_info(accounts)?;
    let _config = next_account_info(accounts)?;
    let claim =  next_account_info(accounts)?;
    let chain =  next_account_info(accounts)?;
    let _fee_collector = next_account_info(accounts)?;
    let signed_vaa = next_account_info(accounts)?;
    let _wormhole = next_account_info(accounts)?;
    let system = next_account_info(accounts)?;
    let _rent = next_account_info(accounts)?;
    let _clock = next_account_info(accounts)?;

    // Need to check that SignedVAA is owned by Core Bridge.
    if *signed_vaa.owner != bridge_id() {
        return Err(MessengerError::InvalidSignedVAAOwner.into());
    }
    // Deserialize vaa_data data into PostedVAAData.
    let vaa: wormhole_sdk::PostedVAAData = read_vaa(signed_vaa).unwrap();

    msg!("bblp vaa.sequence: {}", vaa.sequence);
    msg!("bblp signed_vaa key: {}", signed_vaa.key);
    msg!("bblp emitter address: {:02X?}", vaa.emitter_address);

    // Check if chain is registered and register emitter is same as VAA emitter,
    if **chain.lamports.borrow() == 0  {
        return Err(MessengerError::UnknownVAAEmitterChain.into());
    }
    if chain.data.borrow()[..] != vaa.emitter_address[..] {
        // data: Rc<RefCell<&'a mut [u8]>>,
        msg!("bblp registered emitter address: {:02X?}", chain.data.borrow());
        return Err(MessengerError::InvalidVAAEmitter.into());
    }

    // Need to create Claim PDA. Owned by this program.
    // This needs to include at least emitter_address, emitter_chain, sequence.
    let claim_size = 0;             // put size if there is state stored in claim.
    let emitter_address = &*vaa.emitter_address.to_vec();
    let emitter_chain = &*(vaa.emitter_chain as u16).to_be_bytes().to_vec();
    let sequence = &*vaa.sequence.to_be_bytes().to_vec();
    let mut claim_seeds:  Vec<&[u8]> = vec![
        emitter_address,
        emitter_chain,
        sequence,
    ];
    let (claim_key, claim_bump) = Pubkey::find_program_address(&claim_seeds, &id);
    let cb = &[claim_bump];
    claim_seeds.push(cb);

    msg!("bblp Claim pda key: {}", claim_key);
    // Create Clain will fail if it is alredy there.
    let claim_ix = system_instruction::create_account(
        payer.key,
        &claim_key,
        Rent::default().minimum_balance(claim_size),
        claim_size as u64,
        id
    );
    invoke_signed(&claim_ix,
    &[
        payer.clone(),
        claim.clone(),
        system.clone(),
    ],
    &[&claim_seeds])?;

    // Print the message.
    msg!("bblp ProcessMessage: {}", std::str::from_utf8(&vaa.payload).unwrap());

    Ok(())
}
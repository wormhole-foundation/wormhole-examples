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

use wormhole_sdk::{
    id,
    config,
    fee_collector,
    sequence,
};

use crate::Instruction::{
    SendMessage,
};

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

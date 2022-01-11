use solana_program::pubkey::Pubkey;
use std::str::FromStr;

use crate::instruction::{
    send_message,
    confirm_message,
    register_chain,
};

use wasm_bindgen::prelude::*;

/// Create a RegisterChain instruction.
#[wasm_bindgen]
pub fn register_chain_ix(
    program_id: String,
    payer: String,
    chain_id: u16,
    emitter: String,    // This is expected to be 32 byte as 64 char hex string.
) -> JsValue {
    let ix = register_chain(
        Pubkey::from_str(program_id.as_str()).unwrap(),
        Pubkey::from_str(payer.as_str()).unwrap(),
        chain_id,
        emitter,
    );
    return JsValue::from_serde(&ix).unwrap();
}


/// Create a SendMessage instruction.
#[wasm_bindgen]
pub fn send_message_ix(
    program_id: String,
    payer: String,
    emitter: String,
    message: String,
    payload: Vec<u8>,
) -> JsValue {
    let ix = send_message(
        Pubkey::from_str(program_id.as_str()).unwrap(),
        Pubkey::from_str(payer.as_str()).unwrap(),
        Pubkey::from_str(emitter.as_str()).unwrap(),
        Pubkey::from_str(message.as_str()).unwrap(),
        payload,
    );
    return JsValue::from_serde(&ix).unwrap();
}

/// Create a ConfirmMessage instruction.
#[wasm_bindgen]
pub fn confirm_message_ix(
    program_id: String,
    payer: String,
    claim: String,
    payload: Vec<u8>,
) -> JsValue {
    let ix = confirm_message(
        Pubkey::from_str(program_id.as_str()).unwrap(),
        Pubkey::from_str(payer.as_str()).unwrap(),
        Pubkey::from_str(claim.as_str()).unwrap(),
        payload,
    );
    return JsValue::from_serde(&ix).unwrap();
}

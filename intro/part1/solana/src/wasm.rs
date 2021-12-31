use solana_program::pubkey::Pubkey;
use std::str::FromStr;

use crate::instruction::{
    send_message
};

use wasm_bindgen::prelude::*;

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

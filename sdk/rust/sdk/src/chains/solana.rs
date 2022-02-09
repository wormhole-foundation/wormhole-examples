use solana_program::pubkey::Pubkey;
use std::str::FromStr;

// Export Bridge API
pub use bridge::instructions;
pub use bridge::solitaire as bridge_entrypoint;
pub use bridge::types::ConsistencyLevel;

/// Export Core Mainnet Contract Address
#[cfg(feature = "mainnet")]
pub fn id() -> Pubkey {
    Pubkey::from_str("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth").unwrap()
}

/// Export Core Testnet Contract Address
#[cfg(feature = "testnet")]
pub fn id() -> Pubkey {
    Pubkey::from_str("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5").unwrap()
}

/// Export Core Devnet Contract Address
#[cfg(feature = "devnet")]
pub fn id() -> Pubkey {
    Pubkey::from_str("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o").unwrap()
}

/// Derives the Wormhole configuration account address.
pub fn config(id: &Pubkey) -> Pubkey {
    let (config, _) = Pubkey::find_program_address(&[b"Bridge"], &id);
    config
}

/// Derives the Wormhole fee account address, users of the bridge must pay this address before
/// submitting messages to the bridge.
pub fn fee_collector(id: &Pubkey) -> Pubkey {
    let (fee_collector, _) = Pubkey::find_program_address(&[b"fee_collector"], &id);
    fee_collector
}

/// Derives the sequence address for an emitter, which is incremented after each message post.
pub fn sequence(id: &Pubkey, emitter: &Pubkey) -> Pubkey {
    let (sequence, _) = Pubkey::find_program_address(&[b"Sequence", &emitter.to_bytes()], &id);
    sequence
}

/// Derives the emitter address for a Solana contract, the emitter on Solana must be a PDA, this
/// function helps generate that.
pub fn emitter(id: &Pubkey) -> (Pubkey, Vec<&[u8]>, u8) {
    let mut seeds = &["emitter".as_bytes()];
    let (emitter, bump) = Pubkey::find_program_address(seeds, id);
    (emitter, seeds.to_vec(), bump)
}

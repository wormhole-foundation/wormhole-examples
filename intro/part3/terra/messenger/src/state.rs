use schemars::JsonSchema;
use serde::{
    Deserialize,
    Serialize,
};

#[allow(unused_imports)]
use cosmwasm_std::{
    StdResult,
    Storage,
};

#[allow(unused_imports)]
use cosmwasm_storage::{
    bucket,
    bucket_read,
    singleton,
    singleton_read,
    Bucket,
    ReadonlyBucket,
    ReadonlySingleton,
    Singleton,
};

//use wormhole::byte_utils::ByteUtils;

type HumanAddr = String;

pub static CONFIG_KEY: &[u8] = b"config";

// Guardian set information
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ConfigInfo {
    pub wormhole_contract: HumanAddr,
    pub owner_address: Vec<u8>,
    pub emitter_addresses: Vec<Vec<u8>>,      // all valid contracts
}

pub fn config(storage: &mut dyn Storage) -> Singleton<ConfigInfo> {
    singleton(storage, CONFIG_KEY)
}

pub fn config_read(storage: &dyn Storage) -> ReadonlySingleton<ConfigInfo> {
    singleton_read(storage, CONFIG_KEY)
}

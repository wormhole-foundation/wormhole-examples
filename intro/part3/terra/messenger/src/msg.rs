use cosmwasm_std::{
    Binary,
};
use schemars::JsonSchema;
use serde::{
    Deserialize,
    Serialize,
};

type HumanAddr = String;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub wormhole_contract: HumanAddr,
    pub emitter_addr: Binary,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    SendMessage {
        data: Binary,   // String
        nonce: u32,
    },
    ProcessMessage {
        data: Binary,   // VAA bytes
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    MessengerInfo { },
}

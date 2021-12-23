#[allow(unused_imports)]
use cosmwasm_std::{
    entry_point,
    to_binary,
    Binary,
    CosmosMsg,
    Deps,
    DepsMut,
    Env,
    MessageInfo,
    QueryRequest,
    Response,
    StdError,
    StdResult,
    WasmMsg,
    WasmQuery,
};

use crate::{
    msg::{
        ExecuteMsg,
        InstantiateMsg,
        MigrateMsg,
        QueryMsg,
    },
    state::{
        config,
        config_read,
        ConfigInfo,
    },
};
#[allow(unused_imports)]
use wormhole::{
    byte_utils::get_string_from_32,
    error::ContractError,
    msg::QueryMsg as WormholeQueryMsg,
    msg::ExecuteMsg as WormholeExecuteMsg,
    state::{
        vaa_archive_add,
        vaa_archive_check,
        GovernancePacket,
        ParsedVAA,
    },
};

// Chain ID of Terra
const CHAIN_ID: u16 = 3;

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> StdResult<Response> {
    Ok(Response::new())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    // Save general wormhole info
    let state = ConfigInfo {
        wormhole_contract: msg.wormhole_contract,
        owner_address: msg.emitter_addr.as_slice().to_vec(),
        emitter_addresses: Vec::new(),
    };
    config(deps.storage).save(&state)?;
    Ok(Response::default())
}

pub fn send_wormhole_message(deps: DepsMut, _info: &MessageInfo, data: &Binary, nonce: u32) -> StdResult<u32> {
    let cfg = config_read(deps.storage).load()?;
    let seq: u32 = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: cfg.wormhole_contract.clone(),
        msg: to_binary(&WormholeExecuteMsg::PostMessage {
            message: data.clone(),
            nonce,
        })?,
    }))?;
    Ok(seq)
}

pub fn parse_vaa(deps: DepsMut, block_time: u64, data: &Binary) -> StdResult<ParsedVAA> {
    let cfg = config_read(deps.storage).load()?;
    let vaa: ParsedVAA = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: cfg.wormhole_contract.clone(),
        msg: to_binary(&WormholeQueryMsg::VerifyVAA {
            vaa: data.clone(),
            block_time,
        })?,
    }))?;
    Ok(vaa)
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    match msg {
        ExecuteMsg::SendMessage { data, nonce } => send_to_wormhole(deps, env, info, &data, nonce),
        ExecuteMsg::ProcessMessage { data } => process_vaa(deps, env, info, &data),
    }
}

fn send_to_wormhole(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    data: &Binary,  // This is string we pass in
    nonce: u32,
) -> StdResult<Response> {
    let resp = send_wormhole_message(deps, &info, data, nonce)?;
    // Send new message sequnce to caller.
    Ok(Response::new().add_attribute("seqence", resp.to_string()))
}

fn process_vaa(
    mut deps: DepsMut,
    env: Env,
    _info: MessageInfo,
    data: &Binary,
) -> StdResult<Response> {
    // Check and Parse VAA.
    let vaa = parse_vaa(deps.branch(), env.block.time.seconds(), data)?;

    // Check for duplicate and add new one to storage.
    if vaa_archive_check(deps.storage, vaa.hash.as_slice()) {
        return ContractError::VaaAlreadyExecuted.std_err();
    }
    vaa_archive_add(deps.storage, vaa.hash.as_slice())?;

    Ok(Response::new().add_attribute("action", "process"))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::MessengerInfo { } => {
            to_binary(&query_messenger_info(deps)?)
        }
    }
}

pub fn query_messenger_info(_deps: Deps) -> StdResult<String> {
    ContractError::AssetNotFound.std_err()
}

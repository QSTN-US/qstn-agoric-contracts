#!/bin/bash

if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <network>"
    echo "Network must be either 'avax' or 'fuji' or 'base-sepolia' or 'eth-sepolia'"
    exit 1
fi

network=$1

deploy_contract() {
    local contract_path=$1
    local gateway_contract=$2
    local gas_service=$3
    local chain_name=$4

    GATEWAY_CONTRACT="$gateway_contract" \
        GAS_SERVICE="$gas_service" \
        CHAIN_NAME="$chain_name" \
        npx hardhat ignition deploy "$contract_path" --network "$network" --verify
}

delete_deployments_folder() {
    local folder=$1
    if [ -d "$folder" ]; then
        echo "Deleting existing deployment folder: $folder"
        rm -rf "$folder"
    else
        echo "No existing deployment folder to delete: $folder"
    fi
}

case $network in
fuji)
    CHAIN_NAME='Avalanche'
    GATEWAY='0xC249632c2D40b9001FE907806902f63038B737Ab'
    GAS_SERVICE='0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6'
    ;;
avax)
    CHAIN_NAME='Avalanche'
    GATEWAY='0x5029C0EFf6C34351a0CEc334542cDb22c7928f78'
    GAS_SERVICE='0x2d5d7d31F671F86C782533cc367F14109a082712'
    ;;
base-sepolia)
    CHAIN_NAME='base-sepolia'
    GATEWAY='0xB8Cd93C83A974649D76B1c19f311f639e62272BC'
    GAS_SERVICE='0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6'
    ;;
eth-sepolia)
    CHAIN_NAME='Ethereum'
    GATEWAY='0xe432150cce91c13a887f7D836923d5597adD8E31'
    GAS_SERVICE='0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6'
    ;;
*)
    echo "Invalid network specified"
    exit 1
    ;;
esac

delete_deployments_folder "ignition/deployments"

deploy_contract "./ignition/modules/deployQuizzler.ts" "$GATEWAY" "$GAS_SERVICE" "$CHAIN_NAME"
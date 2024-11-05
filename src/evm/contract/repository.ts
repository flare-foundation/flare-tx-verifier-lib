import * as txnetwork from "../../txnetwork"

const FLARE_SMART_CONTRACTS_V1_URL = "https://gitlab.com/flarenetwork/flare-smart-contracts/-/raw/#NETWORK_network_deployed_code/deployment/deploys/#NETWORK.json"
const FLARE_SMART_CONTRACTS_V2_URL = "https://raw.githubusercontent.com/flare-foundation/flare-smart-contracts-v2/refs/heads/main/deployment/deploys/all/#NETWORK.json"
const FLARE_FASSET_CONTRACTS_URL = "https://raw.githubusercontent.com/flare-labs-ltd/fassets/refs/heads/open_beta/deployment/deploys/#NETWORK.json"

export async function getAddressesOfFlareSmartContractsV1(network: number): Promise<Array<string>> {
    return _getAddresses(network, FLARE_SMART_CONTRACTS_V1_URL)
}

export async function getAddressesOfFlareSmartContractsV2(network: number): Promise<Array<string>> {
    return _getAddresses(network, FLARE_SMART_CONTRACTS_V2_URL)
}

export async function getAddressesOfFlareFassetContracts(network: number): Promise<Array<string>> {
    return _getAddresses(network, FLARE_FASSET_CONTRACTS_URL)
}

async function _getAddresses(network: number, baseUrl: string): Promise<Array<string>> {
    let contracts = await _get(network, baseUrl)
    if (contracts.every(c => "addresses" in c)) {
        return contracts.flatMap(c => c.addresses)
    }
    if (contracts.every(c => "address" in c)) {
        return contracts.map(c => c.address)
    }
    return []
}

async function _get(network: number, baseUrl: string): Promise<Array<any>> {
    let url = _getJsonUrl(network, baseUrl)
    if (url == null) {
        return []
    }
    try {
        let data = await fetch(url)
        let response = await data.json()
        return response
    } catch {
        return []
    }
}

function _getJsonUrl(network: number, baseUrl: string): string {
    let code = null
    if (network == txnetwork.FLARE_C_CHAIN) {
        code = "flare"
    } else if (network == txnetwork.SONGBIRD_C_CHAIN) {
        code = "songbird"
    } else if (network == txnetwork.COSTON2_C_CHAIN) {
        code = "coston2"
    } else if (network == txnetwork.COSTON_C_CHAIN) {
        code = "coston"
    }
    return code == null ? null : baseUrl.replace(/#NETWORK/g, code)
}
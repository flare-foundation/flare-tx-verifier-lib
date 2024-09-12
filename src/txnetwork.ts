export const FLARE_C_CHAIN = 14
export const SONGBIRD_C_CHAIN = 19
export const COSTON2_C_CHAIN = 114
export const COSTON_C_CHAIN = 16

export const FLARE_P_CHAIN = 14
export const SONGBIRD_P_CHAIN = 5
export const COSTON2_P_CHAIN = 114
export const COSTON_P_CHAIN = 7

export function getCChainNetworks(): Array<number> {
    return [
        FLARE_C_CHAIN,
        SONGBIRD_C_CHAIN,
        COSTON2_C_CHAIN,
        COSTON_C_CHAIN
    ]
}

export function getPChainNetworks(): Array<number> {
    return [
        FLARE_P_CHAIN,
        SONGBIRD_P_CHAIN,
        COSTON2_P_CHAIN,
        COSTON_P_CHAIN
    ]
}

export function isKnownCChainNetwork(network: number): boolean {
    return getCChainNetworks().includes(network)
}

export function isKnownPChainNetwork(network: number): boolean {
    return getPChainNetworks().includes(network)
}

export function getCChainNetworkDescription(network: number): string {
    switch (network) {
        case FLARE_C_CHAIN:
            return "Flare Mainnet"
        case SONGBIRD_C_CHAIN:
            return "Songbird Canary-Network"
        case COSTON2_C_CHAIN:
            return "Flare Testnet Coston2"
        case COSTON_C_CHAIN:
            return "Flare Testnet Coston"
        default:
            return network.toString()
    }
}

export function getPChainNetworkDescription(network: number): string {
    switch (network) {
        case FLARE_P_CHAIN:
            return "Flare Mainnet"
        case SONGBIRD_P_CHAIN:
            return "Songbird Canary-Network"
        case COSTON2_P_CHAIN:
            return "Flare Testnet Coston2"
        case COSTON_P_CHAIN:
            return "Flare Testnet Coston"
        default:
            return network.toString()
    }
}
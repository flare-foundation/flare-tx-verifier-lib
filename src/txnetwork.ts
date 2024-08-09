export const AVAX_FLARE = 14
export const AVAX_SONGBIRD = 5
export const AVAX_COSTON2 = 114
export const AVAX_COSTON = 7

export const EVM_FLARE = 14
export const EVM_SONGBIRD = 19
export const EVM_COSTON2 = 114
export const EVM_COSTON = 16

export function getAvaxNetworks(): Array<number> {
    return [
        AVAX_FLARE,
        AVAX_SONGBIRD,
        AVAX_COSTON2,
        AVAX_COSTON
    ]
}

export function getEvmNetworks(): Array<number> {
    return [
        EVM_FLARE,
        EVM_SONGBIRD,
        EVM_COSTON2,
        EVM_COSTON
    ]
}

export function isKnownAvaxNetwork(network: number): boolean {
    return getAvaxNetworks().includes(network)
}

export function isKnownEvmNetwork(network: number): boolean {
    return getEvmNetworks().includes(network)
}

export function getAvaxNetworkDescription(network: number): string {
    switch (network) {
        case AVAX_FLARE:
            return "Flare Mainnet"
        case AVAX_SONGBIRD:
            return "Songbird Canary-Network"
        case AVAX_COSTON2:
            return "Flare Testnet Coston2"
        case AVAX_COSTON:
            return "Flare Testnet Coston"
        default:
            return network.toString()
    }
}

export function getEvmNetworkDescription(network: number): string {
    switch (network) {
        case EVM_FLARE:
            return "Flare Mainnet"
        case EVM_SONGBIRD:
            return "Songbird Canary-Network"
        case EVM_COSTON2:
            return "Flare Testnet Coston2"
        case EVM_COSTON:
            return "Flare Testnet Coston"
        default:
            return network.toString()
    }
}
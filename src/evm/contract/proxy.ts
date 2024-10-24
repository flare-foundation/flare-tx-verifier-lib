import { Contract, ethers, Interface, JsonRpcProvider } from "ethers"
import * as chain from "./chain"
import * as settings from "../../settings"
import * as utils from "../../utils"

const EIP1167_CODE_PREFIX = "0x363d3d373d3d3d363d"
const EIP1167_CODE_SUFFIX = "57fd5bf3"

export async function target(
    network: number,
    proxy: string,
    data: string
): Promise<string | null> {
    let code = await chain.getContractCode(network, proxy)

    let address: string | null

    let tests = [
        () => _getEIP2535Target(network, proxy, data),
        () => _getEIP1967Target(network, proxy, code),
        () => _getEIP1822Target(network, proxy, code),
        () => _getEIP1167Target(code),
        () => _getGnosisSafeTarget(network, proxy, code),
        () => _getOpenZeppelinTarget(network, proxy, code),
        () => _getEIP897Target(network, proxy, code)
    ]
    
    for (let test of tests) {        
        address = await test()
        if (address) {
            return address
        }
    }

    return null
}

function _getEIP1167Target(code: string): string | null {
    if (!code.startsWith(EIP1167_CODE_PREFIX)) {
        return null
    }

    let pushNHex = code.substring(EIP1167_CODE_PREFIX.length, EIP1167_CODE_PREFIX.length + 2)
    let addressLength = parseInt(pushNHex, 16) - 0x5f

    if (addressLength < 1 || addressLength > 20) {
        return null
    }

    let address = code.substring(
        EIP1167_CODE_PREFIX.length + 2,
        EIP1167_CODE_PREFIX.length + 2 + addressLength * 2
    )

    let SUFFIX_OFFSET_FROM_ADDRESS_END = 22
    if (
        !code
            .substring(
                EIP1167_CODE_PREFIX.length +
                2 +
                addressLength * 2 +
                SUFFIX_OFFSET_FROM_ADDRESS_END
            )
            .startsWith(EIP1167_CODE_SUFFIX)
    ) {
        return null
    }

    return `0x${address.padStart(40, '0')}`
}

async function _getEIP2535Target(
    network: number,
    proxy: string,
    data: string
): Promise<string | null> {
    let provider = _getProvider(network)
    let loupe = new Contract(
        proxy,
        Interface.from([
            {
                "inputs": [
                    {
                        "internalType": "bytes4",
                        "name": "_functionSelector",
                        "type": "bytes4"
                    }
                ],
                "name": "facetAddress",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "facetAddress_",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            }]),
        provider)
    try {
        let address = await loupe.facetAddress(data.slice(0, 10))
        return utils.isZeroHex(address) ? null : address
    } catch {
        return null
    }
}

async function _getEIP1967Target(
    network: number,
    proxy: string,
    code: string
): Promise<string | null> {
    let address: string | null

    let logicSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    address = await _getAddressFromContractSlot(network, proxy, code, logicSlot)
    if (address != null) {
        return address
    }

    let beaconSlot = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50"
    let beacon = await _getAddressFromContractSlot(network, proxy, code, beaconSlot)
    if (beacon == null) {
        return null
    }

    let beaconCode = await chain.getContractCode(network, beacon)
    if (utils.isZeroHex(beaconCode)) {
        return null
    }

    address = await _getAddressFromContractMethod(network, beacon, beaconCode, "implementation")
    if (address != null) {
        return address
    }

    address = await _getAddressFromContractMethod(network, beacon, beaconCode, "childImplementation")
    if (address != null) {
        return address
    }

    return null
}

async function _getEIP1822Target(
    network: number,
    proxy: string,
    code: string
): Promise<string | null> {
    let slot = "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7"
    return _getAddressFromContractSlot(network, proxy, code, slot)
}

async function _getOpenZeppelinTarget(
    network: number,
    proxy: string,
    code: string
): Promise<string | null> {
    let slot = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3"
    return _getAddressFromContractSlot(network, proxy, code, slot)
}

async function _getGnosisSafeTarget(
    network: number,
    proxy: string,
    code: string
): Promise<string | null> {
    return _getAddressFromContractMethod(network, proxy, code, "masterCopy")
}

async function _getEIP897Target(
    network: number,
    proxy: string,
    code: string
): Promise<string | null> {
    return _getAddressFromContractMethod(network, proxy, code, "implementation")
}

async function _getAddressFromContractSlot(
    network: number,
    contractAddress: string,
    contractCode: string,
    contractSlot: string
): Promise<string | null> {
    if (!contractCode.includes(contractSlot.slice(2))) {
        return null
    }
    let provider = _getProvider(network)
    let address = await provider.getStorage(contractAddress, contractSlot)
    return utils.isZeroHex(address) ? null : ethers.stripZerosLeft(address)
}

async function _getAddressFromContractMethod(
    network: number,
    contractAddress: string,
    contractCode: string,
    contractMethod: string
): Promise<string | null> {
    if (!contractCode.includes(ethers.id(`${contractMethod}()`).slice(2, 10))) {
        return null
    }

    let contract = new Contract(
        contractAddress,
        Interface.from([{
            "inputs": [],
            "name": contractMethod,
            "outputs": [
                {
                    "internalType": "address",
                    "name": "address",
                    "type": "address"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }]),
        _getProvider(network))

    try {
        let address = await contract[contractMethod]()
        return utils.isZeroHex(address) ? null : address
    } catch {
        return null
    }
}

function _getProvider(network: number): JsonRpcProvider {
    return new JsonRpcProvider(settings.C_CHAIN_API_RPC[network])
}
import * as settings from "../../settings";
import * as txnetwork from "../../txnetwork";

const FLARE_SMART_CONTRACTS_V1_URL =
  "https://gitlab.com/flarenetwork/flare-smart-contracts/-/raw/#NETWORK_network_deployed_code/deployment/deploys/#NETWORK.json";
const FLARE_SMART_CONTRACTS_V2_URL =
  "https://raw.githubusercontent.com/flare-foundation/flare-smart-contracts-v2/refs/heads/main/deployment/deploys/all/#NETWORK.json";
const FLARE_FASSET_CONTRACTS_URL =
  "https://raw.githubusercontent.com/flare-foundation/fassets/refs/heads/main/deployment/deploys/history/#NETWORK.json";

export async function getAddressesOfFlareSmartContractsV1(network: number): Promise<Array<string>> {
  return _getAddresses(network, FLARE_SMART_CONTRACTS_V1_URL);
}

export async function getAddressesOfFlareSmartContractsV2(network: number): Promise<Array<string>> {
  return _getAddresses(network, FLARE_SMART_CONTRACTS_V2_URL);
}

export async function getAddressesOfFlareFassetContracts(network: number): Promise<Array<string>> {
  return _getAddresses(network, FLARE_FASSET_CONTRACTS_URL);
}

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/**
 * Returns the addresses listed in a deployment file. Each entry has an `address` or an `addresses` list;
 * entries and values of another form are skipped.
 */
async function _getAddresses(network: number, baseUrl: string): Promise<Array<string>> {
  const addresses: string[] = [];
  for (const contract of await _get(network, baseUrl)) {
    if (contract == null || typeof contract !== "object") {
      continue;
    }
    const values: unknown[] = Array.isArray(contract.addresses) ? contract.addresses : [contract.address];
    for (const value of values) {
      if (typeof value === "string" && ADDRESS_PATTERN.test(value)) {
        addresses.push(value);
      }
    }
  }
  return addresses;
}

/**
 * Returns the entries of a deployment file, or an empty list if it cannot be downloaded or is not a list.
 */
async function _get(network: number, baseUrl: string): Promise<Array<Record<string, unknown>>> {
  const url = _getJsonUrl(network, baseUrl);
  if (url == null) {
    return [];
  }
  try {
    const data = await fetch(url, { signal: AbortSignal.timeout(settings.REQUEST_TIMEOUT_MS) });
    if (!data.ok) {
      return [];
    }
    const response: unknown = await data.json();
    return Array.isArray(response) ? response : [];
  } catch {
    return [];
  }
}

function _getJsonUrl(network: number, baseUrl: string): string {
  let code = null;
  if (network === txnetwork.FLARE_C_CHAIN) {
    code = "flare";
  } else if (network === txnetwork.SONGBIRD_C_CHAIN) {
    code = "songbird";
  } else if (network === txnetwork.COSTON2_C_CHAIN) {
    code = "coston2";
  } else if (network === txnetwork.COSTON_C_CHAIN) {
    code = "coston";
  }
  return code == null ? null : baseUrl.replace(/#NETWORK/g, code);
}

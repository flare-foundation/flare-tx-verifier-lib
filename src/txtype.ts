export const TRANSFER_C = "transferC";
export const CONTRACT_CALL_C = "contractCallC";
export const EXPORT_C = "exportC";
export const IMPORT_C = "importC";
export const EXPORT_P = "exportP";
export const IMPORT_P = "importP";
export const TRANSFER_P = "transferP";
export const ADD_DELEGATOR_P = "addDelegatorP";
export const ADD_VALIDATOR_P = "addValidatorP";
export const ADD_AUTO_RENEWED_VALIDATOR_P = "addAutoRenewedValidatorP";
export const UPDATE_AUTO_RENEWED_VALIDATOR_P = "updateAutoRenewedValidatorP";
export const REMOVE_AUTO_RENEWED_VALIDATOR_P = "removeAutoRenewedValidatorP";

export function isKnownType(type: string): boolean {
  return [
    TRANSFER_C,
    CONTRACT_CALL_C,
    EXPORT_C,
    IMPORT_C,
    EXPORT_P,
    IMPORT_P,
    TRANSFER_P,
    ADD_DELEGATOR_P,
    ADD_VALIDATOR_P,
    ADD_AUTO_RENEWED_VALIDATOR_P,
    UPDATE_AUTO_RENEWED_VALIDATOR_P,
    REMOVE_AUTO_RENEWED_VALIDATOR_P,
  ].includes(type);
}

export function getDescription(type: string): string {
  switch (type) {
    case TRANSFER_C: {
      return "Funds transfer on C-chain";
    }
    case CONTRACT_CALL_C: {
      return "Contract call on C-chain";
    }
    case EXPORT_C: {
      return "Export from C-chain";
    }
    case IMPORT_C: {
      return "Import to C-chain";
    }
    case EXPORT_P: {
      return "Export from P-chain";
    }
    case IMPORT_P: {
      return "Import to P-chain";
    }
    case TRANSFER_P: {
      return "Funds transfer on P-chain";
    }
    case ADD_DELEGATOR_P: {
      return "Stake on P-chain";
    }
    case ADD_VALIDATOR_P: {
      return "Add validator on P-chain";
    }
    case ADD_AUTO_RENEWED_VALIDATOR_P: {
      return "Add auto-renewed validator on P-chain";
    }
    case UPDATE_AUTO_RENEWED_VALIDATOR_P: {
      return "Update auto-renewed validator on P-chain";
    }
    case REMOVE_AUTO_RENEWED_VALIDATOR_P: {
      return "Remove auto-renewed validator on P-chain";
    }
    default: {
      return "Unknown transaction type";
    }
  }
}

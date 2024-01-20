interface TxVerification {
    network: string;
    type: string;
    description: string;
    recipients: Array<string>;
    values: Array<string>;
    fee?: string;
    contractName?: string;
    contractMethod?: string;
    contractData?: string;
    isFlareNetworkContract?: boolean;
    parameters?: Array<TxVerificationParameter>;
    warnings: Array<string>;
    messageToSign: string;
}
interface TxVerificationParameter {
    name: string;
    value: string;
}

declare function verify(txHex: string): Promise<TxVerification | null>;

export { type TxVerification, type TxVerificationParameter, verify };

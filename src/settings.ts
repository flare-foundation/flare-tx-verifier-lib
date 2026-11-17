type NetworkId = {
  [key: number]: string;
};

export const C_CHAIN_API_RPC: NetworkId = {
  14: "https://flare-api.flare.network/ext/bc/C/rpc",
  16: "https://coston-api.flare.network/ext/bc/C/rpc",
  19: "https://songbird-api.flare.network/ext/bc/C/rpc",
  114: "https://coston2-api.flare.network/ext/bc/C/rpc",
};

export const P_CHAIN_API: NetworkId = {
  5: "https://songbird-api.flare.network/ext/bc/P",
  7: "https://coston-api.flare.network/ext/bc/P",
  14: "https://flare-api.flare.network/ext/bc/P",
  114: "https://coston2-api.flare.network/ext/bc/P",
};

export const EXPLORER: NetworkId = {
  14: "https://flare-explorer.flare.network/api",
  16: "https://coston-explorer.flare.network/api",
  19: "https://songbird-explorer.flare.network/api",
  114: "https://coston2-explorer.flare.network/api",
};

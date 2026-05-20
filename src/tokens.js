export const APP_CONFIG = {
  universalRouter: "TSJEtPuqHpvSaVnSwvCsngaeBxrGUzp95Q",
  permit2: "TTJxU3P8rHycAyFY4kVtGNfmnMH4ezcuM9",
  feeLimitSun: 50_000_000,
  tronscanBaseUrl: "https://tronscan.org/#",
  publicFullNodes: [
    "https://api.trongrid.io",
    "https://api.oregon.trongrid.io",
    "https://api.singapore.trongrid.io",
    "https://api.frankfurt.trongrid.io",
    "https://api.tronstack.io"
  ],
  publicNodeTimeoutMs: 4500,
  energy: {
    classicTransfer: 60_000,
    routerTransfer: 1_600,
    classicBandwidth: 345,
    routerBandwidth: 620,
    classicUserPercent: 100,
    routerUserPercent: 1,
    sunPerEnergy: 100,
    sunPerBandwidth: 1_000,
    trxUsd: 0.357
  }
};

export const TOKENS = [
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    decimals: 6,
    logoURI: "https://static.tronscan.org/production/logo/usdtlogo.png"
  },
  {
    symbol: "USDD",
    name: "Decentralized USD",
    address: "TXDk8mbtRbXeYuMNS83CfKPaYYT8XWv9Hz",
    decimals: 18,
    logoURI: "https://static.tronscan.org/production/upload/logo/new/TXDk8mbtRbXeYuMNS83CfKPaYYT8XWv9Hz.png"
  },
  {
    symbol: "TUSD",
    name: "TrueUSD",
    address: "TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4",
    decimals: 18,
    logoURI: "https://static.tronscan.org/production/logo/TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4.png"
  },
  {
    symbol: "SUN",
    name: "SUN",
    address: "TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S",
    decimals: 18,
    logoURI: "https://static.tronscan.org/production/logo/TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S.png"
  },
  {
    symbol: "WIN",
    name: "WINkLink",
    address: "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
    decimals: 6,
    logoURI: "https://static.tronscan.org/profile_images/JKtJTydD_400x400.jpg"
  }
];

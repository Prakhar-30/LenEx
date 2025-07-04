export const SEPOLIA_TESTNET = {
  chainId: '0xaa36a7', // 11155111 in decimal (correct Sepolia chain ID)
  chainName: 'Sepolia Test Network',
  nativeCurrency: {
    name: 'SepoliaETH',
    symbol: 'SEP',
    decimals: 18
  },
  rpcUrls: [
    'https://1rpc.io/sepolia',
    'https://rpc.sepolia.org',
    'https://rpc2.sepolia.org',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://sepolia.gateway.tenderly.co',
    'https://ethereum-sepolia.publicnode.com'
  ],
  blockExplorerUrls: ['https://sepolia.etherscan.io/']
};

export const COLORS = {
  cyberBlue: '#00f5ff',
  neonGreen: '#39ff14', 
  electricPurple: '#bf00ff',
  hotPink: '#ff1493',
  laserOrange: '#ff4500'
};

// Chain ID constants for easy reference
export const CHAIN_IDS = {
  SEPOLIA: 11155111,
  MAINNET: 1,
  GOERLI: 5
};

// Contract deployment info
export const CONTRACT_INFO = {
  DeLex_CORE: {
    address: "0x27cc171d68B20BBE3E81B009F337b17b06196f82",
    deployedBlock: null // Add block number when you know it
  }
};

// Example test tokens (for reference only - users can input any token)
export const EXAMPLE_TOKENS = {
  TKNA: {
    address: "0x14070c3D2567938F797De6F7ed21a58990586080",
    symbol: "TKNA",
    name: "Token A"
  },
  TKNB: {
    address: "0xDf7d6E11E069Bc19CDDB4Ad008aA6DC8607f40f9",
    symbol: "TKNB", 
    name: "Token B"
  }
};

// Common token addresses on Sepolia (for convenience)
export const COMMON_SEPOLIA_TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Example - update with real addresses
    decimals: 6
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", // Example - update with real addresses
    decimals: 18
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6", // Example - update with real addresses
    decimals: 18
  }
];

// Standard ERC20 ABI for token interactions
export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

// Validation helpers
export const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const isValidEthereumAddress = (address) => {
  return ADDRESS_REGEX.test(address);
};

// Network configuration
export const NETWORK_CONFIG = {
  [CHAIN_IDS.SEPOLIA]: {
    name: 'Sepolia',
    currency: 'SEP',
    explorerUrl: 'https://sepolia.etherscan.io',
    rpcUrl: 'https://1rpc.io/sepolia'
  }
};

// App configuration
export const APP_CONFIG = {
  name: 'DeLex Protocol',
  version: '1.0.0',
  description: 'Decentralized Lending + Exchange Protocol',
  supportedChains: [CHAIN_IDS.SEPOLIA],
  defaultSlippage: 0.5, // 0.5%
  maxSlippage: 5.0, // 5%
  refreshInterval: 30000, // 30 seconds
};
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
  },
  TOKENS: {
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
  }
};
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ethers } from 'ethers';

// Chain configurations
const CHAIN_CONFIG = {
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    routerAddress: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008',
    factoryAddress: '0x7E0987E5b3a30e3f2828572Bb659A548460a3003',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    routerAddress: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
    factoryAddress: '0x8909Dc15e40173Ff4699343b6eB8132c65e18ec6',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  unichain: {
    chainId: 1301,
    name: 'Unichain Sepolia',
    rpcUrl: 'https://sepolia.unichain.org',
    explorerUrl: 'https://sepolia.uniscan.xyz',
    routerAddress: '0x0000000000000000000000000000000000000000',
    factoryAddress: '0x0000000000000000000000000000000000000000',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  }
};

// Contract ABIs
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function factory() external pure returns (address)'
];

const FACTORY_ABI = [
  'function createPair(address tokenA, address tokenB) external returns (address pair)',
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'event PairCreated(address indexed token0, address indexed token1, address pair, uint)'
];

const PAIR_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'event Sync(uint112 reserve0, uint112 reserve1)'
];

const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

const UniswapV2Interface = () => {
  // State management
  const [selectedChain, setSelectedChain] = useState('sepolia');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [activeTab, setActiveTab] = useState('swap');
  
  // Swap state
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [tokenInData, setTokenInData] = useState(null);
  const [tokenOutData, setTokenOutData] = useState(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  
  // Visualize state
  const [pairAddress, setPairAddress] = useState('');
  const [pairData, setPairData] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [visualizeLoading, setVisualizeLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1w');
  const [historyProgress, setHistoryProgress] = useState(0);
  
  // Create pair state
  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initialize provider based on selected chain
  useEffect(() => {
    const initProvider = async () => {
      try {
        const config = CHAIN_CONFIG[selectedChain];
        // Use ethers v5 syntax for JsonRpcProvider
        const rpcProvider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        
        // Wait for the provider to detect the network
        await rpcProvider.getNetwork();
        
        setProvider(rpcProvider);
        setError('');
        console.log(`Provider initialized for ${config.name}`);
      } catch (err) {
        console.error('Provider initialization error:', err);
        setError(`Failed to connect to ${CHAIN_CONFIG[selectedChain].name}. Please check your internet connection.`);
      }
    };
    
    initProvider();
  }, [selectedChain]);

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask to use this dApp');
        return;
      }

      const config = CHAIN_CONFIG[selectedChain];
      
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      // Switch to the correct chain
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${config.chainId.toString(16)}` }],
        });
      } catch (switchError) {
        // Chain not added, try to add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${config.chainId.toString(16)}`,
              chainName: config.name,
              nativeCurrency: config.nativeCurrency,
              rpcUrls: [config.rpcUrl],
              blockExplorerUrls: [config.explorerUrl]
            }]
          });
        }
      }

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const web3Signer = web3Provider.getSigner();
      
      setSigner(web3Signer);
      setAccount(accounts[0]);
      setError('');
      setSuccessMsg('Wallet connected successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError(`Failed to connect wallet: ${err.message}`);
    }
  };

  // Fetch token data
  const fetchTokenData = async (tokenAddress, providerOrSigner) => {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, providerOrSigner);
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);
      
      let balance = '0';
      if (signer && account) {
        balance = await tokenContract.balanceOf(account);
      }
      
      return { 
        name, 
        symbol, 
        decimals: Number(decimals), 
        address: tokenAddress,
        balance: ethers.utils.formatUnits(balance, decimals)
      };
    } catch (err) {
      console.error(`Error fetching token data for ${tokenAddress}:`, err);
      throw err;
    }
  };

  // Load token data for swap
  const loadTokenData = async () => {
    if (!tokenIn || !tokenOut || !ethers.utils.isAddress(tokenIn) || !ethers.utils.isAddress(tokenOut)) {
      return;
    }

    try {
      const useProvider = signer || provider;
      const [inData, outData] = await Promise.all([
        fetchTokenData(tokenIn, useProvider),
        fetchTokenData(tokenOut, useProvider)
      ]);
      setTokenInData(inData);
      setTokenOutData(outData);
    } catch (err) {
      setError('Failed to load token data');
    }
  };

  useEffect(() => {
    if (tokenIn && tokenOut && provider) {
      loadTokenData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIn, tokenOut, signer, account, provider]);

  // Get quote for swap
  const getQuote = async () => {
    if (!amountIn || !tokenInData || !tokenOutData || !provider) return;

    setQuoteLoading(true);
    try {
      const config = CHAIN_CONFIG[selectedChain];
      const routerContract = new ethers.Contract(config.routerAddress, ROUTER_ABI, provider);
      
      const amountInWei = ethers.utils.parseUnits(amountIn, tokenInData.decimals);
      const path = [tokenIn, tokenOut];
      
      const amounts = await routerContract.getAmountsOut(amountInWei, path);
      const amountOutValue = ethers.utils.formatUnits(amounts[1], tokenOutData.decimals);
      
      setAmountOut(amountOutValue);
    } catch (err) {
      console.error('Error getting quote:', err);
      setAmountOut('0');
    } finally {
      setQuoteLoading(false);
    }
  };

  useEffect(() => {
    if (amountIn && tokenInData && tokenOutData && provider) {
      const timer = setTimeout(() => {
        getQuote();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountIn, tokenInData, tokenOutData, provider]);

  // Check and approve token
  const checkAndApprove = async (tokenAddress, amount, decimals) => {
    const config = CHAIN_CONFIG[selectedChain];
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    
    const amountWei = ethers.utils.parseUnits(amount, decimals);
    const allowance = await tokenContract.allowance(account, config.routerAddress);
    
    if (allowance.lt(amountWei)) {
      setSuccessMsg(`Approving ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}...`);
      const approveTx = await tokenContract.approve(config.routerAddress, ethers.constants.MaxUint256);
      await approveTx.wait();
      setSuccessMsg('Approval successful!');
    }
  };

  // Execute swap
  const executeSwap = async () => {
    if (!signer || !tokenInData || !tokenOutData || !amountIn) {
      setError('Please connect wallet and enter valid amounts');
      return;
    }

    setSwapLoading(true);
    setError('');
    
    try {
      const config = CHAIN_CONFIG[selectedChain];
      
      // Step 1: Approve token
      await checkAndApprove(tokenIn, amountIn, tokenInData.decimals);
      
      // Step 2: Execute swap
      const routerContract = new ethers.Contract(config.routerAddress, ROUTER_ABI, signer);
      const amountInWei = ethers.utils.parseUnits(amountIn, tokenInData.decimals);
      const amountOutMin = ethers.utils.parseUnits((parseFloat(amountOut) * 0.99).toString(), tokenOutData.decimals);
      const path = [tokenIn, tokenOut];
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      
      setSuccessMsg('Swapping tokens...');
      const swapTx = await routerContract.swapExactTokensForTokens(
        amountInWei,
        amountOutMin,
        path,
        account,
        deadline
      );
      
      const receipt = await swapTx.wait();
      setSuccessMsg(`Swap successful! Tx: ${receipt.transactionHash.slice(0, 10)}...`);
      
      // Reload token balances
      await loadTokenData();
      
      // Clear inputs
      setAmountIn('');
      setAmountOut('');
      
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Swap error:', err);
      setError(`Swap failed: ${err.message}`);
    } finally {
      setSwapLoading(false);
    }
  };

  // Fetch pair data for visualization
  const fetchPairData = async (skipHistory = false) => {
    if (!pairAddress || !ethers.utils.isAddress(pairAddress)) {
      setError('Please enter a valid pair address');
      return;
    }

    if (!provider) {
      setError('Provider not initialized. Please wait or refresh the page.');
      return;
    }

    setVisualizeLoading(true);
    setError('');
    if (!skipHistory) {
      setPairData(null);
      setPriceHistory([]);
    }

    try {
      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);

      const [token0Address, token1Address] = await Promise.all([
        pairContract.token0(),
        pairContract.token1()
      ]);

      const [token0Data, token1Data] = await Promise.all([
        fetchTokenData(token0Address, provider),
        fetchTokenData(token1Address, provider)
      ]);

      const reserves = await pairContract.getReserves();
      const reserve0 = ethers.utils.formatUnits(reserves.reserve0, token0Data.decimals);
      const reserve1 = ethers.utils.formatUnits(reserves.reserve1, token1Data.decimals);

      const currentPrice = parseFloat(reserve1) / parseFloat(reserve0);

      setPairData({
        token0: { ...token0Data, reserve: parseFloat(reserve0) },
        token1: { ...token1Data, reserve: parseFloat(reserve1) },
        currentPrice,
        pairContract
      });

      if (!skipHistory) {
        await fetchHistoricalPrices(pairContract, token0Data, token1Data, selectedTimeRange);
      }
    } catch (err) {
      console.error('Error fetching pair data:', err);
      setError(`Failed to fetch pair data: ${err.message}`);
    } finally {
      setVisualizeLoading(false);
    }
  };

  // Handle time range change
  const handleTimeRangeChange = async (newRange) => {
    setSelectedTimeRange(newRange);
    if (pairData && pairData.pairContract) {
      setVisualizeLoading(true);
      setPriceHistory([]);
      try {
        await fetchHistoricalPrices(
          pairData.pairContract,
          pairData.token0,
          pairData.token1,
          newRange
        );
      } catch (err) {
        console.error('Error changing time range:', err);
      } finally {
        setVisualizeLoading(false);
      }
    }
  };

  const fetchHistoricalPrices = async (pairContract, token0Data, token1Data, timeRange = '1w') => {
    try {
      setHistoryProgress(0);
      const currentBlock = await provider.getBlockNumber();
      
      // Calculate blocks based on time range
      const timeRangeConfig = {
        '1h': { blocks: 300, step: 10, label: '1 Hour' },        // ~1 hour (30 data points)
        '1d': { blocks: 7200, step: 240, label: '1 Day' },       // ~1 day (30 data points)
        '1w': { blocks: 50400, step: 1680, label: '1 Week' },    // ~1 week (30 data points)
        '1m': { blocks: 216000, step: 7200, label: '1 Month' },  // ~30 days (30 data points)
        '3m': { blocks: 648000, step: 21600, label: '3 Months' },// ~90 days (30 data points)
        '6m': { blocks: 1296000, step: 43200, label: '6 Months' },// ~180 days (30 data points)
        'ytd': { blocks: 2592000, step: 86400, label: 'Year to Date' } // ~1 year (30 data points)
      };

      const config = timeRangeConfig[timeRange] || timeRangeConfig['1w'];
      const totalBlocks = config.blocks;
      const blockStep = config.step;
      const dataPoints = 30;

      const historicalData = [];
      let successfulFetches = 0;

      console.log(`Fetching ${config.label} data...`);

      for (let i = 0; i < dataPoints; i++) {
        const blockNumber = currentBlock - (totalBlocks - (i * blockStep));
        if (blockNumber < 0) break;

        try {
          const reserves = await pairContract.getReserves({ blockTag: blockNumber });
          const reserve0 = parseFloat(ethers.utils.formatUnits(reserves.reserve0, token0Data.decimals));
          const reserve1 = parseFloat(ethers.utils.formatUnits(reserves.reserve1, token1Data.decimals));
          
          if (reserve0 > 0 && reserve1 > 0) {
            const price = reserve1 / reserve0;
            const block = await provider.getBlock(blockNumber);
            const timestamp = block.timestamp;
            const date = new Date(timestamp * 1000);
            
            // Format date based on time range
            let dateLabel;
            if (timeRange === '1h' || timeRange === '1d') {
              dateLabel = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            } else {
              dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            
            historicalData.push({
              date: dateLabel,
              price: price,
              block: blockNumber,
              timestamp: timestamp
            });
            
            successfulFetches++;
          }
        } catch (err) {
          console.log(`Skipping block ${blockNumber}: ${err.message}`);
        }

        // Update progress
        const progress = Math.round(((i + 1) / dataPoints) * 100);
        setHistoryProgress(progress);

        // Add delay every few requests to avoid rate limiting
        if (i % 3 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      console.log(`Successfully fetched ${successfulFetches} data points`);
      setPriceHistory(historicalData);
      setHistoryProgress(100);
      
      if (successfulFetches === 0) {
        setError('No historical data available for this time range. The pair might be too new.');
      }
    } catch (err) {
      console.error('Error fetching historical prices:', err);
      setError(`Failed to fetch price history: ${err.message}`);
      setPriceHistory([]);
    } finally {
      setHistoryProgress(0);
    }
  };

  // Create pair and add liquidity
  const createPairAndAddLiquidity = async () => {
    if (!signer || !tokenA || !tokenB || !amountA || !amountB) {
      setError('Please connect wallet and fill all fields');
      return;
    }

    if (!ethers.utils.isAddress(tokenA) || !ethers.utils.isAddress(tokenB)) {
      setError('Invalid token addresses');
      return;
    }

    setCreateLoading(true);
    setError('');

    try {
      const config = CHAIN_CONFIG[selectedChain];
      const factoryContract = new ethers.Contract(config.factoryAddress, FACTORY_ABI, signer);
      
      // Fetch token data
      const [tokenAData, tokenBData] = await Promise.all([
        fetchTokenData(tokenA, signer),
        fetchTokenData(tokenB, signer)
      ]);

      // Check if pair exists
      let pairAddr = await factoryContract.getPair(tokenA, tokenB);
      
      if (pairAddr === ethers.constants.AddressZero) {
        // Step 1: Create pair
        setSuccessMsg('Creating pair...');
        const createTx = await factoryContract.createPair(tokenA, tokenB);
        const receipt = await createTx.wait();
        
        // Get pair address from event
        const pairCreatedEvent = receipt.logs.find(
          log => log.topics[0] === ethers.utils.id('PairCreated(address,address,address,uint256)')
        );
        
        if (pairCreatedEvent && pairCreatedEvent.data) {
          const decoded = ethers.utils.defaultAbiCoder.decode(['address'], pairCreatedEvent.data);
          pairAddr = decoded[0];
        }
        
        setSuccessMsg(`Pair created: ${pairAddr.slice(0, 10)}...`);
      } else {
        setSuccessMsg('Pair already exists, adding liquidity...');
      }

      // Step 2: Approve both tokens
      await checkAndApprove(tokenA, amountA, tokenAData.decimals);
      await checkAndApprove(tokenB, amountB, tokenBData.decimals);

      // Step 3: Add liquidity
      const routerContract = new ethers.Contract(config.routerAddress, ROUTER_ABI, signer);
      const amountAWei = ethers.utils.parseUnits(amountA, tokenAData.decimals);
      const amountBWei = ethers.utils.parseUnits(amountB, tokenBData.decimals);
      const amountAMin = ethers.utils.parseUnits((parseFloat(amountA) * 0.99).toString(), tokenAData.decimals);
      const amountBMin = ethers.utils.parseUnits((parseFloat(amountB) * 0.99).toString(), tokenBData.decimals);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      setSuccessMsg('Adding liquidity...');
      const liquidityTx = await routerContract.addLiquidity(
        tokenA,
        tokenB,
        amountAWei,
        amountBWei,
        amountAMin,
        amountBMin,
        account,
        deadline
      );

      const liquidityReceipt = await liquidityTx.wait();
      setSuccessMsg(`Liquidity added! Pair: ${pairAddr}`);
      
      // Set pair address for visualization
      setPairAddress(pairAddr);
      
      // Clear inputs
      setTokenA('');
      setTokenB('');
      setAmountA('');
      setAmountB('');
      
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Create pair error:', err);
      setError(`Failed: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">🦄</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                Uniswap V2 Interface
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Chain Selector */}
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-xl bg-white hover:border-pink-400 focus:outline-none focus:border-pink-500 transition-colors font-medium"
              >
                <option value="sepolia">Sepolia</option>
                <option value="base">Base</option>
                <option value="unichain">Unichain Sepolia</option>
              </select>

              {/* Connect Wallet Button */}
              {!account ? (
                <button
                  onClick={connectWallet}
                  className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="px-4 py-2 bg-green-100 border-2 border-green-300 rounded-xl font-mono text-sm">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
            {error}
          </div>
        </div>
      )}
      
      {successMsg && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg">
            {successMsg}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 mt-8">
        <div className="flex gap-2 border-b border-gray-200">
          {['swap', 'visualize', 'create'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold rounded-t-lg transition-all capitalize ${
                activeTab === tab
                  ? 'bg-white text-pink-600 border-b-2 border-pink-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* SWAP TAB */}
        {activeTab === 'swap' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Swap Tokens</h2>
              
              {/* Token In */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                <input
                  type="text"
                  placeholder="Token Address"
                  value={tokenIn}
                  onChange={(e) => setTokenIn(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 transition-colors mb-2"
                />
                {tokenInData && (
                  <div className="text-sm text-gray-600 ml-2">
                    {tokenInData.symbol} | Balance: {parseFloat(tokenInData.balance).toFixed(4)}
                  </div>
                )}
                <input
                  type="number"
                  placeholder="0.0"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 transition-colors text-2xl font-semibold mt-2"
                />
              </div>

              {/* Swap Arrow */}
              <div className="flex justify-center my-4">
                <button
                  onClick={() => {
                    const temp = tokenIn;
                    setTokenIn(tokenOut);
                    setTokenOut(temp);
                    setAmountIn('');
                    setAmountOut('');
                  }}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* Token Out */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                <input
                  type="text"
                  placeholder="Token Address"
                  value={tokenOut}
                  onChange={(e) => setTokenOut(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 transition-colors mb-2"
                />
                {tokenOutData && (
                  <div className="text-sm text-gray-600 ml-2">
                    {tokenOutData.symbol} | Balance: {parseFloat(tokenOutData.balance).toFixed(4)}
                  </div>
                )}
                <div className="w-full px-4 py-4 bg-gray-50 rounded-xl text-2xl font-semibold text-gray-600 mt-2">
                  {quoteLoading ? 'Loading...' : amountOut || '0.0'}
                </div>
              </div>

              {/* Swap Button */}
              <button
                onClick={executeSwap}
                disabled={swapLoading || !account || !amountIn || !tokenInData || !tokenOutData}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg shadow-lg hover:shadow-xl"
              >
                {swapLoading ? 'Swapping...' : !account ? 'Connect Wallet' : 'Swap'}
              </button>
            </div>
          </div>
        )}

        {/* VISUALIZE TAB */}
        {activeTab === 'visualize' && (
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Visualize Pair</h2>
            
            <div className="flex gap-4 mb-8">
              <input
                type="text"
                value={pairAddress}
                onChange={(e) => setPairAddress(e.target.value)}
                placeholder="Enter Pair Address"
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-pink-400 transition-colors"
              />
              <button
                onClick={() => fetchPairData(false)}
                disabled={visualizeLoading || !provider}
                className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 transition-all"
              >
                {visualizeLoading ? 'Loading...' : 'Analyze'}
              </button>
            </div>

            {pairData && (
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl p-6 border-2 border-pink-200">
                    <h3 className="text-xl font-bold text-pink-800 mb-4">Token 0</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Name: <span className="font-semibold text-gray-800">{pairData.token0.name}</span></p>
                      <p className="text-sm text-gray-600">Symbol: <span className="font-semibold text-gray-800">{pairData.token0.symbol}</span></p>
                      <p className="text-xs font-mono bg-white p-2 rounded break-all">{pairData.token0.address}</p>
                      <p className="text-xl font-bold text-pink-700 mt-3">
                        {pairData.token0.reserve.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border-2 border-purple-200">
                    <h3 className="text-xl font-bold text-purple-800 mb-4">Token 1</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Name: <span className="font-semibold text-gray-800">{pairData.token1.name}</span></p>
                      <p className="text-sm text-gray-600">Symbol: <span className="font-semibold text-gray-800">{pairData.token1.symbol}</span></p>
                      <p className="text-xs font-mono bg-white p-2 rounded break-all">{pairData.token1.address}</p>
                      <p className="text-xl font-bold text-purple-700 mt-3">
                        {pairData.token1.reserve.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-6 text-white">
                  <h3 className="text-lg font-semibold mb-2">Current Price</h3>
                  <p className="text-3xl font-bold">
                    1 {pairData.token0.symbol} = {pairData.currentPrice.toFixed(6)} {pairData.token1.symbol}
                  </p>
                </div>

                {/* Time Range Selector */}
                <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-800">Price History</h3>
                    <div className="flex gap-2">
                      {['1h', '1d', '1w', '1m', '3m', '6m', 'ytd'].map((range) => (
                        <button
                          key={range}
                          onClick={() => handleTimeRangeChange(range)}
                          disabled={visualizeLoading}
                          className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all ${
                            selectedTimeRange === range
                              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          } disabled:opacity-50`}
                        >
                          {range.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {historyProgress > 0 && historyProgress < 100 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Loading historical data...</span>
                        <span className="text-sm font-semibold text-pink-600">{historyProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${historyProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {priceHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={priceHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }} 
                          angle={-45} 
                          textAnchor="end" 
                          height={80}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px'
                          }}
                          formatter={(value) => [value.toFixed(8), 'Price']}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#ec4899" 
                          strokeWidth={2.5}
                          dot={false}
                          name={`${pairData.token0.symbol}/${pairData.token1.symbol}`}
                          animationDuration={500}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : visualizeLoading ? (
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mb-4"></div>
                        <p className="text-gray-600">Loading chart data...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-96">
                      <p className="text-gray-500">No historical data available yet. Click a time range above to load.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CREATE PAIR TAB */}
        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <h2 className="text-3xl font-bold mb-6 text-gray-800">Create Pair & Add Liquidity</h2>
              
              <div className="space-y-6">
                {/* Token A */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Token A Address</label>
                  <input
                    type="text"
                    value={tokenA}
                    onChange={(e) => setTokenA(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-pink-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Token A Amount</label>
                  <input
                    type="number"
                    value={amountA}
                    onChange={(e) => setAmountA(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-pink-400 transition-colors"
                  />
                </div>

                {/* Token B */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Token B Address</label>
                  <input
                    type="text"
                    value={tokenB}
                    onChange={(e) => setTokenB(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-pink-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Token B Amount</label>
                  <input
                    type="number"
                    value={amountB}
                    onChange={(e) => setAmountB(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-pink-400 transition-colors"
                  />
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This will create a new pair if it doesn't exist, or add liquidity to an existing pair. 
                    Tokens will be approved automatically before adding liquidity.
                  </p>
                </div>

                <button
                  onClick={createPairAndAddLiquidity}
                  disabled={createLoading || !account}
                  className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg shadow-lg hover:shadow-xl"
                >
                  {createLoading ? 'Processing...' : !account ? 'Connect Wallet' : 'Create Pair & Add Liquidity'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 pb-8 text-center text-sm text-gray-600">
        <p>Network: {CHAIN_CONFIG[selectedChain].name} | Powered by Uniswap V2</p>
      </footer>
    </div>
  );
};

export default UniswapV2Interface;

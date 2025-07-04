import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import { MOCK_TOKENS } from '../contracts/MockToken';
import PoolCard from './PoolCard';
import toast from 'react-hot-toast';

const SwapInterface = () => {
  const { account, signer } = useWallet();
  const { DeLexContract, tokenContracts, contractsReady } = useContract(signer);
  
  const [fromToken, setFromToken] = useState('TKNA');
  const [toToken, setToToken] = useState('TKNB');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [pools, setPools] = useState([]);
  const [selectedPool, setSelectedPool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState({});
  const [showPools, setShowPools] = useState(true);
  const [poolsLoading, setPoolsLoading] = useState(true);

  useEffect(() => {
    if (DeLexContract && contractsReady) {
      loadPools();
    }
  }, [DeLexContract, contractsReady]);

  useEffect(() => {
    if (account && tokenContracts && contractsReady) {
      loadBalances();
    }
  }, [account, tokenContracts, contractsReady]);

  useEffect(() => {
    if (fromAmount && selectedPool && DeLexContract) {
      calculateOutput();
    } else {
      setToAmount('');
    }
  }, [fromAmount, selectedPool, fromToken, toToken]);

  useEffect(() => {
    // Auto-select pool when tokens change
    if (pools.length > 0) {
      const pool = pools.find(p => 
        (p.tokenA === MOCK_TOKENS[fromToken].address && p.tokenB === MOCK_TOKENS[toToken].address) ||
        (p.tokenA === MOCK_TOKENS[toToken].address && p.tokenB === MOCK_TOKENS[fromToken].address)
      );
      setSelectedPool(pool);
    }
  }, [fromToken, toToken, pools]);

  const loadPools = async () => {
    try {
      setPoolsLoading(true);
      const poolIds = await DeLexContract.getAllPools();
      const poolsData = await Promise.all(
        poolIds.map(async (poolId) => {
          const pool = await DeLexContract.getPoolInfo(poolId);
          return { id: poolId, ...pool };
        })
      );
      setPools(poolsData);
    } catch (error) {
      console.error('Error loading pools:', error);
    } finally {
      setPoolsLoading(false);
    }
  };

  const loadBalances = async () => {
    try {
      const newBalances = {};
      for (const [symbol, token] of Object.entries(MOCK_TOKENS)) {
        const balance = await tokenContracts[symbol].balanceOf(account);
        newBalances[symbol] = parseFloat(ethers.utils.formatEther(balance)).toFixed(4);
      }
      setBalances(newBalances);
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const calculateOutput = async () => {
    if (!selectedPool || !fromAmount) {
      setToAmount('');
      return;
    }
    
    try {
      const amountIn = ethers.utils.parseEther(fromAmount);
      const isTokenA = selectedPool.tokenA === MOCK_TOKENS[fromToken].address;
      
      const reserveIn = isTokenA ? selectedPool.reserveA : selectedPool.reserveB;
      const reserveOut = isTokenA ? selectedPool.reserveB : selectedPool.reserveA;
      
      if (reserveIn.eq(0) || reserveOut.eq(0)) {
        setToAmount('0');
        return;
      }
      
      const amountOut = await DeLexContract.getAmountOut(amountIn, reserveIn, reserveOut);
      setToAmount(parseFloat(ethers.utils.formatEther(amountOut)).toFixed(6));
    } catch (error) {
      console.error('Error calculating output:', error);
      setToAmount('0');
    }
  };

  const handleSwap = async () => {
    if (!account || !DeLexContract || !selectedPool || !fromAmount) return;
    
    try {
      setLoading(true);
      
      const amountIn = ethers.utils.parseEther(fromAmount);
      const minAmountOut = ethers.utils.parseEther((parseFloat(toAmount) * 0.95).toString());
      
      // Approve token spend
      const tokenContract = tokenContracts[fromToken];
      const allowance = await tokenContract.allowance(account, DeLexContract.address);
      
      if (allowance.lt(amountIn)) {
        toast.loading('Approving token spend...');
        const approveTx = await tokenContract.approve(DeLexContract.address, amountIn);
        await approveTx.wait();
        toast.dismiss();
      }
      
      toast.loading('Swapping tokens...');
      const swapTx = await DeLexContract.swap(
        selectedPool.id,
        MOCK_TOKENS[fromToken].address,
        amountIn,
        minAmountOut
      );
      
      await swapTx.wait();
      toast.dismiss();
      toast.success('Swap successful!');
      
      // Reset form and reload data
      setFromAmount('');
      setToAmount('');
      loadBalances();
      loadPools();
      
    } catch (error) {
      toast.dismiss();
      toast.error('Swap failed: ' + error.message);
      console.error('Swap error:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const requestTestTokens = async (tokenSymbol) => {
    try {
      toast.loading('Requesting test tokens...');
      const tx = await tokenContracts[tokenSymbol].faucet();
      await tx.wait();
      toast.dismiss();
      toast.success(`Received 1000 ${tokenSymbol}!`);
      loadBalances();
    } catch (error) {
      toast.dismiss();
      toast.error('Faucet failed: ' + error.message);
    }
  };

  const getTokenSymbol = (address) => {
    return Object.keys(MOCK_TOKENS).find(key => 
      MOCK_TOKENS[key].address === address
    ) || 'Unknown';
  };

  if (!contractsReady) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-center items-center py-12">
          <div className="text-electric-purple font-cyber text-lg animate-pulse">
            Initializing contracts...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Swap Interface */}
      <div className="lg:col-span-1">
        <div className="cyber-card border-cyber-blue rounded-xl p-4 pencil-effect swap-section">
          <h2 className="text-xl font-cyber text-neon-green mb-4 text-center animate-glow">
            Token Swap
          </h2>
          
          {/* Test Token Faucets */}
          <div className="mb-4 form-section">
            <h3 className="text-electric-purple font-cyber mb-2 text-sm">Get Test Tokens:</h3>
            <div className="flex space-x-2">
              {Object.keys(MOCK_TOKENS).map(symbol => (
                <button
                  key={symbol}
                  onClick={() => requestTestTokens(symbol)}
                  disabled={!contractsReady}
                  className="flex-1 px-2 py-1 bg-electric-purple text-black font-cyber text-xs rounded hover:bg-opacity-80 transition-all disabled:opacity-50"
                >
                  Get {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* From Token */}
          <div className="mb-3 form-section">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 font-cyber text-sm">From</label>
              <span className="text-gray-400 text-xs">
                Balance: {balances[fromToken] || '0'}
              </span>
            </div>
            <div className="flex space-x-2">
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
                className="w-16 bg-black border border-gray-600 rounded px-2 py-2 text-white font-cyber text-xs"
              >
                {Object.keys(MOCK_TOKENS).map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-black border border-gray-600 rounded px-3 py-2 text-white font-cyber text-sm w-0"
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center mb-3">
            <button
              onClick={switchTokens}
              className="p-2 bg-hot-pink text-black rounded-full hover:bg-opacity-80 transition-all neon-border border-hot-pink"
            >
              ⇅
            </button>
          </div>

          {/* To Token */}
          <div className="mb-4 form-section">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 font-cyber text-sm">To</label>
              <span className="text-gray-400 text-xs">
                Balance: {balances[toToken] || '0'}
              </span>
            </div>
            <div className="flex space-x-2">
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
                className="w-16 bg-black border border-gray-600 rounded px-2 py-2 text-white font-cyber text-xs"
              >
                {Object.keys(MOCK_TOKENS).map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
              <input
                type="number"
                value={toAmount}
                readOnly
                placeholder="0.0"
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-gray-400 font-cyber text-sm w-0"
              />
            </div>
          </div>

          {/* Pool Selection */}
          <div className="mb-4 pool-section p-3">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 font-cyber text-sm">Selected Pool</label>
              <button
                onClick={() => setShowPools(!showPools)}
                className="text-cyber-blue hover:text-electric-purple transition-colors text-xs"
              >
                {showPools ? 'Hide' : 'Show'} Pools
              </button>
            </div>
            {selectedPool ? (
              <div className="p-2 border border-laser-orange rounded text-xs">
                <div className="text-laser-orange font-cyber text-sm mb-1">
                  {getTokenSymbol(selectedPool.tokenA)} / {getTokenSymbol(selectedPool.tokenB)}
                </div>
                <div className="text-gray-300 text-xs">
                  Reserves: {parseFloat(ethers.utils.formatEther(selectedPool.reserveA)).toFixed(2)} / {parseFloat(ethers.utils.formatEther(selectedPool.reserveB)).toFixed(2)}
                </div>
              </div>
            ) : (
              <div className="p-2 border border-red-500 rounded text-center text-xs">
                <div className="text-red-400 font-cyber text-sm">
                  No pool available
                </div>
                <button
                  onClick={() => window.location.href = '/liquidity'}
                  className="mt-1 px-2 py-1 bg-electric-purple text-black font-cyber text-xs rounded hover:bg-opacity-80"
                >
                  Create Pool
                </button>
              </div>
            )}
          </div>

          {/* Swap Details */}
          {selectedPool && fromAmount && toAmount && (
            <div className="mb-4 stats-section p-2">
              <div className="text-gray-400 font-cyber text-xs mb-1">Swap Details:</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Price Impact:</span>
                  <span className="text-laser-orange">~0.3%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Trading Fee:</span>
                  <span className="text-gray-300">0.3%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Min. Received:</span>
                  <span className="text-gray-300">{(parseFloat(toAmount) * 0.95).toFixed(4)} {toToken}</span>
                </div>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!account || loading || !fromAmount || !selectedPool}
            className="w-full py-3 bg-neon-green text-black font-cyber text-sm rounded-lg hover:bg-opacity-80 transition-all neon-border border-neon-green disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Swapping...' : 
             !selectedPool ? 'No Pool Available' :
             !fromAmount ? 'Enter Amount' : 'Swap Tokens'}
          </button>
        </div>
      </div>

      {/* Available Pools */}
      <div className="lg:col-span-2">
        <div className="pool-section p-4">
          <div className="mb-4">
            <h3 className="text-xl font-cyber text-cyber-blue mb-2 animate-glow">
              Available Trading Pools
            </h3>
            <p className="text-gray-300 mb-3 text-sm">
              Select a pool to trade or view detailed statistics
            </p>
          </div>

          {poolsLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-neon-green font-cyber text-lg animate-pulse">
                Loading pools...
              </div>
            </div>
          ) : showPools && pools.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {pools.map((pool) => (
                <div key={pool.id} className="pool-card-enhanced">
                  <PoolCard
                    pool={pool}
                    onSelectPool={setSelectedPool}
                    isSelected={selectedPool?.id === pool.id}
                    showActions={false}
                  />
                </div>
              ))}
            </div>
          ) : showPools && pools.length === 0 ? (
            <div className="cyber-card border-gray-600 rounded-xl p-8 text-center thin-neon-border">
              <div className="text-gray-400 font-cyber text-lg mb-4">
                No pools available
              </div>
              <p className="text-gray-500 mb-6">
                Create the first liquidity pool to enable trading
              </p>
              <button
                onClick={() => window.location.href = '/liquidity'}
                className="px-6 py-3 bg-electric-purple text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
              >
                Create First Pool
              </button>
            </div>
          ) : !showPools ? (
            <div className="cyber-card border-gray-600 rounded-xl p-8 text-center thin-neon-border">
              <div className="text-gray-400 font-cyber text-lg mb-4">
                Pool Selection Hidden
              </div>
              <p className="text-gray-500 mb-6">
                Click "Show Pools" above to view and select trading pools
              </p>
              <button
                onClick={() => setShowPools(true)}
                className="px-6 py-3 bg-cyber-blue text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
              >
                Show Available Pools
              </button>
            </div>
          ) : null}

          {/* Quick Actions */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="cyber-card border-electric-purple rounded-xl p-4 text-center thin-neon-border">
              <h4 className="text-electric-purple font-cyber mb-2">Add Liquidity</h4>
              <p className="text-gray-400 text-sm mb-3">
                Provide liquidity and earn trading fees
              </p>
              <button
                onClick={() => window.location.href = '/liquidity'}
                className="px-4 py-2 bg-electric-purple text-black font-cyber text-sm rounded hover:bg-opacity-80 transition-all"
              >
                Go to Liquidity
              </button>
            </div>
            
            <div className="cyber-card border-hot-pink rounded-xl p-4 text-center thin-neon-border">
              <h4 className="text-hot-pink font-cyber mb-2">Lending & Borrowing</h4>
              <p className="text-gray-400 text-sm mb-3">
                Lend tokens or borrow against collateral
              </p>
              <button
                onClick={() => window.location.href = '/lending'}
                className="px-4 py-2 bg-hot-pink text-black font-cyber text-sm rounded hover:bg-opacity-80 transition-all"
              >
                Go to Lending
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwapInterface;
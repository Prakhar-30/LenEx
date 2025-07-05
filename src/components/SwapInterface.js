import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import { useToken } from '../hooks/useToken';
import TokenInput from './TokenInput';
import toast from 'react-hot-toast';

const SwapInterface = () => {
  const { account, signer } = useWallet();
  const { DeLexContract, contractsReady } = useContract(signer);
  const { fetchTokenInfo, approveToken, getTokenAllowance, isValidAddress } = useToken(signer);
  
  const [fromTokenAddress, setFromTokenAddress] = useState('');
  const [toTokenAddress, setToTokenAddress] = useState('');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState(null);
  const [poolExists, setPoolExists] = useState(false);
  const [hasLiquidity, setHasLiquidity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingPool, setCheckingPool] = useState(false);
  const [fromTokenInfo, setFromTokenInfo] = useState(null);
  const [toTokenInfo, setToTokenInfo] = useState(null);
  const [swapRate, setSwapRate] = useState(null);
  const [priceImpact, setPriceImpact] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);

  // Process URL parameters only once when component mounts
  useEffect(() => {
    if (!urlParamsProcessed) {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenA = urlParams.get('tokenA');
      const tokenB = urlParams.get('tokenB');
      
      console.log('Processing URL params for swap:', { tokenA, tokenB });
      
      if (tokenA && ethers.utils.isAddress(tokenA)) {
        setFromTokenAddress(tokenA);
        console.log('Set fromToken from URL:', tokenA);
      }
      if (tokenB && ethers.utils.isAddress(tokenB)) {
        setToTokenAddress(tokenB);
        console.log('Set toToken from URL:', tokenB);
      }
      
      setUrlParamsProcessed(true);
    }
  }, [urlParamsProcessed]);

  // Initialize component when contracts are ready
  useEffect(() => {
    if (contractsReady && account && !initialized) {
      console.log('Initializing swap interface...');
      setInitialized(true);
    }
  }, [contractsReady, account, initialized]);

  // Load token info when addresses change (but only after initialization)
  useEffect(() => {
    if (initialized && fromTokenAddress && ethers.utils.isAddress(fromTokenAddress)) {
      loadFromTokenInfo();
    } else {
      setFromTokenInfo(null);
    }
  }, [fromTokenAddress, signer, initialized]);

  useEffect(() => {
    if (initialized && toTokenAddress && ethers.utils.isAddress(toTokenAddress)) {
      loadToTokenInfo();
    } else {
      setToTokenInfo(null);
    }
  }, [toTokenAddress, signer, initialized]);

  // Check for pool when both tokens are entered (but only after initialization)
  useEffect(() => {
    if (initialized && isValidAddress(fromTokenAddress) && isValidAddress(toTokenAddress) && 
        fromTokenAddress.toLowerCase() !== toTokenAddress.toLowerCase() && 
        DeLexContract && contractsReady) {
      checkForPool();
    } else {
      setSelectedPool(null);
      setPoolExists(false);
      setHasLiquidity(false);
      setToAmount('');
      setSwapRate(null);
      setPriceImpact(0);
    }
  }, [fromTokenAddress, toTokenAddress, DeLexContract, contractsReady, initialized]);

  // Calculate output when amount changes (but only after initialization)
  useEffect(() => {
    if (initialized && fromAmount && selectedPool && hasLiquidity && DeLexContract) {
      calculateOutput();
    } else {
      setToAmount('');
      setSwapRate(null);
      setPriceImpact(0);
    }
  }, [fromAmount, selectedPool, hasLiquidity, initialized]);

  const loadFromTokenInfo = async () => {
    if (!signer || !fromTokenAddress || !initialized) return;
    try {
      console.log('Loading from token info for:', fromTokenAddress);
      const info = await fetchTokenInfo(fromTokenAddress);
      setFromTokenInfo(info);
      console.log('From token info loaded:', info);
    } catch (error) {
      console.error('Error loading from token info:', error);
      setFromTokenInfo(null);
    }
  };

  const loadToTokenInfo = async () => {
    if (!signer || !toTokenAddress || !initialized) return;
    try {
      console.log('Loading to token info for:', toTokenAddress);
      const info = await fetchTokenInfo(toTokenAddress);
      setToTokenInfo(info);
      console.log('To token info loaded:', info);
    } catch (error) {
      console.error('Error loading to token info:', error);
      setToTokenInfo(null);
    }
  };

  const checkForPool = async () => {
    if (!DeLexContract || !fromTokenAddress || !toTokenAddress || !initialized) return;
    
    try {
      setCheckingPool(true);
      
      // Generate pool ID the same way the contract does
      const token0 = fromTokenAddress.toLowerCase() < toTokenAddress.toLowerCase() ? fromTokenAddress : toTokenAddress;
      const token1 = fromTokenAddress.toLowerCase() < toTokenAddress.toLowerCase() ? toTokenAddress : fromTokenAddress;
      
      const poolId = ethers.utils.keccak256(
        ethers.utils.solidityPack(['address', 'address'], [token0, token1])
      );
      
      console.log('Checking pool:', { poolId, token0, token1 });
      
      // Check if pool exists
      const poolInfo = await DeLexContract.getPoolInfo(poolId);
      
      if (poolInfo.exists) {
        setSelectedPool({ id: poolId, ...poolInfo });
        setPoolExists(true);
        
        // Check if pool has liquidity
        const reserveA = parseFloat(ethers.utils.formatEther(poolInfo.reserveA));
        const reserveB = parseFloat(ethers.utils.formatEther(poolInfo.reserveB));
        const hasLiq = reserveA > 0 && reserveB > 0;
        
        setHasLiquidity(hasLiq);
        
        console.log('Pool found:', {
          exists: true,
          reserveA,
          reserveB,
          hasLiquidity: hasLiq
        });
      } else {
        setSelectedPool(null);
        setPoolExists(false);
        setHasLiquidity(false);
        console.log('Pool does not exist');
      }
    } catch (error) {
      console.error('Error checking for pool:', error);
      setSelectedPool(null);
      setPoolExists(false);
      setHasLiquidity(false);
    } finally {
      setCheckingPool(false);
    }
  };

  const calculateOutput = async () => {
    if (!selectedPool || !fromAmount || !isValidAddress(fromTokenAddress) || !hasLiquidity || !initialized) {
      setToAmount('');
      setSwapRate(null);
      setPriceImpact(0);
      return;
    }
    
    try {
      const fromTokenInfo = await fetchTokenInfo(fromTokenAddress);
      const toTokenInfo = await fetchTokenInfo(toTokenAddress);
      const amountIn = ethers.utils.parseUnits(fromAmount, fromTokenInfo.decimals);
      
      const isTokenA = selectedPool.tokenA.toLowerCase() === fromTokenAddress.toLowerCase();
      const reserveIn = isTokenA ? selectedPool.reserveA : selectedPool.reserveB;
      const reserveOut = isTokenA ? selectedPool.reserveB : selectedPool.reserveA;
      
      if (reserveIn.eq(0) || reserveOut.eq(0)) {
        setToAmount('0');
        setSwapRate(null);
        setPriceImpact(0);
        return;
      }
      
      const amountOut = await DeLexContract.getAmountOut(amountIn, reserveIn, reserveOut);
      const formattedOutput = ethers.utils.formatUnits(amountOut, toTokenInfo.decimals);
      setToAmount(parseFloat(formattedOutput).toFixed(6));
      
      // Calculate swap rate
      const rate = parseFloat(formattedOutput) / parseFloat(fromAmount);
      setSwapRate(rate);
      
      // Calculate price impact (simplified)
      const spotPrice = parseFloat(ethers.utils.formatUnits(reserveOut, toTokenInfo.decimals)) / 
                       parseFloat(ethers.utils.formatUnits(reserveIn, fromTokenInfo.decimals));
      const executionPrice = rate;
      const impact = Math.abs((executionPrice - spotPrice) / spotPrice) * 100;
      setPriceImpact(impact);
      
    } catch (error) {
      console.error('Error calculating output:', error);
      setToAmount('0');
      setSwapRate(null);
      setPriceImpact(0);
    }
  };

  const createPool = async () => {
    if (!account || !DeLexContract || !isValidAddress(fromTokenAddress) || !isValidAddress(toTokenAddress)) {
      toast.error('Please enter valid token addresses');
      return;
    }

    if (fromTokenAddress.toLowerCase() === toTokenAddress.toLowerCase()) {
      toast.error('Token addresses must be different');
      return;
    }
    
    try {
      setLoading(true);
      toast.loading('Creating pool...');
      
      const tx = await DeLexContract.createPool(fromTokenAddress, toTokenAddress);
      await tx.wait();
      
      toast.dismiss();
      toast.success('Pool created successfully!');
      
      // Check for the newly created pool
      checkForPool();
    } catch (error) {
      toast.dismiss();
      if (error.message.includes('Pool exists')) {
        toast.error('Pool already exists for this token pair');
      } else {
        toast.error('Failed to create pool: ' + (error.reason || error.message));
      }
      console.error('Create pool error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!account || !DeLexContract || !selectedPool || !fromAmount || 
        !isValidAddress(fromTokenAddress) || !isValidAddress(toTokenAddress) || !hasLiquidity) {
      toast.error('Invalid swap parameters');
      return;
    }
    
    try {
      setLoading(true);
      
      const fromTokenInfo = await fetchTokenInfo(fromTokenAddress);
      const toTokenInfo = await fetchTokenInfo(toTokenAddress);
      
      const amountIn = ethers.utils.parseUnits(fromAmount, fromTokenInfo.decimals);
      const minAmountOut = ethers.utils.parseUnits(
        (parseFloat(toAmount) * 0.95).toString(), 
        toTokenInfo.decimals
      );
      
      // Check and approve token spend
      const currentAllowance = await getTokenAllowance(fromTokenAddress, account, DeLexContract.address);
      const currentAllowanceWei = ethers.utils.parseUnits(currentAllowance, fromTokenInfo.decimals);
      
      if (currentAllowanceWei.lt(amountIn)) {
        toast.loading('Approving token spend...');
        const approveTx = await approveToken(fromTokenAddress, DeLexContract.address, fromAmount);
        await approveTx.wait();
        toast.dismiss();
      }
      
      toast.loading('Swapping tokens...');
      const swapTx = await DeLexContract.swap(
        selectedPool.id,
        fromTokenAddress,
        amountIn,
        minAmountOut
      );
      
      await swapTx.wait();
      toast.dismiss();
      toast.success('Swap successful!');
      
      // Reset form and reload pool data
      setFromAmount('');
      setToAmount('');
      checkForPool();
      
    } catch (error) {
      toast.dismiss();
      toast.error('Swap failed: ' + (error.reason || error.message));
      console.error('Swap error:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTokens = () => {
    setFromTokenAddress(toTokenAddress);
    setToTokenAddress(fromTokenAddress);
    setFromTokenInfo(toTokenInfo);
    setToTokenInfo(fromTokenInfo);
    setFromAmount('');
    setToAmount('');
  };

  const navigateToLiquidity = () => {
    if (isValidAddress(fromTokenAddress) && isValidAddress(toTokenAddress)) {
      window.location.href = `/liquidity?tokenA=${fromTokenAddress}&tokenB=${toTokenAddress}`;
    } else {
      window.location.href = '/liquidity';
    }
  };

  const getPoolLiquidityStatus = () => {
    if (!selectedPool) return null;
    
    const reserveA = parseFloat(ethers.utils.formatEther(selectedPool.reserveA));
    const reserveB = parseFloat(ethers.utils.formatEther(selectedPool.reserveB));
    
    if (reserveA === 0 && reserveB === 0) {
      return 'empty';
    } else if (reserveA < 1 || reserveB < 1) {
      return 'low';
    }
    return 'sufficient';
  };

  const canSwap = () => {
    return poolExists && hasLiquidity && fromAmount && parseFloat(fromAmount) > 0 && toAmount && parseFloat(toAmount) > 0;
  };

  const isValidTokenPair = () => {
    return isValidAddress(fromTokenAddress) && 
           isValidAddress(toTokenAddress) && 
           fromTokenAddress.toLowerCase() !== toTokenAddress.toLowerCase();
  };

  // Show initialization loading state
  if (!contractsReady || !initialized) {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex justify-center items-center py-12">
          <div className="text-electric-purple font-cyber text-lg animate-pulse">
            Initializing contracts...
          </div>
        </div>
      </div>
    );
  }

  // Show account connection prompt
  if (!account) {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex justify-center items-center py-12">
          <div className="cyber-card border-laser-orange rounded-xl p-8 text-center">
            <div className="text-laser-orange font-cyber text-lg mb-4">
              Wallet Not Connected
            </div>
            <p className="text-gray-400">Please connect your wallet to access swap features</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="cyber-card border-cyber-blue rounded-xl p-6 pencil-effect swap-gaming-border retro-corners">
        <h2 className="text-2xl font-cyber text-neon-green mb-6 text-center animate-glow">
          Token Swap
        </h2>
        
        {/* From Token */}
        <div className="mb-4">
          <label className="text-gray-300 font-cyber mb-2 block">From:</label>
          <input
            type="text"
            value={fromTokenAddress}
            onChange={(e) => setFromTokenAddress(e.target.value)}
            placeholder="Enter token address to swap from"
            className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm mb-2"
          />
          
          {/* From Token Info Display */}
          {fromTokenAddress && ethers.utils.isAddress(fromTokenAddress) && (
            <div className="mb-2">
              {fromTokenInfo ? (
                <div className="flex items-center justify-between bg-gray-900 rounded-lg p-2">
                  <div className="text-neon-green text-sm font-cyber">
                    {fromTokenInfo.name} ({fromTokenInfo.symbol})
                  </div>
                  <div className="text-gray-400 text-xs">
                    Decimals: {fromTokenInfo.decimals}
                  </div>
                </div>
              ) : (
                <div className="text-electric-purple text-xs">Loading token info...</div>
              )}
            </div>
          )}
          
          {fromTokenInfo && (
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="Enter amount to swap"
              className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm"
            />
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center mb-4">
          <button
            onClick={switchTokens}
            disabled={!fromTokenAddress || !toTokenAddress}
            className="p-2 bg-hot-pink text-black rounded-full hover:bg-opacity-80 transition-all neon-border border-hot-pink disabled:opacity-50"
          >
            ⇅
          </button>
        </div>

        {/* To Token */}
        <div className="mb-6">
          <label className="text-gray-300 font-cyber mb-2 block">To:</label>
          <input
            type="text"
            value={toTokenAddress}
            onChange={(e) => setToTokenAddress(e.target.value)}
            placeholder="Enter token address to swap to"
            className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm mb-2"
          />
          
          {/* To Token Info Display */}
          {toTokenAddress && ethers.utils.isAddress(toTokenAddress) && (
            <div className="mb-2">
              {toTokenInfo ? (
                <div className="flex items-center justify-between bg-gray-900 rounded-lg p-2">
                  <div className="text-neon-green text-sm font-cyber">
                    {toTokenInfo.name} ({toTokenInfo.symbol})
                  </div>
                  <div className="text-gray-400 text-xs">
                    Decimals: {toTokenInfo.decimals}
                  </div>
                </div>
              ) : (
                <div className="text-electric-purple text-xs">Loading token info...</div>
              )}
            </div>
          )}
          
          {/* Output Amount Display */}
          {toTokenInfo && (
            <input
              type="text"
              value={toAmount}
              readOnly={true}
              placeholder="Output amount"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-gray-400 font-cyber text-sm"
            />
          )}
        </div>

        {/* Pool Status */}
        {isValidTokenPair() && (
          <div className="mb-4 p-4 border rounded-lg">
            {checkingPool ? (
              <div className="text-electric-purple text-sm font-cyber animate-pulse">
                🔍 Checking for pool...
              </div>
            ) : poolExists ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-neon-green text-sm font-cyber">
                    ✅ Pool exists for this token pair
                  </div>
                  {getPoolLiquidityStatus() === 'empty' && (
                    <div className="text-red-400 text-xs font-cyber">
                      NO LIQUIDITY
                    </div>
                  )}
                  {getPoolLiquidityStatus() === 'low' && (
                    <div className="text-laser-orange text-xs font-cyber">
                      LOW LIQUIDITY
                    </div>
                  )}
                </div>
                <div className="text-gray-300 text-xs">
                  Reserves: {parseFloat(ethers.utils.formatEther(selectedPool.reserveA)).toFixed(4)} / {parseFloat(ethers.utils.formatEther(selectedPool.reserveB)).toFixed(4)}
                </div>
                
                {/* Liquidity Warning */}
                {!hasLiquidity && (
                  <div className="p-3 bg-red-900 bg-opacity-30 border border-red-500 rounded-lg mt-2">
                    <div className="text-red-400 text-sm font-cyber mb-2">
                      ⚠️ Cannot swap - Pool has no liquidity
                    </div>
                    <div className="text-red-300 text-xs">
                      This pool exists but has no tokens deposited. Add liquidity first to enable swapping.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-laser-orange text-sm font-cyber">
                ⚠️ No pool exists for this token pair
              </div>
            )}
          </div>
        )}

        {/* Same token warning */}
        {isValidAddress(fromTokenAddress) && isValidAddress(toTokenAddress) && 
         fromTokenAddress.toLowerCase() === toTokenAddress.toLowerCase() && (
          <div className="mb-4 p-3 border border-red-500 rounded-lg">
            <div className="text-red-400 text-sm font-cyber">
              ❌ Cannot swap the same token
            </div>
          </div>
        )}

        {/* Swap Details */}
        {canSwap() && swapRate && (
          <div className="mb-4 p-3 bg-gray-900 rounded-lg">
            <div className="text-gray-400 font-cyber text-xs mb-2">Swap Details:</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Exchange Rate:</span>
                <span className="text-cyber-blue">1 {fromTokenInfo?.symbol} = {swapRate?.toFixed(6)} {toTokenInfo?.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Price Impact:</span>
                <span className={`${priceImpact > 5 ? 'text-red-400' : priceImpact > 2 ? 'text-laser-orange' : 'text-neon-green'}`}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trading Fee:</span>
                <span className="text-gray-300">0.3%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Min. Received:</span>
                <span className="text-gray-300">{(parseFloat(toAmount) * 0.95).toFixed(6)} {toTokenInfo?.symbol}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Create Pool Button */}
          {isValidTokenPair() && !poolExists && !checkingPool && (
            <button
              onClick={createPool}
              disabled={loading || !account}
              className="w-full py-3 bg-electric-purple text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-electric-purple disabled:opacity-50"
            >
              {loading ? 'Creating Pool...' : 'Create Pool'}
            </button>
          )}

          {/* Add Liquidity Button (prioritized when no liquidity) */}
          {poolExists && !hasLiquidity && (
            <button
              onClick={navigateToLiquidity}
              className="w-full py-3 bg-electric-purple text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-electric-purple"
            >
              Add Liquidity to Enable Swapping
            </button>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!account || loading || !canSwap() || 
                     fromTokenAddress.toLowerCase() === toTokenAddress.toLowerCase()}
            className="w-full py-3 bg-neon-green text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-neon-green disabled:opacity-50"
          >
            {loading ? 'Swapping...' : 
             fromTokenAddress.toLowerCase() === toTokenAddress.toLowerCase() ? 'Select Different Tokens' :
             !poolExists ? 'Create Pool First' :
             !hasLiquidity ? 'Add Liquidity First' :
             !fromAmount ? 'Enter Amount' : 
             !isValidTokenPair() ? 'Invalid Token Addresses' :
             'Swap Tokens'}
          </button>

          {/* Secondary Add Liquidity Button */}
          {poolExists && hasLiquidity && (
            <button
              onClick={navigateToLiquidity}
              className="w-full py-2 bg-electric-purple text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all border border-electric-purple text-sm"
            >
              Add More Liquidity
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gray-900 rounded-lg">
          <h4 className="text-cyber-blue font-cyber text-sm mb-2">How to swap:</h4>
          <ul className="text-gray-400 text-xs space-y-1">
            <li>1. Enter the token addresses you want to trade</li>
            <li>2. If no pool exists, create one first</li>
            <li>3. If pool has no liquidity, add liquidity first</li>
            <li>4. Enter the amount you want to swap</li>
            <li>5. Review the details and confirm the swap</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SwapInterface;
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
  const [loading, setLoading] = useState(false);
  const [checkingPool, setCheckingPool] = useState(false);

  // Check URL parameters for pre-filled token addresses
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenA = urlParams.get('tokenA');
    const tokenB = urlParams.get('tokenB');
    
    if (tokenA && isValidAddress(tokenA)) {
      setFromTokenAddress(tokenA);
    }
    if (tokenB && isValidAddress(tokenB)) {
      setToTokenAddress(tokenB);
    }
  }, [isValidAddress]);

  // Check for pool when both tokens are entered
  useEffect(() => {
    if (isValidAddress(fromTokenAddress) && isValidAddress(toTokenAddress) && 
        fromTokenAddress.toLowerCase() !== toTokenAddress.toLowerCase() && DeLexContract) {
      checkForPool();
    } else {
      setSelectedPool(null);
      setPoolExists(false);
      setToAmount('');
    }
  }, [fromTokenAddress, toTokenAddress, DeLexContract]);

  // Calculate output when amount changes
  useEffect(() => {
    if (fromAmount && selectedPool && DeLexContract) {
      calculateOutput();
    } else {
      setToAmount('');
    }
  }, [fromAmount, selectedPool]);

  const checkForPool = async () => {
    try {
      setCheckingPool(true);
      const poolIds = await DeLexContract.getAllPools();
      
      for (const poolId of poolIds) {
        const pool = await DeLexContract.getPoolInfo(poolId);
        
        // Check if this pool matches our token pair
        if ((pool.tokenA.toLowerCase() === fromTokenAddress.toLowerCase() && 
             pool.tokenB.toLowerCase() === toTokenAddress.toLowerCase()) ||
            (pool.tokenA.toLowerCase() === toTokenAddress.toLowerCase() && 
             pool.tokenB.toLowerCase() === fromTokenAddress.toLowerCase())) {
          
          setSelectedPool({ id: poolId, ...pool });
          setPoolExists(true);
          return;
        }
      }
      
      // No pool found
      setSelectedPool(null);
      setPoolExists(false);
      setToAmount('');
    } catch (error) {
      console.error('Error checking for pool:', error);
      setSelectedPool(null);
      setPoolExists(false);
    } finally {
      setCheckingPool(false);
    }
  };

  const calculateOutput = async () => {
    if (!selectedPool || !fromAmount || !isValidAddress(fromTokenAddress)) {
      setToAmount('');
      return;
    }
    
    try {
      const fromTokenInfo = await fetchTokenInfo(fromTokenAddress);
      const amountIn = ethers.utils.parseUnits(fromAmount, fromTokenInfo.decimals);
      
      const isTokenA = selectedPool.tokenA.toLowerCase() === fromTokenAddress.toLowerCase();
      const reserveIn = isTokenA ? selectedPool.reserveA : selectedPool.reserveB;
      const reserveOut = isTokenA ? selectedPool.reserveB : selectedPool.reserveA;
      
      if (reserveIn.eq(0) || reserveOut.eq(0)) {
        setToAmount('0');
        return;
      }
      
      const amountOut = await DeLexContract.getAmountOut(amountIn, reserveIn, reserveOut);
      
      // Get the output token info to format with correct decimals
      const toTokenInfo = await fetchTokenInfo(toTokenAddress);
      const formattedOutput = ethers.utils.formatUnits(amountOut, toTokenInfo.decimals);
      setToAmount(parseFloat(formattedOutput).toFixed(6));
    } catch (error) {
      console.error('Error calculating output:', error);
      setToAmount('0');
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
        toast.error('Failed to create pool: ' + error.message);
      }
      console.error('Create pool error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!account || !DeLexContract || !selectedPool || !fromAmount || 
        !isValidAddress(fromTokenAddress) || !isValidAddress(toTokenAddress)) {
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
      toast.error('Swap failed: ' + error.message);
      console.error('Swap error:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTokens = () => {
    setFromTokenAddress(toTokenAddress);
    setToTokenAddress(fromTokenAddress);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const navigateToLiquidity = () => {
    if (isValidAddress(fromTokenAddress) && isValidAddress(toTokenAddress)) {
      window.location.href = `/liquidity?tokenA=${fromTokenAddress}&tokenB=${toTokenAddress}`;
    } else {
      window.location.href = '/liquidity';
    }
  };

  if (!contractsReady) {
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

  return (
    <div className="max-w-md mx-auto">
      <div className="cyber-card border-cyber-blue rounded-xl p-6 pencil-effect">
        <h2 className="text-2xl font-cyber text-neon-green mb-6 text-center animate-glow">
          Token Swap
        </h2>
        
        {/* From Token */}
        <div className="mb-4">
          <TokenInput
            label="From"
            tokenAddress={fromTokenAddress}
            onTokenChange={setFromTokenAddress}
            amount={fromAmount}
            onAmountChange={setFromAmount}
            placeholder="Enter token address to swap from"
          />
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
          <TokenInput
            label="To"
            tokenAddress={toTokenAddress}
            onTokenChange={setToTokenAddress}
            amount={toAmount}
            readOnly={true}
            placeholder="Enter token address to swap to"
            amountPlaceholder="Output amount"
          />
        </div>

        {/* Pool Status */}
        {isValidAddress(fromTokenAddress) && isValidAddress(toTokenAddress) && 
         fromTokenAddress.toLowerCase() !== toTokenAddress.toLowerCase() && (
          <div className="mb-4 p-4 border rounded-lg">
            {checkingPool ? (
              <div className="text-electric-purple text-sm font-cyber animate-pulse">
                🔍 Checking for pool...
              </div>
            ) : poolExists ? (
              <div className="space-y-2">
                <div className="text-neon-green text-sm font-cyber">
                  ✅ Pool exists for this token pair
                </div>
                <div className="text-gray-300 text-xs">
                  Reserves: {parseFloat(ethers.utils.formatEther(selectedPool.reserveA)).toFixed(2)} / {parseFloat(ethers.utils.formatEther(selectedPool.reserveB)).toFixed(2)}
                </div>
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
        {poolExists && fromAmount && toAmount && parseFloat(toAmount) > 0 && (
          <div className="mb-4 p-3 bg-gray-900 rounded-lg">
            <div className="text-gray-400 font-cyber text-xs mb-2">Swap Details:</div>
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
                <span className="text-gray-300">{(parseFloat(toAmount) * 0.95).toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Create Pool Button */}
          {isValidAddress(fromTokenAddress) && isValidAddress(toTokenAddress) && 
           fromTokenAddress.toLowerCase() !== toTokenAddress.toLowerCase() && 
           !poolExists && !checkingPool && (
            <button
              onClick={createPool}
              disabled={loading || !account}
              className="w-full py-3 bg-electric-purple text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-electric-purple disabled:opacity-50"
            >
              {loading ? 'Creating Pool...' : 'Create Pool'}
            </button>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!account || loading || !fromAmount || !poolExists || 
                     !isValidAddress(fromTokenAddress) || !isValidAddress(toTokenAddress) ||
                     fromTokenAddress.toLowerCase() === toTokenAddress.toLowerCase()}
            className="w-full py-3 bg-neon-green text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-neon-green disabled:opacity-50"
          >
            {loading ? 'Swapping...' : 
             fromTokenAddress.toLowerCase() === toTokenAddress.toLowerCase() ? 'Select Different Tokens' :
             !poolExists ? 'Create Pool First' :
             !fromAmount ? 'Enter Amount' : 
             !isValidAddress(fromTokenAddress) || !isValidAddress(toTokenAddress) ? 'Invalid Token Address' :
             'Swap Tokens'}
          </button>

          {/* Add Liquidity Button */}
          {poolExists && (
            <button
              onClick={navigateToLiquidity}
              className="w-full py-2 bg-electric-purple text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all border border-electric-purple"
            >
              Add Liquidity to Pool
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gray-900 rounded-lg">
          <h4 className="text-cyber-blue font-cyber text-sm mb-2">How to swap:</h4>
          <ul className="text-gray-400 text-xs space-y-1">
            <li>1. Enter the token addresses you want to trade</li>
            <li>2. If no pool exists, create one first</li>
            <li>3. Enter the amount you want to swap</li>
            <li>4. Review the details and confirm the swap</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SwapInterface;
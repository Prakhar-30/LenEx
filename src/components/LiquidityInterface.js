import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import { useToken } from '../hooks/useToken';
import TokenInput from './TokenInput';
import toast from 'react-hot-toast';

const LiquidityInterface = () => {
  const { account, signer } = useWallet();
  const { DeLexContract } = useContract(signer);
  const { fetchTokenInfo, getTokenBalance, approveToken, getTokenAllowance, isValidAddress } = useToken(signer);
  
  const [tokenAAddress, setTokenAAddress] = useState('');
  const [tokenBAddress, setTokenBAddress] = useState('');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [pools, setPools] = useState([]);
  const [userPools, setUserPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('add'); // 'add' or 'remove'

  useEffect(() => {
    if (DeLexContract && account) {
      loadData();
    }
  }, [DeLexContract, account]);

  // Check URL parameters for pre-filled token addresses
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenA = urlParams.get('tokenA');
    const tokenB = urlParams.get('tokenB');
    
    if (tokenA && isValidAddress(tokenA)) {
      setTokenAAddress(tokenA);
    }
    if (tokenB && isValidAddress(tokenB)) {
      setTokenBAddress(tokenB);
    }
  }, [isValidAddress]);

  const loadData = async () => {
    await Promise.all([loadPools(), loadUserPools()]);
  };

  const loadPools = async () => {
    try {
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
    }
  };

  const loadUserPools = async () => {
    try {
      const poolIds = await DeLexContract.getAllPools();
      const userPoolsData = [];
      
      for (const poolId of poolIds) {
        const shares = await DeLexContract.userShares(poolId, account);
        if (shares.gt(0)) {
          const pool = await DeLexContract.getPoolInfo(poolId);
          
          // Get token info for display
          try {
            const [tokenAInfo, tokenBInfo] = await Promise.all([
              fetchTokenInfo(pool.tokenA),
              fetchTokenInfo(pool.tokenB)
            ]);
            
            userPoolsData.push({
              id: poolId,
              shares: ethers.utils.formatEther(shares),
              tokenAInfo,
              tokenBInfo,
              ...pool
            });
          } catch (tokenError) {
            console.error('Error fetching token info for user pool:', tokenError);
            // Still add the pool but without token info
            userPoolsData.push({
              id: poolId,
              shares: ethers.utils.formatEther(shares),
              tokenAInfo: { symbol: 'Unknown', address: pool.tokenA, decimals: 18 },
              tokenBInfo: { symbol: 'Unknown', address: pool.tokenB, decimals: 18 },
              ...pool
            });
          }
        }
      }
      
      setUserPools(userPoolsData);
    } catch (error) {
      console.error('Error loading user pools:', error);
    }
  };

  const createPool = async () => {
    if (!account || !DeLexContract || !isValidAddress(tokenAAddress) || !isValidAddress(tokenBAddress)) {
      toast.error('Please enter valid token addresses');
      return;
    }

    if (tokenAAddress.toLowerCase() === tokenBAddress.toLowerCase()) {
      toast.error('Token addresses must be different');
      return;
    }
    
    try {
      setLoading(true);
      toast.loading('Creating pool...');
      
      const tx = await DeLexContract.createPool(tokenAAddress, tokenBAddress);
      await tx.wait();
      
      toast.dismiss();
      toast.success('Pool created successfully!');
      
      loadPools();
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

  const addLiquidity = async () => {
    if (!account || !DeLexContract || !amountA || !amountB || 
        !isValidAddress(tokenAAddress) || !isValidAddress(tokenBAddress)) {
      toast.error('Please fill all fields with valid data');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get token info for decimals
      const [tokenAInfo, tokenBInfo] = await Promise.all([
        fetchTokenInfo(tokenAAddress),
        fetchTokenInfo(tokenBAddress)
      ]);
      
      const amountAWei = ethers.utils.parseUnits(amountA, tokenAInfo.decimals);
      const amountBWei = ethers.utils.parseUnits(amountB, tokenBInfo.decimals);
      
      // Find pool
      const pool = pools.find(p => 
        (p.tokenA.toLowerCase() === tokenAAddress.toLowerCase() && 
         p.tokenB.toLowerCase() === tokenBAddress.toLowerCase()) ||
        (p.tokenA.toLowerCase() === tokenBAddress.toLowerCase() && 
         p.tokenB.toLowerCase() === tokenAAddress.toLowerCase())
      );
      
      if (!pool) {
        toast.error('Pool does not exist. Create it first.');
        return;
      }
      
      // Check and approve tokens
      const [allowanceA, allowanceB] = await Promise.all([
        getTokenAllowance(tokenAAddress, account, DeLexContract.address),
        getTokenAllowance(tokenBAddress, account, DeLexContract.address)
      ]);
      
      const allowanceAWei = ethers.utils.parseUnits(allowanceA, tokenAInfo.decimals);
      const allowanceBWei = ethers.utils.parseUnits(allowanceB, tokenBInfo.decimals);
      
      if (allowanceAWei.lt(amountAWei)) {
        toast.loading(`Approving ${tokenAInfo.symbol}...`);
        const approveTx = await approveToken(tokenAAddress, DeLexContract.address, amountA);
        await approveTx.wait();
      }
      
      if (allowanceBWei.lt(amountBWei)) {
        toast.loading(`Approving ${tokenBInfo.symbol}...`);
        const approveTx = await approveToken(tokenBAddress, DeLexContract.address, amountB);
        await approveTx.wait();
      }
      
      toast.loading('Adding liquidity...');
      
      // Determine correct order for the pool
      const isTokenAFirst = pool.tokenA.toLowerCase() === tokenAAddress.toLowerCase();
      const finalAmountA = isTokenAFirst ? amountAWei : amountBWei;
      const finalAmountB = isTokenAFirst ? amountBWei : amountAWei;
      
      const tx = await DeLexContract.addLiquidity(pool.id, finalAmountA, finalAmountB);
      await tx.wait();
      
      toast.dismiss();
      toast.success('Liquidity added successfully!');
      
      // Reset form and reload data
      setAmountA('');
      setAmountB('');
      loadData();
      
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to add liquidity: ' + error.message);
      console.error('Add liquidity error:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeLiquidity = async (poolId, shares, tokenAInfo, tokenBInfo) => {
    if (!account || !DeLexContract) return;
    
    try {
      setLoading(true);
      toast.loading('Removing liquidity...');
      
      const sharesWei = ethers.utils.parseEther(shares);
      const tx = await DeLexContract.removeLiquidity(poolId, sharesWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success(`Liquidity removed from ${tokenAInfo.symbol}/${tokenBInfo.symbol} pool!`);
      
      loadData();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to remove liquidity: ' + error.message);
      console.error('Remove liquidity error:', error);
    } finally {
      setLoading(false);
    }
  };

  const poolExists = () => {
    if (!isValidAddress(tokenAAddress) || !isValidAddress(tokenBAddress)) return false;
    
    return pools.some(p => 
      (p.tokenA.toLowerCase() === tokenAAddress.toLowerCase() && 
       p.tokenB.toLowerCase() === tokenBAddress.toLowerCase()) ||
      (p.tokenA.toLowerCase() === tokenBAddress.toLowerCase() && 
       p.tokenB.toLowerCase() === tokenAAddress.toLowerCase())
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex mb-6">
        <button
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-3 font-cyber text-lg rounded-l-lg transition-all ${
            activeTab === 'add'
              ? 'bg-neon-green text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Add Liquidity
        </button>
        <button
          onClick={() => setActiveTab('remove')}
          className={`flex-1 py-3 font-cyber text-lg rounded-r-lg transition-all ${
            activeTab === 'remove'
              ? 'bg-hot-pink text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Your Positions ({userPools.length})
        </button>
      </div>

      {activeTab === 'add' ? (
        <div className="cyber-card border-cyber-blue rounded-xl p-6 pencil-effect">
          <h2 className="text-2xl font-cyber text-neon-green mb-6 text-center animate-glow">
            Add Liquidity
          </h2>

          {/* Token A Input */}
          <div className="mb-4">
            <TokenInput
              label="Token A"
              tokenAddress={tokenAAddress}
              onTokenChange={setTokenAAddress}
              amount={amountA}
              onAmountChange={setAmountA}
              placeholder="Enter first token address"
            />
          </div>

          {/* Token B Input */}
          <div className="mb-6">
            <TokenInput
              label="Token B"
              tokenAddress={tokenBAddress}
              onTokenChange={setTokenBAddress}
              amount={amountB}
              onAmountChange={setAmountB}
              placeholder="Enter second token address"
            />
          </div>

          {/* Pool Status */}
          {isValidAddress(tokenAAddress) && isValidAddress(tokenBAddress) && tokenAAddress !== tokenBAddress && (
            <div className="mb-4 p-3 border rounded-lg">
              {poolExists() ? (
                <div className="text-neon-green text-sm font-cyber">
                  ✅ Pool exists for this token pair
                </div>
              ) : (
                <div className="text-laser-orange text-sm font-cyber">
                  ⚠️ Pool does not exist - you can create it first
                </div>
              )}
            </div>
          )}

          {/* Same token warning */}
          {isValidAddress(tokenAAddress) && isValidAddress(tokenBAddress) && 
           tokenAAddress.toLowerCase() === tokenBAddress.toLowerCase() && (
            <div className="mb-4 p-3 border border-red-500 rounded-lg">
              <div className="text-red-400 text-sm font-cyber">
                ❌ Cannot create pool with the same token
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {!poolExists() && isValidAddress(tokenAAddress) && isValidAddress(tokenBAddress) && 
             tokenAAddress.toLowerCase() !== tokenBAddress.toLowerCase() && (
              <button
                onClick={createPool}
                disabled={loading || !account}
                className="w-full py-3 bg-electric-purple text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-electric-purple disabled:opacity-50"
              >
                {loading ? 'Creating Pool...' : 'Create Pool'}
              </button>
            )}
            
            <button
              onClick={addLiquidity}
              disabled={loading || !account || !amountA || !amountB || !poolExists() || 
                       tokenAAddress.toLowerCase() === tokenBAddress.toLowerCase()}
              className="w-full py-3 bg-neon-green text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-neon-green disabled:opacity-50"
            >
              {loading ? 'Adding Liquidity...' : 
               tokenAAddress.toLowerCase() === tokenBAddress.toLowerCase() ? 'Select Different Tokens' :
               !poolExists() ? 'Create Pool First' : 'Add Liquidity'}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-gray-900 rounded-lg">
            <h4 className="text-cyber-blue font-cyber text-sm mb-2">Instructions:</h4>
            <ul className="text-gray-400 text-xs space-y-1">
              <li>1. Enter the addresses of both tokens you want to provide liquidity for</li>
              <li>2. If no pool exists, create one first</li>
              <li>3. Enter the amounts of each token to add</li>
              <li>4. Approve token spending and add liquidity</li>
              <li>5. You'll receive LP tokens representing your share</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {userPools.length === 0 ? (
            <div className="cyber-card border-gray-600 rounded-xl p-6 text-center">
              <p className="text-gray-400 font-cyber">No liquidity positions found.</p>
              <p className="text-gray-500 text-sm mt-2">
                Add liquidity to pools to see your positions here.
              </p>
            </div>
          ) : (
            userPools.map((pool) => (
              <div key={pool.id} className="cyber-card border-hot-pink rounded-xl p-6 pencil-effect">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-hot-pink font-cyber text-lg">
                      {pool.tokenAInfo.symbol} / {pool.tokenBInfo.symbol}
                    </h3>
                    <div className="text-gray-400 text-sm space-y-1">
                      <div>Your Shares: {parseFloat(pool.shares).toFixed(6)}</div>
                      <div>Pool ID: {pool.id.slice(0, 12)}...</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeLiquidity(pool.id, pool.shares, pool.tokenAInfo, pool.tokenBInfo)}
                    disabled={loading}
                    className="px-4 py-2 bg-laser-orange text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all neon-border border-laser-orange disabled:opacity-50"
                  >
                    Remove All
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Total Pool Liquidity:</span>
                    <div className="text-white">{ethers.utils.formatEther(pool.totalLiquidity)}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Pool Reserves:</span>
                    <div className="text-white">
                      {ethers.utils.formatUnits(pool.reserveA, pool.tokenAInfo.decimals || 18)} {pool.tokenAInfo.symbol}
                    </div>
                    <div className="text-white">
                      {ethers.utils.formatUnits(pool.reserveB, pool.tokenBInfo.decimals || 18)} {pool.tokenBInfo.symbol}
                    </div>
                  </div>
                </div>

                {/* Token Addresses */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <details className="text-xs">
                    <summary className="text-gray-400 cursor-pointer hover:text-cyber-blue">
                      Token Addresses
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <span className="text-gray-400">{pool.tokenAInfo.symbol}:</span>
                        <div className="text-cyber-blue font-mono break-all">{pool.tokenA}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">{pool.tokenBInfo.symbol}:</span>
                        <div className="text-cyber-blue font-mono break-all">{pool.tokenB}</div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LiquidityInterface;
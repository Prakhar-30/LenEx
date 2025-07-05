import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import { useToken } from '../hooks/useToken';
import TokenInput from './TokenInput';
import toast from 'react-hot-toast';

const LiquidityInterface = () => {
  const { account, signer } = useWallet();
  const { DeLexContract, contractsReady } = useContract(signer);
  const { fetchTokenInfo, getTokenBalance, approveToken, getTokenAllowance, isValidAddress } = useToken(signer);
  
  const [tokenAAddress, setTokenAAddress] = useState('');
  const [tokenBAddress, setTokenBAddress] = useState('');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [pools, setPools] = useState([]);
  const [userPools, setUserPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('add');
  const [tokenAInfo, setTokenAInfo] = useState(null);
  const [tokenBInfo, setTokenBInfo] = useState(null);
  const [poolExists, setPoolExists] = useState(false);
  const [checkingPool, setCheckingPool] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);

  // Process URL parameters only once when component mounts
  useEffect(() => {
    if (!urlParamsProcessed) {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenA = urlParams.get('tokenA');
      const tokenB = urlParams.get('tokenB');
      
      console.log('Processing URL params:', { tokenA, tokenB });
      
      if (tokenA && ethers.utils.isAddress(tokenA)) {
        setTokenAAddress(tokenA);
        console.log('Set tokenA from URL:', tokenA);
      }
      if (tokenB && ethers.utils.isAddress(tokenB)) {
        setTokenBAddress(tokenB);
        console.log('Set tokenB from URL:', tokenB);
      }
      
      setUrlParamsProcessed(true);
    }
  }, [urlParamsProcessed]);

  // FIXED: Initialize component when contracts are ready (don't wait for account)
  useEffect(() => {
    if (contractsReady && signer && !initialized) {
      console.log('Initializing liquidity interface...');
      setInitialized(true);
      // Only load data if we have an account
      if (account) {
        loadData();
      }
    }
  }, [contractsReady, signer, account, initialized]);

  // FIXED: Handle account changes after initialization
  useEffect(() => {
    if (initialized && account && DeLexContract) {
      console.log('Account connected after initialization, loading data...');
      loadData();
    }
  }, [initialized, account, DeLexContract]);

  // Load token info when addresses change (but only after initialization)
  useEffect(() => {
    if (initialized && tokenAAddress && ethers.utils.isAddress(tokenAAddress)) {
      loadTokenAInfo();
    } else {
      setTokenAInfo(null);
    }
  }, [tokenAAddress, signer, initialized]);

  useEffect(() => {
    if (initialized && tokenBAddress && ethers.utils.isAddress(tokenBAddress)) {
      loadTokenBInfo();
    } else {
      setTokenBInfo(null);
    }
  }, [tokenBAddress, signer, initialized]);

  // Check for pool when both tokens are loaded (but only after initialization)
  useEffect(() => {
    if (initialized && tokenAInfo && tokenBInfo && 
        tokenAAddress.toLowerCase() !== tokenBAddress.toLowerCase() && 
        DeLexContract && contractsReady) {
      checkForPool();
    } else {
      setPoolExists(false);
    }
  }, [tokenAInfo, tokenBInfo, tokenAAddress, tokenBAddress, DeLexContract, contractsReady, initialized]);

  const loadTokenAInfo = async () => {
    if (!signer || !tokenAAddress || !initialized) return;
    
    try {
      console.log('Loading token A info for:', tokenAAddress);
      const info = await fetchTokenInfo(tokenAAddress);
      setTokenAInfo(info);
      console.log('Token A info loaded:', info);
    } catch (error) {
      console.error('Error loading token A info:', error);
      setTokenAInfo(null);
    }
  };

  const loadTokenBInfo = async () => {
    if (!signer || !tokenBAddress || !initialized) return;
    
    try {
      console.log('Loading token B info for:', tokenBAddress);
      const info = await fetchTokenInfo(tokenBAddress);
      setTokenBInfo(info);
      console.log('Token B info loaded:', info);
    } catch (error) {
      console.error('Error loading token B info:', error);
      setTokenBInfo(null);
    }
  };

  const checkForPool = async () => {
    if (!DeLexContract || !tokenAAddress || !tokenBAddress || !initialized) return;
    
    try {
      setCheckingPool(true);
      console.log('Checking for pool between:', tokenAAddress, 'and', tokenBAddress);
      
      // Generate pool ID the same way the contract does
      const token0 = tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase() ? tokenAAddress : tokenBAddress;
      const token1 = tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase() ? tokenBAddress : tokenAAddress;
      
      const poolId = ethers.utils.keccak256(
        ethers.utils.solidityPack(['address', 'address'], [token0, token1])
      );
      
      console.log('Generated pool ID:', poolId);
      
      // Check if pool exists
      const poolInfo = await DeLexContract.getPoolInfo(poolId);
      console.log('Pool info from contract:', poolInfo);
      
      if (poolInfo.exists) {
        setPoolExists(true);
        console.log('Pool exists!');
      } else {
        setPoolExists(false);
        console.log('Pool does not exist');
      }
    } catch (error) {
      console.error('Error checking for pool:', error);
      setPoolExists(false);
    } finally {
      setCheckingPool(false);
    }
  };

  const loadData = async () => {
    if (!DeLexContract || !initialized) return;
    
    try {
      console.log('Loading pools and user data...');
      await Promise.all([loadPools(), loadUserPools()]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadPools = async () => {
    if (!DeLexContract || !initialized) return;
    
    try {
      console.log('Loading pools...');
      const poolIds = await DeLexContract.getAllPools();
      console.log('Pool IDs:', poolIds);
      
      const poolsData = await Promise.all(
        poolIds.map(async (poolId) => {
          try {
            const pool = await DeLexContract.getPoolInfo(poolId);
            console.log('Pool info for', poolId, ':', pool);
            return { id: poolId, ...pool };
          } catch (error) {
            console.error('Error loading pool', poolId, ':', error);
            return null;
          }
        })
      );
      
      const validPools = poolsData.filter(pool => pool !== null);
      setPools(validPools);
      console.log('Valid pools loaded:', validPools);
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  const loadUserPools = async () => {
    if (!DeLexContract || !account || !initialized) return;
    
    try {
      console.log('Loading user pools for:', account);
      const poolIds = await DeLexContract.getAllPools();
      const userPoolsData = [];
      
      for (const poolId of poolIds) {
        try {
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
        } catch (error) {
          console.error('Error checking user shares for pool', poolId, ':', error);
        }
      }
      
      setUserPools(userPoolsData);
      console.log('User pools loaded:', userPoolsData);
    } catch (error) {
      console.error('Error loading user pools:', error);
    }
  };

  const createPool = async () => {
    if (!account || !DeLexContract || !ethers.utils.isAddress(tokenAAddress) || !ethers.utils.isAddress(tokenBAddress)) {
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
      
      console.log('Creating pool with tokens:', tokenAAddress, tokenBAddress);
      
      const tx = await DeLexContract.createPool(tokenAAddress, tokenBAddress);
      console.log('Create pool transaction:', tx.hash);
      
      await tx.wait();
      
      toast.dismiss();
      toast.success('Pool created successfully!');
      
      // Reload data and check for the new pool
      await loadData();
      await checkForPool();
    } catch (error) {
      toast.dismiss();
      console.error('Create pool error:', error);
      
      if (error.message.includes('Pool exists')) {
        toast.error('Pool already exists for this token pair');
      } else if (error.message.includes('Identical tokens')) {
        toast.error('Cannot create pool with identical tokens');
      } else if (error.message.includes('Zero address')) {
        toast.error('Invalid token addresses');
      } else {
        toast.error('Failed to create pool: ' + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const addLiquidity = async () => {
    if (!account || !DeLexContract || !amountA || !amountB || 
        !ethers.utils.isAddress(tokenAAddress) || !ethers.utils.isAddress(tokenBAddress) ||
        !tokenAInfo || !tokenBInfo) {
      toast.error('Please fill all fields with valid data');
      return;
    }

    if (!poolExists) {
      toast.error('Pool does not exist. Create it first.');
      return;
    }
    
    try {
      setLoading(true);
      
      const amountAWei = ethers.utils.parseUnits(amountA, tokenAInfo.decimals);
      const amountBWei = ethers.utils.parseUnits(amountB, tokenBInfo.decimals);
      
      console.log('Adding liquidity:', {
        tokenA: tokenAAddress,
        tokenB: tokenBAddress,
        amountA: amountA,
        amountB: amountB,
        amountAWei: amountAWei.toString(),
        amountBWei: amountBWei.toString()
      });
      
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
        toast.dismiss();
      }
      
      if (allowanceBWei.lt(amountBWei)) {
        toast.loading(`Approving ${tokenBInfo.symbol}...`);
        const approveTx = await approveToken(tokenBAddress, DeLexContract.address, amountB);
        await approveTx.wait();
        toast.dismiss();
      }
      
      toast.loading('Adding liquidity...');
      
      // Generate pool ID for the transaction
      const token0 = tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase() ? tokenAAddress : tokenBAddress;
      const token1 = tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase() ? tokenBAddress : tokenAAddress;
      
      const poolId = ethers.utils.keccak256(
        ethers.utils.solidityPack(['address', 'address'], [token0, token1])
      );
      
      // Determine correct order for the pool (contract expects tokenA < tokenB)
      const finalAmountA = tokenAAddress.toLowerCase() === token0.toLowerCase() ? amountAWei : amountBWei;
      const finalAmountB = tokenAAddress.toLowerCase() === token0.toLowerCase() ? amountBWei : amountAWei;
      
      console.log('Pool ID for transaction:', poolId);
      console.log('Final amounts:', {
        finalAmountA: finalAmountA.toString(),
        finalAmountB: finalAmountB.toString()
      });
      
      const tx = await DeLexContract.addLiquidity(poolId, finalAmountA, finalAmountB);
      console.log('Add liquidity transaction:', tx.hash);
      
      await tx.wait();
      
      toast.dismiss();
      toast.success('Liquidity added successfully!');
      
      // Reset form and reload data
      setAmountA('');
      setAmountB('');
      await loadData();
      
    } catch (error) {
      toast.dismiss();
      console.error('Add liquidity error:', error);
      
      if (error.message.includes('Insufficient liquidity')) {
        toast.error('Insufficient liquidity shares calculated');
      } else if (error.message.includes('ERC20InsufficientBalance')) {
        toast.error('Insufficient token balance');
      } else if (error.message.includes('ERC20InsufficientAllowance')) {
        toast.error('Token approval failed');
      } else if (error.message.includes("Pool doesn't exist")) {
        toast.error('Pool does not exist');
      } else {
        toast.error('Failed to add liquidity: ' + (error.reason || error.message));
      }
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
      
      await loadData();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to remove liquidity: ' + (error.reason || error.message));
      console.error('Remove liquidity error:', error);
    } finally {
      setLoading(false);
    }
  };

  const isValidTokenPair = () => {
    return ethers.utils.isAddress(tokenAAddress) && 
           ethers.utils.isAddress(tokenBAddress) && 
           tokenAAddress.toLowerCase() !== tokenBAddress.toLowerCase() &&
           tokenAInfo && tokenBInfo;
  };

  // FIXED: Only check for contracts and signer, not account
  if (!contractsReady || !signer) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center items-center py-12">
          <div className="text-electric-purple font-cyber text-lg animate-pulse">
            Initializing contracts...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Show wallet connection prompt inside component if needed */}
      {!account && (
        <div className="mb-6">
          <div className="cyber-card border-laser-orange rounded-xl p-6 text-center">
            <div className="text-laser-orange font-cyber text-lg mb-4">
              Wallet Not Connected
            </div>
            <p className="text-gray-400">Please connect your wallet to access liquidity features</p>
          </div>
        </div>
      )}

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
            <label className="text-gray-300 font-cyber mb-2 block">Token A Address:</label>
            <input
              type="text"
              value={tokenAAddress}
              onChange={(e) => setTokenAAddress(e.target.value)}
              placeholder="Enter first token address"
              className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm mb-2"
            />
            
            {/* Token A Info Display */}
            {tokenAAddress && ethers.utils.isAddress(tokenAAddress) && (
              <div className="mb-2">
                {tokenAInfo ? (
                  <div className="flex items-center justify-between bg-gray-900 rounded-lg p-2">
                    <div className="text-neon-green text-sm font-cyber">
                      {tokenAInfo.name} ({tokenAInfo.symbol})
                    </div>
                    <div className="text-gray-400 text-xs">
                      Decimals: {tokenAInfo.decimals}
                    </div>
                  </div>
                ) : (
                  <div className="text-electric-purple text-xs">Loading token info...</div>
                )}
              </div>
            )}
            
            {tokenAInfo && (
              <input
                type="number"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm"
              />
            )}
          </div>

          {/* Token B Input */}
          <div className="mb-6">
            <label className="text-gray-300 font-cyber mb-2 block">Token B Address:</label>
            <input
              type="text"
              value={tokenBAddress}
              onChange={(e) => setTokenBAddress(e.target.value)}
              placeholder="Enter second token address"
              className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm mb-2"
            />
            
            {/* Token B Info Display */}
            {tokenBAddress && ethers.utils.isAddress(tokenBAddress) && (
              <div className="mb-2">
                {tokenBInfo ? (
                  <div className="flex items-center justify-between bg-gray-900 rounded-lg p-2">
                    <div className="text-neon-green text-sm font-cyber">
                      {tokenBInfo.name} ({tokenBInfo.symbol})
                    </div>
                    <div className="text-gray-400 text-xs">
                      Decimals: {tokenBInfo.decimals}
                    </div>
                  </div>
                ) : (
                  <div className="text-electric-purple text-xs">Loading token info...</div>
                )}
              </div>
            )}
            
            {tokenBInfo && (
              <input
                type="number"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm"
              />
            )}
          </div>

          {/* Pool Status */}
          {isValidTokenPair() && (
            <div className="mb-4 p-3 border rounded-lg">
              {checkingPool ? (
                <div className="text-electric-purple text-sm font-cyber animate-pulse">
                  🔍 Checking for pool...
                </div>
              ) : poolExists ? (
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
          {ethers.utils.isAddress(tokenAAddress) && ethers.utils.isAddress(tokenBAddress) && 
           tokenAAddress.toLowerCase() === tokenBAddress.toLowerCase() && (
            <div className="mb-4 p-3 border border-red-500 rounded-lg">
              <div className="text-red-400 text-sm font-cyber">
                ❌ Cannot create pool with the same token
              </div>
            </div>
          )}

          {/* Invalid address warnings */}
          {tokenAAddress && !ethers.utils.isAddress(tokenAAddress) && (
            <div className="mb-4 p-3 border border-red-500 rounded-lg">
              <div className="text-red-400 text-sm font-cyber">
                ❌ Invalid Token A address
              </div>
            </div>
          )}

          {tokenBAddress && !ethers.utils.isAddress(tokenBAddress) && (
            <div className="mb-4 p-3 border border-red-500 rounded-lg">
              <div className="text-red-400 text-sm font-cyber">
                ❌ Invalid Token B address
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
                {loading ? 'Creating Pool...' : !account ? 'Connect Wallet First' : 'Create Pool'}
              </button>
            )}
            
            {/* Add Liquidity Button */}
            <button
              onClick={addLiquidity}
              disabled={loading || !account || !amountA || !amountB || !poolExists || !isValidTokenPair()}
              className="w-full py-3 bg-neon-green text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-neon-green disabled:opacity-50"
            >
              {loading ? 'Adding Liquidity...' : 
               !account ? 'Connect Wallet First' :
               !isValidTokenPair() ? 'Enter Valid Token Addresses' :
               !poolExists ? 'Create Pool First' :
               !amountA || !amountB ? 'Enter Amounts' : 
               'Add Liquidity'}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-gray-900 rounded-lg">
            <h4 className="text-cyber-blue font-cyber text-sm mb-2">Instructions:</h4>
            <ul className="text-gray-400 text-xs space-y-1">
              <li>1. Connect your wallet if not already connected</li>
              <li>2. Enter the addresses of both tokens you want to provide liquidity for</li>
              <li>3. Wait for token information to load and validate</li>
              <li>4. If no pool exists, create one first</li>
              <li>5. Enter the amounts of each token to add</li>
              <li>6. Approve token spending and add liquidity</li>
              <li>7. You'll receive LP tokens representing your share</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!account ? (
            <div className="cyber-card border-gray-600 rounded-xl p-6 text-center">
              <p className="text-gray-400 font-cyber">Connect your wallet to view your positions.</p>
            </div>
          ) : userPools.length === 0 ? (
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
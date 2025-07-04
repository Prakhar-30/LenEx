import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import { MOCK_TOKENS } from '../contracts/MockToken';
import toast from 'react-hot-toast';

const LiquidityInterface = () => {
  const { account, signer } = useWallet();
  const { DeLexContract, tokenContracts } = useContract(signer);
  
  const [tokenA, setTokenA] = useState('TKNA');
  const [tokenB, setTokenB] = useState('TKNB');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [pools, setPools] = useState([]);
  const [userPools, setUserPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState({});
  const [activeTab, setActiveTab] = useState('add'); // 'add' or 'remove'

  useEffect(() => {
    if (DeLexContract && account) {
      loadData();
    }
  }, [DeLexContract, account]);

  const loadData = async () => {
    await Promise.all([loadPools(), loadBalances(), loadUserPools()]);
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

  const loadBalances = async () => {
    try {
      const newBalances = {};
      for (const [symbol, token] of Object.entries(MOCK_TOKENS)) {
        const balance = await tokenContracts[symbol].balanceOf(account);
        newBalances[symbol] = ethers.utils.formatEther(balance);
      }
      setBalances(newBalances);
    } catch (error) {
      console.error('Error loading balances:', error);
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
          userPoolsData.push({
            id: poolId,
            shares: ethers.utils.formatEther(shares),
            ...pool
          });
        }
      }
      
      setUserPools(userPoolsData);
    } catch (error) {
      console.error('Error loading user pools:', error);
    }
  };

  const createPool = async () => {
    if (!account || !DeLexContract) return;
    
    try {
      setLoading(true);
      toast.loading('Creating pool...');
      
      const tx = await DeLexContract.createPool(
        MOCK_TOKENS[tokenA].address,
        MOCK_TOKENS[tokenB].address
      );
      
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
    if (!account || !DeLexContract || !amountA || !amountB) return;
    
    try {
      setLoading(true);
      
      const amountAWei = ethers.utils.parseEther(amountA);
      const amountBWei = ethers.utils.parseEther(amountB);
      
      // Find pool
      const pool = pools.find(p => 
        (p.tokenA === MOCK_TOKENS[tokenA].address && p.tokenB === MOCK_TOKENS[tokenB].address) ||
        (p.tokenA === MOCK_TOKENS[tokenB].address && p.tokenB === MOCK_TOKENS[tokenA].address)
      );
      
      if (!pool) {
        toast.error('Pool does not exist. Create it first.');
        return;
      }
      
      // Approve tokens
      const tokenAContract = tokenContracts[tokenA];
      const tokenBContract = tokenContracts[tokenB];
      
      const allowanceA = await tokenAContract.allowance(account, DeLexContract.address);
      const allowanceB = await tokenBContract.allowance(account, DeLexContract.address);
      
      if (allowanceA.lt(amountAWei)) {
        toast.loading('Approving token A...');
        const approveTx = await tokenAContract.approve(DeLexContract.address, amountAWei);
        await approveTx.wait();
      }
      
      if (allowanceB.lt(amountBWei)) {
        toast.loading('Approving token B...');
        const approveTx = await tokenBContract.approve(DeLexContract.address, amountBWei);
        await approveTx.wait();
      }
      
      toast.loading('Adding liquidity...');
      const tx = await DeLexContract.addLiquidity(pool.id, amountAWei, amountBWei);
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

  const removeLiquidity = async (poolId, shares) => {
    if (!account || !DeLexContract) return;
    
    try {
      setLoading(true);
      toast.loading('Removing liquidity...');
      
      const sharesWei = ethers.utils.parseEther(shares);
      const tx = await DeLexContract.removeLiquidity(poolId, sharesWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success('Liquidity removed successfully!');
      
      loadData();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to remove liquidity: ' + error.message);
      console.error('Remove liquidity error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTokenSymbol = (address) => {
    return Object.keys(MOCK_TOKENS).find(key => 
      MOCK_TOKENS[key].address === address
    ) || 'Unknown';
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
          Your Positions
        </button>
      </div>

      {activeTab === 'add' ? (
        <div className="cyber-card border-cyber-blue rounded-xl p-6 pencil-effect">
          <h2 className="text-2xl font-cyber text-neon-green mb-6 text-center animate-glow">
            Add Liquidity
          </h2>

          {/* Token A */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 font-cyber">Token A</label>
              <span className="text-gray-400 text-sm">
                Balance: {balances[tokenA] || '0'}
              </span>
            </div>
            <div className="flex space-x-2">
              <select
                value={tokenA}
                onChange={(e) => setTokenA(e.target.value)}
                className="w-20 bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
              >
                {Object.keys(MOCK_TOKENS).map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
              <input
                type="number"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
              />
            </div>
          </div>

          {/* Token B */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 font-cyber">Token B</label>
              <span className="text-gray-400 text-sm">
                Balance: {balances[tokenB] || '0'}
              </span>
            </div>
            <div className="flex space-x-2">
              <select
                value={tokenB}
                onChange={(e) => setTokenB(e.target.value)}
                className="w-20 bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
              >
                {Object.keys(MOCK_TOKENS).map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
              <input
                type="number"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={createPool}
              disabled={loading || !account}
              className="w-full py-3 bg-electric-purple text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-electric-purple disabled:opacity-50"
            >
              Create Pool
            </button>
            
            <button
              onClick={addLiquidity}
              disabled={loading || !account || !amountA || !amountB}
              className="w-full py-3 bg-neon-green text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-neon-green disabled:opacity-50"
            >
              {loading ? 'Adding Liquidity...' : 'Add Liquidity'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {userPools.length === 0 ? (
            <div className="cyber-card border-gray-600 rounded-xl p-6 text-center">
              <p className="text-gray-400 font-cyber">No liquidity positions found.</p>
            </div>
          ) : (
            userPools.map((pool) => (
              <div key={pool.id} className="cyber-card border-hot-pink rounded-xl p-6 pencil-effect">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-hot-pink font-cyber text-lg">
                      {getTokenSymbol(pool.tokenA)} / {getTokenSymbol(pool.tokenB)}
                    </h3>
                    <p className="text-gray-400 text-sm">Your Shares: {pool.shares}</p>
                  </div>
                  <button
                    onClick={() => removeLiquidity(pool.id, pool.shares)}
                    disabled={loading}
                    className="px-4 py-2 bg-laser-orange text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all neon-border border-laser-orange disabled:opacity-50"
                  >
                    Remove All
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Total Liquidity:</span>
                    <div className="text-white">{ethers.utils.formatEther(pool.totalLiquidity)}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Pool Reserves:</span>
                    <div className="text-white">
                      {ethers.utils.formatEther(pool.reserveA)} / {ethers.utils.formatEther(pool.reserveB)}
                    </div>
                  </div>
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
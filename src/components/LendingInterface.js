import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import { MOCK_TOKENS } from '../contracts/MockToken';
import toast from 'react-hot-toast';

const LendingInterface = () => {
  const { account, signer } = useWallet();
  const { DeLexContract, tokenContracts } = useContract(signer);
  
  const [pools, setPools] = useState([]);
  const [userPositions, setUserPositions] = useState([]);
  const [balances, setBalances] = useState({});
  const [selectedPool, setSelectedPool] = useState(null);
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('TKNA');
  const [activeTab, setActiveTab] = useState('deposit'); // 'deposit', 'borrow', 'repay'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (DeLexContract && account) {
      loadData();
    }
  }, [DeLexContract, account]);

  const loadData = async () => {
    await Promise.all([loadPools(), loadBalances(), loadUserPositions()]);
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
      if (poolsData.length > 0) {
        setSelectedPool(poolsData[0]);
      }
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

  const loadUserPositions = async () => {
    try {
      const poolIds = await DeLexContract.getAllPools();
      const positions = [];
      
      for (const poolId of poolIds) {
        const position = await DeLexContract.getUserPosition(account, poolId);
        const pool = await DeLexContract.getPoolInfo(poolId);
        
        if (position.collateralA.gt(0) || position.collateralB.gt(0) || 
            position.borrowedA.gt(0) || position.borrowedB.gt(0)) {
          positions.push({
            poolId,
            pool,
            ...position
          });
        }
      }
      
      setUserPositions(positions);
    } catch (error) {
      console.error('Error loading user positions:', error);
    }
  };

  const depositCollateral = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount) return;
    
    try {
      setLoading(true);
      const amountWei = ethers.utils.parseEther(amount);
      const tokenAddress = MOCK_TOKENS[selectedToken].address;
      
      // Approve token
      const tokenContract = tokenContracts[selectedToken];
      const allowance = await tokenContract.allowance(account, DeLexContract.address);
      
      if (allowance.lt(amountWei)) {
        toast.loading('Approving token...');
        const approveTx = await tokenContract.approve(DeLexContract.address, amountWei);
        await approveTx.wait();
      }
      
      toast.loading('Depositing collateral...');
      const tx = await DeLexContract.depositCollateral(selectedPool.id, tokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success('Collateral deposited successfully!');
      
      setAmount('');
      loadData();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to deposit collateral: ' + error.message);
      console.error('Deposit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const borrowTokens = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount) return;
    
    try {
      setLoading(true);
      const amountWei = ethers.utils.parseEther(amount);
      const tokenAddress = MOCK_TOKENS[selectedToken].address;
      
      toast.loading('Borrowing tokens...');
      const tx = await DeLexContract.borrow(selectedPool.id, tokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success('Tokens borrowed successfully!');
      
      setAmount('');
      loadData();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to borrow tokens: ' + error.message);
      console.error('Borrow error:', error);
    } finally {
      setLoading(false);
    }
  };

  const repayTokens = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount) return;
    
    try {
      setLoading(true);
      const amountWei = ethers.utils.parseEther(amount);
      const tokenAddress = MOCK_TOKENS[selectedToken].address;
      
      // Approve token
      const tokenContract = tokenContracts[selectedToken];
      const allowance = await tokenContract.allowance(account, DeLexContract.address);
      
      if (allowance.lt(amountWei)) {
        toast.loading('Approving token...');
        const approveTx = await tokenContract.approve(DeLexContract.address, amountWei);
        await approveTx.wait();
      }
      
      toast.loading('Repaying tokens...');
      const tx = await DeLexContract.repay(selectedPool.id, tokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success('Tokens repaid successfully!');
      
      setAmount('');
      loadData();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to repay tokens: ' + error.message);
      console.error('Repay error:', error);
    } finally {
      setLoading(false);
    }
  };

  const withdrawCollateral = async (poolId, tokenAddress, amount) => {
    if (!account || !DeLexContract) return;
    
    try {
      setLoading(true);
      const amountWei = ethers.utils.parseEther(amount);
      
      toast.loading('Withdrawing collateral...');
      const tx = await DeLexContract.withdrawCollateral(poolId, tokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success('Collateral withdrawn successfully!');
      
      loadData();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to withdraw collateral: ' + error.message);
      console.error('Withdraw error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTokenSymbol = (address) => {
    return Object.keys(MOCK_TOKENS).find(key => 
      MOCK_TOKENS[key].address === address
    ) || 'Unknown';
  };

  const calculateHealthFactor = (position) => {
    const collateralValue = parseFloat(ethers.utils.formatEther(position.collateralA.add(position.collateralB)));
    const borrowValue = parseFloat(ethers.utils.formatEther(position.borrowedA.add(position.borrowedB)));
    
    if (borrowValue === 0) return 'Safe';
    
    const healthFactor = (collateralValue * 0.75) / borrowValue;
    return healthFactor.toFixed(2);
  };

  const formatAmount = (amount) => {
    const formatted = parseFloat(ethers.utils.formatEther(amount));
    return formatted > 0 ? formatted.toFixed(4) : '0';
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex mb-6">
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 py-3 font-cyber text-lg rounded-l-lg transition-all ${
            activeTab === 'deposit'
              ? 'bg-neon-green text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Deposit Collateral
        </button>
        <button
          onClick={() => setActiveTab('borrow')}
          className={`flex-1 py-3 font-cyber text-lg transition-all ${
            activeTab === 'borrow'
              ? 'bg-electric-purple text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Borrow
        </button>
        <button
          onClick={() => setActiveTab('repay')}
          className={`flex-1 py-3 font-cyber text-lg rounded-r-lg transition-all ${
            activeTab === 'repay'
              ? 'bg-hot-pink text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Repay
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Panel */}
        <div className="cyber-card border-cyber-blue rounded-xl p-6 pencil-effect">
          <h2 className="text-2xl font-cyber text-neon-green mb-6 text-center animate-glow">
            {activeTab === 'deposit' && 'Deposit Collateral'}
            {activeTab === 'borrow' && 'Borrow Tokens'}
            {activeTab === 'repay' && 'Repay Tokens'}
          </h2>

          {/* Pool Selection */}
          <div className="mb-4">
            <label className="text-gray-300 font-cyber mb-2 block">Select Pool:</label>
            <select
              value={selectedPool?.id || ''}
              onChange={(e) => setSelectedPool(pools.find(p => p.id === e.target.value))}
              className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
            >
              {pools.map(pool => (
                <option key={pool.id} value={pool.id}>
                  {getTokenSymbol(pool.tokenA)} / {getTokenSymbol(pool.tokenB)}
                </option>
              ))}
            </select>
          </div>

          {/* Token Selection */}
          <div className="mb-4">
            <label className="text-gray-300 font-cyber mb-2 block">Select Token:</label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
            >
              {Object.keys(MOCK_TOKENS).map(symbol => (
                <option key={symbol} value={symbol}>{symbol}</option>
              ))}
            </select>
            <div className="text-gray-400 text-sm mt-1">
              Balance: {balances[selectedToken] || '0'}
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="text-gray-300 font-cyber mb-2 block">Amount:</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
            />
          </div>

          {/* Action Button */}
          <button
            onClick={() => {
              if (activeTab === 'deposit') depositCollateral();
              else if (activeTab === 'borrow') borrowTokens();
              else if (activeTab === 'repay') repayTokens();
            }}
            disabled={loading || !account || !amount || !selectedPool}
            className={`w-full py-3 font-cyber text-lg rounded-lg transition-all neon-border disabled:opacity-50 ${
              activeTab === 'deposit' ? 'bg-neon-green border-neon-green text-black' :
              activeTab === 'borrow' ? 'bg-electric-purple border-electric-purple text-black' :
              'bg-hot-pink border-hot-pink text-black'
            }`}
          >
            {loading ? 'Processing...' : 
             activeTab === 'deposit' ? 'Deposit Collateral' :
             activeTab === 'borrow' ? 'Borrow Tokens' : 'Repay Tokens'}
          </button>
        </div>

        {/* Positions Panel */}
        <div className="cyber-card border-laser-orange rounded-xl p-6 pencil-effect">
          <h3 className="text-xl font-cyber text-laser-orange mb-4 animate-glow">
            Your Positions
          </h3>
          
          {userPositions.length === 0 ? (
            <p className="text-gray-400 font-cyber text-center">No positions found.</p>
          ) : (
            <div className="space-y-4">
              {userPositions.map((position, index) => (
                <div key={index} className="border border-gray-600 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-white font-cyber">
                        {getTokenSymbol(position.pool.tokenA)} / {getTokenSymbol(position.pool.tokenB)}
                      </h4>
                      <div className="text-sm text-gray-400">
                        Health Factor: {calculateHealthFactor(position)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Collateral - Fixed Colors */}
                  <div className="mb-3">
                    <div className="text-neon-green text-sm font-cyber mb-1">Collateral:</div>
                    {position.collateralA.gt(0) && (
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-neon-green">
                          {getTokenSymbol(position.pool.tokenA)}: {formatAmount(position.collateralA)}
                        </span>
                        <button
                          onClick={() => withdrawCollateral(position.poolId, position.pool.tokenA, formatAmount(position.collateralA))}
                          disabled={loading}
                          className="px-2 py-1 bg-laser-orange text-black rounded text-xs hover:bg-opacity-80 disabled:opacity-50"
                        >
                          Withdraw
                        </button>
                      </div>
                    )}
                    {position.collateralB.gt(0) && (
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-neon-green">
                          {getTokenSymbol(position.pool.tokenB)}: {formatAmount(position.collateralB)}
                        </span>
                        <button
                          onClick={() => withdrawCollateral(position.poolId, position.pool.tokenB, formatAmount(position.collateralB))}
                          disabled={loading}
                          className="px-2 py-1 bg-laser-orange text-black rounded text-xs hover:bg-opacity-80 disabled:opacity-50"
                        >
                          Withdraw
                        </button>
                      </div>
                    )}
                    {position.collateralA.eq(0) && position.collateralB.eq(0) && (
                      <div className="text-gray-500 text-xs">No collateral deposited</div>
                    )}
                  </div>
                  
                  {/* Borrowed - Fixed Colors */}
                  <div>
                    <div className="text-hot-pink text-sm font-cyber mb-1">Borrowed:</div>
                    {position.borrowedA.gt(0) && (
                      <div className="text-xs mb-1">
                        <span className="text-hot-pink">
                          {getTokenSymbol(position.pool.tokenA)}: {formatAmount(position.borrowedA)}
                        </span>
                      </div>
                    )}
                    {position.borrowedB.gt(0) && (
                      <div className="text-xs mb-1">
                        <span className="text-hot-pink">
                          {getTokenSymbol(position.pool.tokenB)}: {formatAmount(position.borrowedB)}
                        </span>
                      </div>
                    )}
                    {position.borrowedA.eq(0) && position.borrowedB.eq(0) && (
                      <div className="text-gray-500 text-xs">No tokens borrowed</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LendingInterface;
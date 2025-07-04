import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import PoolsOverview from '../components/PoolsOverview';
import { ethers } from 'ethers';

const Home = () => {
  const { account, signer } = useWallet();
  const { DeLexContract, contractsReady } = useContract(signer);
  const [stats, setStats] = useState({
    totalPools: 0,
    totalLiquidity: '0',
    totalBorrowed: '0'
  });
  const [showPools, setShowPools] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DeLexContract && contractsReady) {
      loadStats();
    }
  }, [DeLexContract, contractsReady]);

  // Auto-refresh stats every 30 seconds when connected
  useEffect(() => {
    if (DeLexContract && contractsReady) {
      const interval = setInterval(() => {
        loadStats();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [DeLexContract, contractsReady]);

  const loadStats = async () => {
    try {
      setLoading(true);
      console.log('Loading protocol stats...');
      
      const poolIds = await DeLexContract.getAllPools();
      console.log('Found pools:', poolIds.length);
      
      let totalLiquidity = ethers.BigNumber.from(0);
      let totalBorrowed = ethers.BigNumber.from(0);
      
      for (const poolId of poolIds) {
        const pool = await DeLexContract.getPoolInfo(poolId);
        totalLiquidity = totalLiquidity.add(pool.reserveA).add(pool.reserveB);
        totalBorrowed = totalBorrowed.add(pool.totalBorrowedA).add(pool.totalBorrowedB);
      }
      
      const newStats = {
        totalPools: poolIds.length,
        totalLiquidity: parseFloat(ethers.utils.formatEther(totalLiquidity)).toFixed(2),
        totalBorrowed: parseFloat(ethers.utils.formatEther(totalBorrowed)).toFixed(2)
      };
      
      console.log('Updated stats:', newStats);
      setStats(newStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const refreshStats = () => {
    if (DeLexContract && contractsReady) {
      loadStats();
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-6xl md:text-8xl font-cyber font-bold text-neon-green mb-6 animate-glow">
              DeLex Protocol
            </h1>
            <p className="text-xl md:text-2xl text-cyber-blue mb-8 font-cyber">
              Decentralized Lending + Exchange Protocol on BlockDAG
            </p>
            <p className="text-lg text-gray-300 mb-12 max-w-3xl mx-auto">
              Experience the future of DeFi with our unified protocol that combines 
              AMM trading and lending capabilities, powered by BlockDAG's high-performance blockchain.
            </p>
            
            {!account ? (
              <div className="text-electric-purple font-cyber text-lg">
                Connect your wallet to start trading and lending
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/pools"
                  className="px-8 py-4 bg-cyber-blue text-black font-cyber text-xl rounded-lg hover:bg-opacity-80 transition-all neon-border border-cyber-blue"
                >
                  Explore Pools
                </Link>
                <Link
                  to="/swap"
                  className="px-8 py-4 bg-neon-green text-black font-cyber text-xl rounded-lg hover:bg-opacity-80 transition-all neon-border border-neon-green"
                >
                  Start Swapping
                </Link>
                <Link
                  to="/lending"
                  className="px-8 py-4 bg-hot-pink text-black font-cyber text-xl rounded-lg hover:bg-opacity-80 transition-all neon-border border-hot-pink"
                >
                  Start Lending
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-4xl font-cyber text-laser-orange animate-glow">
              Protocol Statistics
            </h2>
            <button
              onClick={refreshStats}
              disabled={loading}
              className="px-4 py-2 bg-laser-orange text-black font-cyber text-sm rounded-lg hover:bg-opacity-80 transition-all disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Refresh Stats'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="cyber-card border-cyber-blue rounded-xl p-6 text-center pencil-effect thin-neon-border">
              <div className="text-3xl font-cyber text-cyber-blue mb-2">
                {stats.totalPools}
              </div>
              <div className="text-gray-300 font-cyber">Active Pools</div>
            </div>
            <div className="cyber-card border-neon-green rounded-xl p-6 text-center pencil-effect thin-neon-border">
              <div className="text-3xl font-cyber text-neon-green mb-2">
                ${stats.totalLiquidity}
              </div>
              <div className="text-gray-300 font-cyber">Total Value Locked</div>
            </div>
            <div className="cyber-card border-hot-pink rounded-xl p-6 text-center pencil-effect thin-neon-border">
              <div className="text-3xl font-cyber text-hot-pink mb-2">
                ${stats.totalBorrowed}
              </div>
              <div className="text-gray-300 font-cyber">Total Borrowed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Pool Overview */}
      {stats.totalPools > 0 && (
        <div className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-4xl font-cyber text-electric-purple animate-glow">
                Available Pools
              </h2>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowPools(!showPools)}
                  className="px-4 py-2 bg-electric-purple text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
                >
                  {showPools ? 'Hide Pools' : 'Show Pools'}
                </button>
                <Link
                  to="/pools"
                  className="px-4 py-2 bg-cyber-blue text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
                >
                  View All Pools
                </Link>
              </div>
            </div>
            
            {showPools ? (
              <PoolsOverview showActions={true} />
            ) : (
              <div className="cyber-card border-gray-600 rounded-xl p-8 text-center">
                <div className="text-gray-400 font-cyber text-lg mb-4">
                  {stats.totalPools} Active Liquidity Pool{stats.totalPools !== 1 ? 's' : ''}
                </div>
                <p className="text-gray-500 mb-6">
                  Click "Show Pools" to view all available trading pairs and their statistics
                </p>
                <button
                  onClick={() => setShowPools(true)}
                  className="px-6 py-3 bg-electric-purple text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
                >
                  Show Pools
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-cyber text-center text-electric-purple mb-12 animate-glow">
            Protocol Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="cyber-card border-neon-green rounded-xl p-6 pencil-effect">
              <h3 className="text-xl font-cyber text-neon-green mb-4">⚡ Lightning Fast Swaps</h3>
              <p className="text-gray-300">
                Execute trades instantly with minimal fees using our optimized AMM on BlockDAG's high-performance network.
              </p>
            </div>
            <div className="cyber-card border-electric-purple rounded-xl p-6 pencil-effect">
              <h3 className="text-xl font-cyber text-electric-purple mb-4">🚀 Provide Liquidity</h3>
              <p className="text-gray-300">
                Earn fees by providing liquidity to trading pairs and help power the decentralized exchange.
              </p>
            </div>
            <div className="cyber-card border-hot-pink rounded-xl p-6 pencil-effect">
              <h3 className="text-xl font-cyber text-hot-pink mb-4">💎 Lending & Borrowing</h3>
              <p className="text-gray-300">
                Use your tokens as collateral to borrow other assets or lend your tokens to earn interest.
              </p>
            </div>
            <div className="cyber-card border-cyber-blue rounded-xl p-6 pencil-effect">
              <h3 className="text-xl font-cyber text-cyber-blue mb-4">🔒 Secure & Audited</h3>
              <p className="text-gray-300">
                Built with security in mind, featuring battle-tested smart contract patterns and comprehensive testing.
              </p>
            </div>
            <div className="cyber-card border-laser-orange rounded-xl p-6 pencil-effect">
              <h3 className="text-xl font-cyber text-laser-orange mb-4">🌐 BlockDAG Powered</h3>
              <p className="text-gray-300">
                Leveraging BlockDAG's innovative DAG structure for superior scalability and transaction throughput.
              </p>
            </div>
            <div className="cyber-card border-neon-green rounded-xl p-6 pencil-effect">
              <h3 className="text-xl font-cyber text-neon-green mb-4">🎮 Pool Analytics</h3>
              <p className="text-gray-300">
                Real-time pool statistics, utilization rates, APY tracking, and comprehensive trading analytics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
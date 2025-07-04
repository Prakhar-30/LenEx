import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import PoolCard from './PoolCard';
import { ethers } from 'ethers';

const PoolsOverview = ({ onPoolSelect, selectedPoolId, showActions = true }) => {
  const { account, signer } = useWallet();
  const { DeLexContract, contractsReady } = useContract(signer);
  
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('tvl'); // 'tvl', 'volume', 'apy'
  const [filterBy, setFilterBy] = useState('all'); // 'all', 'high-liquidity', 'new'

  useEffect(() => {
    if (DeLexContract && contractsReady) {
      loadPools();
    } else if (DeLexContract && !contractsReady) {
      setLoading(true);
    }
  }, [DeLexContract, contractsReady]);

  const loadPools = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading pools...');
      
      const poolIds = await DeLexContract.getAllPools();
      console.log('Pool IDs received:', poolIds);
      
      if (poolIds.length === 0) {
        setPools([]);
        setLoading(false);
        return;
      }
      
      const poolsData = await Promise.all(
        poolIds.map(async (poolId) => {
          try {
            const pool = await DeLexContract.getPoolInfo(poolId);
            console.log('Pool info for', poolId, pool);
            return { id: poolId, ...pool };
          } catch (error) {
            console.error('Error loading pool', poolId, error);
            return null;
          }
        })
      );
      
      // Filter out null pools (failed to load)
      const validPools = poolsData.filter(pool => pool !== null);
      console.log('Valid pools:', validPools);
      
      setPools(validPools);
    } catch (error) {
      console.error('Error loading pools:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTVL = (pool) => {
    const reserveA = parseFloat(ethers.utils.formatEther(pool.reserveA));
    const reserveB = parseFloat(ethers.utils.formatEther(pool.reserveB));
    return reserveA + reserveB;
  };

  const getFilteredAndSortedPools = () => {
    let filteredPools = [...pools];

    // Apply filters
    switch (filterBy) {
      case 'high-liquidity':
        filteredPools = filteredPools.filter(pool => calculateTVL(pool) > 100);
        break;
      case 'new':
        // For now, just show all. In a real app, you'd filter by creation date
        break;
      default:
        // 'all' - no filtering
        break;
    }

    // Apply sorting
    filteredPools.sort((a, b) => {
      switch (sortBy) {
        case 'tvl':
          return calculateTVL(b) - calculateTVL(a);
        case 'apy':
          const apyA = Math.max(
            parseFloat(ethers.utils.formatEther(a.interestRateA)),
            parseFloat(ethers.utils.formatEther(a.interestRateB))
          );
          const apyB = Math.max(
            parseFloat(ethers.utils.formatEther(b.interestRateA)),
            parseFloat(ethers.utils.formatEther(b.interestRateB))
          );
          return apyB - apyA;
        case 'name':
          return a.id.localeCompare(b.id);
        default:
          return 0;
      }
    });

    return filteredPools;
  };

  const getTotalStats = () => {
    const totalTVL = pools.reduce((sum, pool) => sum + calculateTVL(pool), 0);
    const totalBorrowed = pools.reduce((sum, pool) => {
      const borrowedA = parseFloat(ethers.utils.formatEther(pool.totalBorrowedA));
      const borrowedB = parseFloat(ethers.utils.formatEther(pool.totalBorrowedB));
      return sum + borrowedA + borrowedB;
    }, 0);

    return { totalTVL, totalBorrowed, poolCount: pools.length };
  };

  const stats = getTotalStats();
  const displayPools = getFilteredAndSortedPools();

  // Show connection status
  if (!account) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="cyber-card border-laser-orange rounded-xl p-8 text-center">
          <div className="text-laser-orange font-cyber text-lg mb-4">
            Wallet Not Connected
          </div>
          <p className="text-gray-400">Please connect your wallet to view pools</p>
        </div>
      </div>
    );
  }

  if (!contractsReady) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-electric-purple font-cyber text-lg animate-pulse">
          Initializing contracts...
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-neon-green font-cyber text-lg animate-pulse">
          Loading pools...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="cyber-card border-red-500 rounded-xl p-8 text-center">
          <div className="text-red-400 font-cyber text-lg mb-4">
            Error Loading Pools
          </div>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={loadPools}
            className="px-4 py-2 bg-electric-purple text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="cyber-card border-neon-green rounded-xl p-4 text-center thin-neon-border">
          <div className="text-2xl font-cyber text-neon-green mb-1">
            ${stats.totalTVL.toFixed(2)}
          </div>
          <div className="text-gray-400 text-sm">Total Value Locked</div>
        </div>
        <div className="cyber-card border-hot-pink rounded-xl p-4 text-center thin-neon-border">
          <div className="text-2xl font-cyber text-hot-pink mb-1">
            ${stats.totalBorrowed.toFixed(2)}
          </div>
          <div className="text-gray-400 text-sm">Total Borrowed</div>
        </div>
        <div className="cyber-card border-cyber-blue rounded-xl p-4 text-center thin-neon-border">
          <div className="text-2xl font-cyber text-cyber-blue mb-1">
            {stats.poolCount}
          </div>
          <div className="text-gray-400 text-sm">Active Pools</div>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="cyber-card border-gray-500 rounded-xl p-4 thin-neon-border">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm"
            >
              <option value="tvl">Sort by TVL</option>
              <option value="apy">Sort by APY</option>
              <option value="name">Sort by Name</option>
            </select>
            
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm"
            >
              <option value="all">All Pools</option>
              <option value="high-liquidity">High Liquidity</option>
              <option value="new">New Pools</option>
            </select>
          </div>

          <button
            onClick={loadPools}
            className="px-4 py-2 bg-electric-purple text-black font-cyber text-sm rounded-lg hover:bg-opacity-80 transition-all"
          >
            Refresh Pools
          </button>
        </div>
      </div>

      {/* Pools Grid */}
      {displayPools.length === 0 ? (
        <div className="cyber-card border-gray-600 rounded-xl p-12 text-center thin-neon-border">
          <div className="text-gray-400 font-cyber text-lg mb-4">
            No pools found
          </div>
          <p className="text-gray-500 mb-6">
            {pools.length === 0 
              ? "No pools have been created yet. Be the first to create a liquidity pool!"
              : "No pools match your current filter criteria."
            }
          </p>
          {pools.length === 0 && (
            <button
              onClick={() => window.location.href = '/liquidity'}
              className="px-6 py-3 bg-neon-green text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
            >
              Create First Pool
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayPools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              onSelectPool={onPoolSelect}
              isSelected={selectedPoolId === pool.id}
              showActions={showActions}
            />
          ))}
        </div>
      )}

      {/* Create New Pool CTA */}
      {pools.length > 0 && (
        <div className="cyber-card border-electric-purple rounded-xl p-6 text-center thin-neon-border">
          <h3 className="text-xl font-cyber text-electric-purple mb-2">
            Don't see your desired trading pair?
          </h3>
          <p className="text-gray-400 mb-4">
            Create a new liquidity pool and start earning fees from trades
          </p>
          <button
            onClick={() => window.location.href = '/liquidity'}
            className="px-6 py-3 bg-electric-purple text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
          >
            Create New Pool
          </button>
        </div>
      )}
    </div>
  );
};

export default PoolsOverview;
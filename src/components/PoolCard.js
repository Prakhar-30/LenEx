import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useToken } from '../hooks/useToken';
import { useWallet } from '../hooks/useWallet';

const PoolCard = ({ pool, onSelectPool, isSelected = false, showActions = false }) => {
  const { signer } = useWallet();
  const { fetchTokenInfo, isValidAddress } = useToken(signer);
  
  const [tokenAInfo, setTokenAInfo] = useState(null);
  const [tokenBInfo, setTokenBInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pool && isValidAddress(pool.tokenA) && isValidAddress(pool.tokenB)) {
      loadTokenInfo();
    }
  }, [pool, signer]);

  const loadTokenInfo = async () => {
    try {
      setLoading(true);
      const [tokenA, tokenB] = await Promise.all([
        fetchTokenInfo(pool.tokenA),
        fetchTokenInfo(pool.tokenB)
      ]);
      setTokenAInfo(tokenA);
      setTokenBInfo(tokenB);
    } catch (error) {
      console.error('Error loading token info for pool:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount, decimals = 18) => {
    const formatted = parseFloat(ethers.utils.formatUnits(amount, decimals));
    return formatted.toFixed(4);
  };

  const calculateTVL = () => {
    if (!tokenAInfo || !tokenBInfo) return '0.00';
    
    const reserveA = parseFloat(ethers.utils.formatUnits(pool.reserveA, tokenAInfo.decimals));
    const reserveB = parseFloat(ethers.utils.formatUnits(pool.reserveB, tokenBInfo.decimals));
    // Simplified: assuming both tokens have equal value for TVL calculation
    return (reserveA + reserveB).toFixed(2);
  };

  const calculateUtilization = (token) => {
    if (!tokenAInfo || !tokenBInfo) return '0.00';
    
    const isTokenA = token === 'A';
    const tokenInfo = isTokenA ? tokenAInfo : tokenBInfo;
    const reserve = isTokenA ? pool.reserveA : pool.reserveB;
    const borrowed = isTokenA ? pool.totalBorrowedA : pool.totalBorrowedB;
    
    if (reserve.eq(0)) return '0.00';
    
    const utilization = (parseFloat(ethers.utils.formatUnits(borrowed, tokenInfo.decimals)) / 
                        parseFloat(ethers.utils.formatUnits(reserve, tokenInfo.decimals))) * 100;
    return Math.min(utilization, 100).toFixed(2);
  };

  const getAPY = (token) => {
    const isTokenA = token === 'A';
    const rate = isTokenA ? pool.interestRateA : pool.interestRateB;
    return (parseFloat(ethers.utils.formatEther(rate))).toFixed(2);
  };

  const getShortAddress = (address) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getLiquidityStatus = () => {
    if (!tokenAInfo || !tokenBInfo) return 'loading';
    
    const reserveA = parseFloat(ethers.utils.formatUnits(pool.reserveA, tokenAInfo.decimals));
    const reserveB = parseFloat(ethers.utils.formatUnits(pool.reserveB, tokenBInfo.decimals));
    const tvl = reserveA + reserveB;
    
    if (tvl === 0) return 'empty';
    if (tvl < 10) return 'low';
    if (tvl < 100) return 'medium';
    return 'high';
  };

  const getLiquidityStatusColor = () => {
    const status = getLiquidityStatus();
    switch (status) {
      case 'empty': return 'text-red-400';
      case 'low': return 'text-laser-orange';
      case 'medium': return 'text-cyber-blue';
      case 'high': return 'text-neon-green';
      default: return 'text-gray-400';
    }
  };

  const getLiquidityStatusText = () => {
    const status = getLiquidityStatus();
    switch (status) {
      case 'empty': return 'No Liquidity';
      case 'low': return 'Low Liquidity';
      case 'medium': return 'Medium Liquidity';
      case 'high': return 'High Liquidity';
      default: return 'Loading...';
    }
  };

  if (loading) {
    return (
      <div className="cyber-card border-gray-600 rounded-xl p-6 text-center">
        <div className="text-gray-400 font-cyber animate-pulse">
          Loading pool info...
        </div>
      </div>
    );
  }

  if (!tokenAInfo || !tokenBInfo) {
    return (
      <div className="cyber-card border-red-500 rounded-xl p-6 text-center">
        <div className="text-red-400 font-cyber mb-2">
          Error Loading Pool
        </div>
        <div className="text-gray-400 text-xs">
          Could not load token information
        </div>
      </div>
    );
  }

  return (
    <div className={`cyber-card rounded-xl p-6 pencil-effect transition-all ${
      onSelectPool ? 'hover:scale-105 cursor-pointer' : ''
    } thin-neon-border ${
      isSelected 
        ? 'border-neon-green border-2 bg-opacity-90' 
        : 'border-cyber-blue hover:border-electric-purple'
    }`}
    onClick={() => onSelectPool && onSelectPool(pool)}
    >
      {/* Pool Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-cyber text-white mb-1">
            {tokenAInfo.symbol} / {tokenBInfo.symbol}
          </h3>
          <div className="text-xs text-gray-400 space-y-1">
            <div>Pool ID: {pool.id.slice(0, 8)}...</div>
            <div>TokenA: {getShortAddress(pool.tokenA)}</div>
            <div>TokenB: {getShortAddress(pool.tokenB)}</div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          {isSelected && (
            <div className="bg-neon-green text-black px-2 py-1 rounded text-xs font-cyber mb-2">
              SELECTED
            </div>
          )}
          <div className={`text-xs font-cyber ${getLiquidityStatusColor()}`}>
            {getLiquidityStatusText()}
          </div>
        </div>
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-3">
          <div>
            <div className="text-gray-400 text-xs mb-1">Total Value Locked</div>
            <div className="text-neon-green font-cyber text-lg">
              ${calculateTVL()}
            </div>
          </div>
          
          <div>
            <div className="text-gray-400 text-xs mb-1">Total Liquidity Shares</div>
            <div className="text-cyber-blue font-cyber">
              {formatAmount(pool.totalLiquidity)}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-gray-400 text-xs mb-1">Available Liquidity</div>
            <div className="text-electric-purple font-cyber text-sm">
              {formatAmount(pool.reserveA, tokenAInfo.decimals)} {tokenAInfo.symbol}
            </div>
            <div className="text-electric-purple font-cyber text-sm">
              {formatAmount(pool.reserveB, tokenBInfo.decimals)} {tokenBInfo.symbol}
            </div>
          </div>
        </div>
      </div>

      {/* Token Details */}
      <div className="border-t border-gray-700 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Token A Stats */}
          <div className="space-y-2">
            <h4 className="text-sm font-cyber text-neon-green">{tokenAInfo.symbol} Stats</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Reserve:</span>
                <span className="text-white">{formatAmount(pool.reserveA, tokenAInfo.decimals)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Borrowed:</span>
                <span className="text-hot-pink">{formatAmount(pool.totalBorrowedA, tokenAInfo.decimals)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Utilization:</span>
                <span className="text-laser-orange">{calculateUtilization('A')}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Borrow APY:</span>
                <span className="text-electric-purple">{getAPY('A')}%</span>
              </div>
            </div>
          </div>

          {/* Token B Stats */}
          <div className="space-y-2">
            <h4 className="text-sm font-cyber text-neon-green">{tokenBInfo.symbol} Stats</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Reserve:</span>
                <span className="text-white">{formatAmount(pool.reserveB, tokenBInfo.decimals)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Borrowed:</span>
                <span className="text-hot-pink">{formatAmount(pool.totalBorrowedB, tokenBInfo.decimals)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Utilization:</span>
                <span className="text-laser-orange">{calculateUtilization('B')}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Borrow APY:</span>
                <span className="text-electric-purple">{getAPY('B')}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Addresses (Expandable) */}
      <div className="border-t border-gray-700 pt-4 mt-4">
        <details className="text-xs">
          <summary className="text-gray-400 cursor-pointer hover:text-cyber-blue">
            Token Details
          </summary>
          <div className="mt-2 space-y-2">
            <div>
              <span className="text-gray-400">{tokenAInfo.symbol} Address:</span>
              <div className="text-cyber-blue font-mono break-all">{pool.tokenA}</div>
              <div className="text-gray-500">Decimals: {tokenAInfo.decimals}</div>
            </div>
            <div>
              <span className="text-gray-400">{tokenBInfo.symbol} Address:</span>
              <div className="text-cyber-blue font-mono break-all">{pool.tokenB}</div>
              <div className="text-gray-500">Decimals: {tokenBInfo.decimals}</div>
            </div>
          </div>
        </details>
      </div>

      {/* Pool Health Indicator */}
      <div className="mt-4 flex items-center justify-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          parseFloat(calculateTVL()) > 1000 ? 'bg-neon-green' :
          parseFloat(calculateTVL()) > 100 ? 'bg-laser-orange' : 
          parseFloat(calculateTVL()) > 0 ? 'bg-cyber-blue' : 'bg-red-500'
        }`}></div>
        <span className="text-xs text-gray-400">
          {parseFloat(calculateTVL()) > 1000 ? 'Excellent Liquidity' :
           parseFloat(calculateTVL()) > 100 ? 'Good Liquidity' : 
           parseFloat(calculateTVL()) > 0 ? 'Limited Liquidity' : 'No Liquidity'}
        </span>
      </div>
    </div>
  );
};

export default PoolCard;
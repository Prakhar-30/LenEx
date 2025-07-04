import React from 'react';
import { ethers } from 'ethers';
import { MOCK_TOKENS } from '../contracts/MockToken';

const PoolCard = ({ pool, onSelectPool, isSelected = false, showActions = true }) => {
  const getTokenSymbol = (address) => {
    return Object.keys(MOCK_TOKENS).find(key => 
      MOCK_TOKENS[key].address === address
    ) || 'Unknown';
  };

  const formatAmount = (amount) => {
    const formatted = parseFloat(ethers.utils.formatEther(amount));
    return formatted.toFixed(4);
  };

  const calculateTVL = () => {
    const reserveA = parseFloat(ethers.utils.formatEther(pool.reserveA));
    const reserveB = parseFloat(ethers.utils.formatEther(pool.reserveB));
    return (reserveA + reserveB).toFixed(2);
  };

  const calculateUtilization = (token) => {
    const isTokenA = token === 'A';
    const reserve = isTokenA ? pool.reserveA : pool.reserveB;
    const borrowed = isTokenA ? pool.totalBorrowedA : pool.totalBorrowedB;
    
    if (reserve.eq(0)) return '0.00';
    
    const utilization = (parseFloat(ethers.utils.formatEther(borrowed)) / 
                        parseFloat(ethers.utils.formatEther(reserve))) * 100;
    return Math.min(utilization, 100).toFixed(2);
  };

  const getAPY = (token) => {
    const isTokenA = token === 'A';
    const rate = isTokenA ? pool.interestRateA : pool.interestRateB;
    return (parseFloat(ethers.utils.formatEther(rate))).toFixed(2);
  };

  const tokenASymbol = getTokenSymbol(pool.tokenA);
  const tokenBSymbol = getTokenSymbol(pool.tokenB);

  return (
    <div className={`cyber-card rounded-xl p-6 pencil-effect transition-all hover:scale-105 cursor-pointer thin-neon-border ${
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
            {tokenASymbol} / {tokenBSymbol}
          </h3>
          <div className="text-sm text-gray-400">
            Pool ID: {pool.id.slice(0, 8)}...
          </div>
        </div>
        {isSelected && (
          <div className="bg-neon-green text-black px-2 py-1 rounded text-xs font-cyber">
            SELECTED
          </div>
        )}
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
            <div className="text-electric-purple font-cyber">
              {formatAmount(pool.reserveA)} {tokenASymbol}
            </div>
            <div className="text-electric-purple font-cyber">
              {formatAmount(pool.reserveB)} {tokenBSymbol}
            </div>
          </div>
        </div>
      </div>

      {/* Token Details */}
      <div className="border-t border-gray-700 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Token A Stats */}
          <div className="space-y-2">
            <h4 className="text-sm font-cyber text-neon-green">{tokenASymbol} Stats</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Reserve:</span>
                <span className="text-white">{formatAmount(pool.reserveA)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Borrowed:</span>
                <span className="text-hot-pink">{formatAmount(pool.totalBorrowedA)}</span>
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
            <h4 className="text-sm font-cyber text-neon-green">{tokenBSymbol} Stats</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Reserve:</span>
                <span className="text-white">{formatAmount(pool.reserveB)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Borrowed:</span>
                <span className="text-hot-pink">{formatAmount(pool.totalBorrowedB)}</span>
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

      {/* Action Buttons */}
      {showActions && (
        <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-700">
          <button 
            className="flex-1 py-2 bg-neon-green text-black font-cyber text-sm rounded hover:bg-opacity-80 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to swap with this pool selected
              window.location.href = `/swap?pool=${pool.id}`;
            }}
          >
            Swap
          </button>
          <button 
            className="flex-1 py-2 bg-electric-purple text-black font-cyber text-sm rounded hover:bg-opacity-80 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to liquidity with this pool selected
              window.location.href = `/liquidity?pool=${pool.id}`;
            }}
          >
            Add Liquidity
          </button>
          <button 
            className="flex-1 py-2 bg-hot-pink text-black font-cyber text-sm rounded hover:bg-opacity-80 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to lending with this pool selected
              window.location.href = `/lending?pool=${pool.id}`;
            }}
          >
            Lend/Borrow
          </button>
        </div>
      )}

      {/* Pool Health Indicator */}
      <div className="mt-3 flex items-center justify-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          parseFloat(calculateTVL()) > 1000 ? 'bg-neon-green' :
          parseFloat(calculateTVL()) > 100 ? 'bg-laser-orange' : 'bg-hot-pink'
        }`}></div>
        <span className="text-xs text-gray-400">
          {parseFloat(calculateTVL()) > 1000 ? 'High Liquidity' :
           parseFloat(calculateTVL()) > 100 ? 'Medium Liquidity' : 'Low Liquidity'}
        </span>
      </div>
    </div>
  );
};

export default PoolCard;
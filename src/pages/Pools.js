import React from 'react';
import PoolsOverview from '../components/PoolsOverview';

const Pools = () => {
  return (
    <div className="min-h-screen bg-black py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-cyber text-cyber-blue mb-4 animate-glow">
            Liquidity Pools
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Explore all available trading pairs, provide liquidity to earn fees, 
            or borrow against your collateral. Each pool shows real-time statistics 
            including TVL, utilization rates, and current APY.
          </p>
        </div>
        
        <PoolsOverview showActions={true} />
      </div>
    </div>
  );
};

export default Pools;
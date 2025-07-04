import React from 'react';
import LiquidityInterface from '../components/LiquidityInterface';

const Liquidity = () => {
  return (
    <div className="min-h-screen bg-black py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-cyber text-electric-purple mb-4 animate-glow">
            Liquidity Pools
          </h1>
          <p className="text-lg text-gray-300">
            Provide liquidity to earn trading fees
          </p>
        </div>
        
        <LiquidityInterface />
      </div>
    </div>
  );
};

export default Liquidity;
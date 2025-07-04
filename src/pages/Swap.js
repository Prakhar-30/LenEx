import React from 'react';
import SwapInterface from '../components/SwapInterface';

const Swap = () => {
  return (
    <div className="min-h-screen bg-black py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-cyber text-neon-green mb-4 animate-glow">
            Token Swap
          </h1>
          <p className="text-lg text-gray-300">
            Trade tokens instantly with our automated market maker
          </p>
        </div>
        
        <SwapInterface />
      </div>
    </div>
  );
};

export default Swap;
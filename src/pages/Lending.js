import React, { useState } from 'react';
import LendingInterface from '../components/LendingInterface';
import LiquidationProtectionDeployer from '../components/LiquidationProtectionDeployer';

const Lending = () => {
  const [activeTab, setActiveTab] = useState('lending');

  return (
    <div className="min-h-screen bg-black py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-cyber text-hot-pink mb-4 animate-glow">
            Lending & Borrowing
          </h1>
          <p className="text-lg text-gray-300">
            Lend your tokens, borrow against collateral, and protect your positions
          </p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
            <button
              onClick={() => setActiveTab('lending')}
              className={`px-6 py-3 rounded-md font-cyber transition-all ${
                activeTab === 'lending'
                  ? 'bg-hot-pink text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Lending & Borrowing
            </button>
            <button
              onClick={() => setActiveTab('protection')}
              className={`px-6 py-3 rounded-md font-cyber transition-all ${
                activeTab === 'protection'
                  ? 'bg-electric-purple text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Liquidation Protection
            </button>
          </div>
        </div>
        
        {/* Tab Content */}
        <div className="transition-all duration-300">
          {activeTab === 'lending' && (
            <div className="animate-fadeIn">
              <LendingInterface />
            </div>
          )}
          
          {activeTab === 'protection' && (
            <div className="animate-fadeIn">
              <LiquidationProtectionDeployer />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lending;
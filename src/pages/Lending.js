import React from 'react';
import LendingInterface from '../components/LendingInterface';

const Lending = () => {
  return (
    <div className="min-h-screen bg-black py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-cyber text-hot-pink mb-4 animate-glow">
            Lending & Borrowing
          </h1>
          <p className="text-lg text-gray-300">
            Lend your tokens or borrow against collateral
          </p>
        </div>
        
        <LendingInterface />
      </div>
    </div>
  );
};

export default Lending;
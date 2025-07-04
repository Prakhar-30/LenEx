import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import WalletConnect from './WalletConnect';
import { useWallet } from '../hooks/useWallet';
import { CHAIN_IDS } from '../utils/constants';

const Header = () => {
  const location = useLocation();
  const { chainId, isConnected } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navigation = [
    { name: 'Home', path: '/' },
    { name: 'Pools', path: '/pools' },
    { name: 'Swap', path: '/swap' },
    { name: 'Liquidity', path: '/liquidity' },
    { name: 'Lending', path: '/lending' }
  ];

  const isWrongNetwork = chainId && chainId !== CHAIN_IDS.SEPOLIA;

  return (
    <header className="bg-black border-b-2 border-cyber-blue relative">
      {/* Wrong Network Banner */}
      {isConnected && isWrongNetwork && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-cyber">
          ⚠️ Please switch to Sepolia Testnet for proper functionality
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              to="/" 
              className="text-2xl font-cyber font-bold text-neon-green animate-glow hover:text-cyber-blue transition-colors"
            >
              DeLex Protocol
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:ml-10 md:flex md:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`px-3 py-2 text-sm font-cyber transition-colors ${
                    location.pathname === item.path
                      ? 'text-cyber-blue border-b-2 border-cyber-blue'
                      : 'text-gray-300 hover:text-electric-purple hover:border-b-2 hover:border-electric-purple'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop Wallet Connect */}
          <div className="hidden md:block">
            <WalletConnect />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-300 hover:text-neon-green focus:outline-none focus:text-neon-green"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 border-t border-gray-700">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 text-base font-cyber transition-colors ${
                    location.pathname === item.path
                      ? 'text-cyber-blue bg-gray-900 rounded-md'
                      : 'text-gray-300 hover:text-electric-purple hover:bg-gray-800 rounded-md'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              {/* Mobile Wallet Connect */}
              <div className="px-3 py-2">
                <WalletConnect />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Network Status Indicator */}
      {isConnected && (
        <div className="absolute top-0 right-0 mt-1 mr-4 hidden lg:block">
          <div className={`text-xs font-cyber px-2 py-1 rounded ${
            isWrongNetwork 
              ? 'bg-red-600 text-white' 
              : 'bg-green-600 text-white'
          }`}>
            {isWrongNetwork ? 'Wrong Network' : 'Sepolia'}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { CHAIN_IDS } from '../utils/constants';

const WalletConnect = () => {
  const { account, loading, connectWallet, disconnectWallet, chainId, isConnected } = useWallet();

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkName = (chainId) => {
    switch (chainId) {
      case CHAIN_IDS.SEPOLIA:
        return 'Sepolia';
      case CHAIN_IDS.MAINNET:
        return 'Mainnet';
      case CHAIN_IDS.GOERLI:
        return 'Goerli';
      default:
        return `Chain ${chainId}`;
    }
  };

  const isWrongNetwork = chainId && chainId !== CHAIN_IDS.SEPOLIA;

  return (
    <div className="flex items-center">
      {account ? (
        <div className="flex items-center space-x-4">
          <div className="flex flex-col items-end">
            <div className="text-cyber-blue font-cyber text-sm">
              {formatAddress(account)}
            </div>
            {chainId && (
              <div className={`text-xs font-cyber ${
                isWrongNetwork ? 'text-red-400' : 'text-gray-400'
              }`}>
                {getNetworkName(chainId)}
                {isWrongNetwork && ' (Wrong Network)'}
              </div>
            )}
          </div>
          <button
            onClick={disconnectWallet}
            className="px-4 py-2 bg-hot-pink text-black font-cyber text-sm rounded-lg hover:bg-opacity-80 transition-all neon-border border-hot-pink"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          disabled={loading}
          className="px-6 py-3 bg-neon-green text-black font-cyber text-lg rounded-lg hover:bg-opacity-80 transition-all neon-border border-neon-green disabled:opacity-50 animate-glow"
        >
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
      
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && isConnected && (
        <div className="ml-4 text-xs text-gray-500">
          <div>Connected: {isConnected ? '✅' : '❌'}</div>
          <div>Chain: {chainId}</div>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
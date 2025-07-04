import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SEPOLIA_TESTNET } from '../utils/constants';

export const useWallet = () => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Check if wallet is already connected on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (!window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_accounts' 
      });
      
      if (accounts.length > 0) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const network = await provider.getNetwork();
        
        setAccount(accounts[0]);
        setProvider(provider);
        setSigner(signer);
        setChainId(network.chainId);
        setIsConnected(true);
        
        console.log('Wallet already connected:', {
          account: accounts[0],
          chainId: network.chainId,
          networkName: network.name
        });
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet!');
      return;
    }

    try {
      setLoading(true);
      console.log('Attempting to connect wallet...');
      
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      console.log('Accounts received:', accounts);

      if (accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }

      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const network = await provider.getNetwork();
      
      console.log('Current network:', {
        chainId: network.chainId,
        name: network.name
      });

      // Check if we're on Sepolia
      const sepoliaChainId = parseInt(SEPOLIA_TESTNET.chainId, 16);
      if (network.chainId !== sepoliaChainId) {
        console.log(`Switching to Sepolia (${sepoliaChainId})...`);
        await switchToSepolia();
        // Re-get network info after switch
        const newNetwork = await provider.getNetwork();
        setChainId(newNetwork.chainId);
      } else {
        setChainId(network.chainId);
      }

      setAccount(accounts[0]);
      setProvider(provider);
      setSigner(signer);
      setIsConnected(true);
      
      console.log('Wallet connected successfully:', {
        account: accounts[0],
        chainId: network.chainId
      });
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert(`Failed to connect wallet: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const switchToSepolia = async () => {
    try {
      // Try to switch to Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_TESTNET.chainId }]
      });
      console.log('Switched to Sepolia successfully');
    } catch (switchError) {
      console.log('Switch error:', switchError);
      
      // If the network doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [SEPOLIA_TESTNET]
          });
          console.log('Added Sepolia network');
        } catch (addError) {
          console.error('Error adding Sepolia network:', addError);
          throw addError;
        }
      } else {
        throw switchError;
      }
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setIsConnected(false);
    console.log('Wallet disconnected');
  };

  // Set up event listeners
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      console.log('Accounts changed:', accounts);
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== account) {
        setAccount(accounts[0]);
        console.log('Account switched to:', accounts[0]);
      }
    };

    const handleChainChanged = (chainId) => {
      const newChainId = parseInt(chainId, 16);
      console.log('Chain changed to:', newChainId);
      setChainId(newChainId);
      
      // Reload the page when chain changes to reset state
      window.location.reload();
    };

    const handleConnect = (connectInfo) => {
      console.log('Wallet connected:', connectInfo);
      setIsConnected(true);
    };

    const handleDisconnect = (error) => {
      console.log('Wallet disconnected:', error);
      disconnectWallet();
    };

    // Add event listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('connect', handleConnect);
    window.ethereum.on('disconnect', handleDisconnect);

    // Cleanup
    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('connect', handleConnect);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [account]);

  return {
    account,
    provider,
    signer,
    chainId,
    loading,
    isConnected,
    connectWallet,
    disconnectWallet,
    switchToSepolia
  };
};
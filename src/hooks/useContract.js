import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { DeLex_CORE_ADDRESS, DeLex_CORE_ABI } from '../contracts/DeLexCore';
import { MOCK_TOKENS, MOCK_TOKEN_ABI } from '../contracts/MockToken';

export const useContract = (signer) => {
  const [DeLexContract, setDeLexContract] = useState(null);
  const [tokenContracts, setTokenContracts] = useState({});
  const [contractsReady, setContractsReady] = useState(false);

  useEffect(() => {
    if (signer) {
      initializeContracts();
    } else {
      // Clear contracts when no signer
      setDeLexContract(null);
      setTokenContracts({});
      setContractsReady(false);
    }
  }, [signer]);

  const initializeContracts = async () => {
    try {
      console.log('Initializing contracts...');
      
      // Verify signer is available
      const signerAddress = await signer.getAddress();
      console.log('Signer address:', signerAddress);

      // Initialize DeLex contract
      console.log('Creating DeLex contract with address:', DeLex_CORE_ADDRESS);
      const DeLex = new ethers.Contract(DeLex_CORE_ADDRESS, DeLex_CORE_ABI, signer);
      
      // Test contract connection
      try {
        const owner = await DeLex.owner();
        console.log('DeLex contract connected. Owner:', owner);
      } catch (error) {
        console.error('Error testing DeLex contract:', error);
        throw new Error(`Failed to connect to DeLex contract: ${error.message}`);
      }

      setDeLexContract(DeLex);

      // Initialize token contracts
      const tokens = {};
      console.log('Initializing token contracts...');
      
      for (const [symbol, tokenInfo] of Object.entries(MOCK_TOKENS)) {
        console.log(`Creating ${symbol} contract with address:`, tokenInfo.address);
        
        try {
          const tokenContract = new ethers.Contract(
            tokenInfo.address,
            MOCK_TOKEN_ABI,
            signer
          );
          
          // Test token contract connection
          const tokenName = await tokenContract.name();
          const tokenSymbol = await tokenContract.symbol();
          console.log(`${symbol} contract connected:`, { name: tokenName, symbol: tokenSymbol });
          
          tokens[symbol] = tokenContract;
        } catch (error) {
          console.error(`Error creating ${symbol} contract:`, error);
          throw new Error(`Failed to connect to ${symbol} contract: ${error.message}`);
        }
      }
      
      setTokenContracts(tokens);
      setContractsReady(true);
      console.log('All contracts initialized successfully');
      
    } catch (error) {
      console.error('Error initializing contracts:', error);
      setDeLexContract(null);
      setTokenContracts({});
      setContractsReady(false);
      
      // You might want to show a toast or alert here
      if (window.toast) {
        window.toast.error(`Contract initialization failed: ${error.message}`);
      }
    }
  };

  // Helper function to check if contracts are ready
  const checkContractReady = (contractName = 'DeLex') => {
    if (!contractsReady) {
      console.warn(`${contractName} contract not ready yet`);
      return false;
    }
    return true;
  };

  // Helper function to handle contract calls with error handling
  const safeContractCall = async (contractCall, errorMessage = 'Contract call failed') => {
    try {
      if (!contractsReady) {
        throw new Error('Contracts not initialized');
      }
      return await contractCall();
    } catch (error) {
      console.error(errorMessage, error);
      throw error;
    }
  };

  return { 
    DeLexContract, 
    tokenContracts, 
    contractsReady,
    checkContractReady,
    safeContractCall
  };
};
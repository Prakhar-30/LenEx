import { useState, useCallback } from 'react';
import { ethers } from 'ethers';

// Standard ERC20 ABI for basic functions
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

export const useToken = (signer) => {
  const [tokenCache, setTokenCache] = useState({});
  const [loadingTokens, setLoadingTokens] = useState({});

  // Validate if address is a valid Ethereum address
  const isValidAddress = useCallback((address) => {
    try {
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  }, []);

  // Fetch token information from contract
  const fetchTokenInfo = useCallback(async (tokenAddress) => {
    if (!signer || !isValidAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }

    const normalizedAddress = ethers.utils.getAddress(tokenAddress);

    // Return cached data if available
    if (tokenCache[normalizedAddress]) {
      console.log('Returning cached token info for:', normalizedAddress);
      return tokenCache[normalizedAddress];
    }

    if (loadingTokens[normalizedAddress]) {
      throw new Error('Token info already being fetched');
    }

    try {
      setLoadingTokens(prev => ({ ...prev, [normalizedAddress]: true }));

      console.log('Fetching token info for:', normalizedAddress);
      const tokenContract = new ethers.Contract(normalizedAddress, ERC20_ABI, signer);
      
      // Test if the contract exists and is a valid ERC20 token
      try {
        await tokenContract.totalSupply();
      } catch (error) {
        throw new Error('Not a valid ERC20 token contract');
      }
      
      // Fetch basic token info with individual error handling
      let name, symbol, decimals;
      
      try {
        name = await tokenContract.name();
      } catch (error) {
        console.warn('Failed to get token name:', error);
        name = 'Unknown';
      }
      
      try {
        symbol = await tokenContract.symbol();
      } catch (error) {
        console.warn('Failed to get token symbol:', error);
        symbol = 'UNK';
      }
      
      try {
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.warn('Failed to get token decimals:', error);
        decimals = 18; // Default to 18 decimals
      }

      const tokenInfo = {
        address: normalizedAddress,
        name,
        symbol,
        decimals,
        contract: tokenContract
      };

      console.log('Token info fetched successfully:', tokenInfo);

      // Cache the token info
      setTokenCache(prev => ({
        ...prev,
        [normalizedAddress]: tokenInfo
      }));

      return tokenInfo;
    } catch (error) {
      console.error('Error fetching token info for', normalizedAddress, ':', error);
      throw new Error(`Failed to fetch token info: ${error.message}`);
    } finally {
      setLoadingTokens(prev => ({ ...prev, [normalizedAddress]: false }));
    }
  }, [signer, tokenCache, loadingTokens, isValidAddress]);

  // Get token balance for a specific user
  const getTokenBalance = useCallback(async (tokenAddress, userAddress) => {
    if (!signer || !isValidAddress(tokenAddress) || !isValidAddress(userAddress)) {
      return '0';
    }

    try {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      const balance = await tokenInfo.contract.balanceOf(userAddress);
      return ethers.utils.formatUnits(balance, tokenInfo.decimals);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return '0';
    }
  }, [signer, fetchTokenInfo, isValidAddress]);

  // Get token allowance
  const getTokenAllowance = useCallback(async (tokenAddress, owner, spender) => {
    if (!signer || !isValidAddress(tokenAddress) || !isValidAddress(owner) || !isValidAddress(spender)) {
      return '0';
    }

    try {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      const allowance = await tokenInfo.contract.allowance(owner, spender);
      return ethers.utils.formatUnits(allowance, tokenInfo.decimals);
    } catch (error) {
      console.error('Error fetching token allowance:', error);
      return '0';
    }
  }, [signer, fetchTokenInfo, isValidAddress]);

  // Approve token spending
  const approveToken = useCallback(async (tokenAddress, spender, amount) => {
    if (!signer || !isValidAddress(tokenAddress) || !isValidAddress(spender)) {
      throw new Error('Invalid parameters for token approval');
    }

    try {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      const amountWei = ethers.utils.parseUnits(amount.toString(), tokenInfo.decimals);
      
      console.log('Approving token spend:', {
        token: tokenAddress,
        spender: spender,
        amount: amount,
        amountWei: amountWei.toString()
      });
      
      const tx = await tokenInfo.contract.approve(spender, amountWei);
      return tx;
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    }
  }, [signer, fetchTokenInfo, isValidAddress]);

  // Use faucet if available (for test tokens)
  const useFaucet = useCallback(async (tokenAddress) => {
    if (!signer || !isValidAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }

    try {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      
      // Check if faucet function exists
      const faucetABI = ["function faucet() external"];
      const faucetContract = new ethers.Contract(tokenAddress, faucetABI, signer);
      
      const tx = await faucetContract.faucet();
      return tx;
    } catch (error) {
      console.error('Error using faucet:', error);
      throw error;
    }
  }, [signer, fetchTokenInfo, isValidAddress]);

  // Check if token has faucet function
  const hasFaucet = useCallback(async (tokenAddress) => {
    if (!signer || !isValidAddress(tokenAddress)) {
      return false;
    }

    try {
      const faucetABI = ["function faucet() external"];
      const faucetContract = new ethers.Contract(tokenAddress, faucetABI, signer);
      
      // Try to call faucet function statically to see if it exists
      await faucetContract.callStatic.faucet();
      return true;
    } catch {
      return false;
    }
  }, [signer, isValidAddress]);

  // Clear cache function
  const clearTokenCache = useCallback(() => {
    setTokenCache({});
  }, []);

  return {
    fetchTokenInfo,
    getTokenBalance,
    getTokenAllowance,
    approveToken,
    useFaucet,
    hasFaucet,
    isValidAddress,
    tokenCache,
    clearTokenCache,
    loadingTokens: Object.values(loadingTokens).some(Boolean)
  };
};
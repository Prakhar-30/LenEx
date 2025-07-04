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
  const isValidAddress = (address) => {
    try {
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  };

  // Fetch token information from contract
  const fetchTokenInfo = useCallback(async (tokenAddress) => {
    if (!signer || !isValidAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }

    // Return cached data if available
    if (tokenCache[tokenAddress]) {
      return tokenCache[tokenAddress];
    }

    if (loadingTokens[tokenAddress]) {
      throw new Error('Token info already being fetched');
    }

    try {
      setLoadingTokens(prev => ({ ...prev, [tokenAddress]: true }));

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      
      // Fetch basic token info
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      const tokenInfo = {
        address: tokenAddress,
        name,
        symbol,
        decimals,
        contract: tokenContract
      };

      // Cache the token info
      setTokenCache(prev => ({
        ...prev,
        [tokenAddress]: tokenInfo
      }));

      return tokenInfo;
    } catch (error) {
      console.error('Error fetching token info:', error);
      throw new Error(`Failed to fetch token info: ${error.message}`);
    } finally {
      setLoadingTokens(prev => ({ ...prev, [tokenAddress]: false }));
    }
  }, [signer, tokenCache, loadingTokens]);

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
  }, [signer, fetchTokenInfo]);

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
  }, [signer, fetchTokenInfo]);

  // Approve token spending
  const approveToken = useCallback(async (tokenAddress, spender, amount) => {
    if (!signer || !isValidAddress(tokenAddress) || !isValidAddress(spender)) {
      throw new Error('Invalid parameters for token approval');
    }

    try {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      const amountWei = ethers.utils.parseUnits(amount.toString(), tokenInfo.decimals);
      
      const tx = await tokenInfo.contract.approve(spender, amountWei);
      return tx;
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    }
  }, [signer, fetchTokenInfo]);

  // Use faucet if available (for test tokens)
  const useFaucet = useCallback(async (tokenAddress) => {
    if (!signer || !isValidAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }

    try {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      const tx = await tokenInfo.contract.faucet();
      return tx;
    } catch (error) {
      console.error('Error using faucet:', error);
      throw error;
    }
  }, [signer, fetchTokenInfo]);

  // Check if token has faucet function
  const hasFaucet = useCallback(async (tokenAddress) => {
    if (!signer || !isValidAddress(tokenAddress)) {
      return false;
    }

    try {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      // Try to call faucet function to see if it exists
      await tokenInfo.contract.callStatic.faucet();
      return true;
    } catch {
      return false;
    }
  }, [signer, fetchTokenInfo]);

  return {
    fetchTokenInfo,
    getTokenBalance,
    getTokenAllowance,
    approveToken,
    useFaucet,
    hasFaucet,
    isValidAddress,
    tokenCache,
    loadingTokens: Object.values(loadingTokens).some(Boolean)
  };
};
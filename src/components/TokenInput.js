import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useToken } from '../hooks/useToken';
import { useWallet } from '../hooks/useWallet';

const TokenInput = ({ 
  label, 
  tokenAddress, 
  onTokenChange, 
  amount, 
  onAmountChange,
  readOnly = false,
  showBalance = true,
  placeholder = "Enter token address",
  amountPlaceholder = "0.0"
}) => {
  const { account, signer } = useWallet();
  const { fetchTokenInfo, getTokenBalance, isValidAddress } = useToken(signer);
  
  const [tokenInfo, setTokenInfo] = useState(null);
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load token info when address changes
  useEffect(() => {
    if (tokenAddress && isValidAddress(tokenAddress)) {
      loadTokenInfo();
    } else {
      setTokenInfo(null);
      setBalance('0');
      setError('');
    }
  }, [tokenAddress, signer]);

  // Load balance when token or account changes
  useEffect(() => {
    if (tokenInfo && account && showBalance) {
      loadBalance();
    }
  }, [tokenInfo, account, showBalance]);

  const loadTokenInfo = async () => {
    if (!signer || !tokenAddress || !isValidAddress(tokenAddress)) return;
    
    try {
      setLoading(true);
      setError('');
      
      console.log('Loading token info for:', tokenAddress);
      const info = await fetchTokenInfo(tokenAddress);
      setTokenInfo(info);
      console.log('Token info loaded:', info);
      
    } catch (err) {
      console.error('Error loading token info:', err);
      setError(err.message);
      setTokenInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    if (!tokenInfo || !account) return;
    
    try {
      const bal = await getTokenBalance(tokenAddress, account);
      setBalance(bal);
    } catch (err) {
      console.error('Error loading balance:', err);
      setBalance('0');
    }
  };

  const handleAddressChange = (e) => {
    const address = e.target.value;
    onTokenChange(address);
  };

  const handleMaxClick = () => {
    if (balance && balance !== '0' && onAmountChange) {
      onAmountChange(balance);
    }
  };

  const isValidAddr = tokenAddress && isValidAddress(tokenAddress);

  return (
    <div className="space-y-3">
      {/* Label and Balance */}
      <div className="flex justify-between items-center">
        <label className="text-gray-300 font-cyber text-sm">{label}</label>
        {showBalance && tokenInfo && (
          <div className="text-gray-400 text-xs flex items-center space-x-2">
            <span>Balance: {parseFloat(balance).toFixed(4)} {tokenInfo.symbol}</span>
            {onAmountChange && parseFloat(balance) > 0 && (
              <button
                onClick={handleMaxClick}
                className="text-cyber-blue hover:text-neon-green text-xs underline"
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>

      {/* Token Address Input */}
      <div className="space-y-2">
        <input
          type="text"
          value={tokenAddress}
          onChange={handleAddressChange}
          placeholder={placeholder}
          className={`w-full bg-black border rounded-lg px-3 py-2 text-white font-cyber text-sm ${
            isValidAddr ? 'border-gray-600' : tokenAddress ? 'border-red-500' : 'border-gray-600'
          }`}
        />
        
        {/* Address validation */}
        {tokenAddress && !isValidAddr && (
          <div className="text-red-400 text-xs">Invalid token address</div>
        )}
        
        {/* Token Info Display */}
        {loading && (
          <div className="text-electric-purple text-xs">Loading token info...</div>
        )}
        
        {error && (
          <div className="text-red-400 text-xs">{error}</div>
        )}
        
        {tokenInfo && !loading && (
          <div className="flex items-center justify-between bg-gray-900 rounded-lg p-2">
            <div className="text-neon-green text-sm font-cyber">
              {tokenInfo.name} ({tokenInfo.symbol})
            </div>
            <div className="text-gray-400 text-xs">
              Decimals: {tokenInfo.decimals}
            </div>
          </div>
        )}
      </div>

      {/* Amount Input */}
      {onAmountChange && (
        <div className="space-y-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder={amountPlaceholder}
            readOnly={readOnly}
            className={`w-full border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber text-sm ${
              readOnly ? 'bg-gray-900 text-gray-400' : 'bg-black'
            }`}
          />
          
          {/* Amount validation */}
          {amount && tokenInfo && parseFloat(amount) > parseFloat(balance) && (
            <div className="text-red-400 text-xs">
              Insufficient balance
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TokenInput;
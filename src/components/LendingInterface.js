import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import { useToken } from '../hooks/useToken';
import TokenInput from './TokenInput';
import toast from 'react-hot-toast';

const LendingInterface = () => {
  const { account, signer } = useWallet();
  const { DeLexContract, contractsReady } = useContract(signer);
  const { fetchTokenInfo, approveToken, getTokenAllowance, getTokenBalance, isValidAddress } = useToken(signer);
  
  // Core state
  const [initialized, setInitialized] = useState(false);
  const [pools, setPools] = useState([]);
  const [selectedPool, setSelectedPool] = useState(null);
  const [selectedPoolPosition, setSelectedPoolPosition] = useState(null);
  const [userPositions, setUserPositions] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Form state
  const [amount, setAmount] = useState('');
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');

  // Pool-specific lending summary state
  const [poolStats, setPoolStats] = useState({
    totalCollateralValue: ethers.BigNumber.from(0),
    totalBorrowedValue: ethers.BigNumber.from(0),
    totalAvailableToBorrow: ethers.BigNumber.from(0),
    healthFactor: ethers.BigNumber.from(0),
    collateralFactor: ethers.BigNumber.from(0),
    hasPosition: false
  });

  // FIXED: Enhanced borrowing state with better error handling
  const [borrowingState, setBorrowingState] = useState({
    canBorrow: false,
    availableTokenToBorrow: null,
    maxBorrowAmount: '0',
    collateralToken: null,
    borrowableToken: null,
    error: null,
    loading: false
  });

  // ENHANCED: Withdrawal state for collateral withdrawal functionality
  const [withdrawalState, setWithdrawalState] = useState({
    canWithdraw: false,
    withdrawableTokens: [], // Array of tokens that can be withdrawn
    maxWithdrawableAmounts: {}, // Token address -> max withdrawable amount
    selectedWithdrawToken: null,
    withdrawAmount: '',
    loading: false,
    error: null
  });

  // Modal states
  const [withdrawalModal, setWithdrawalModal] = useState({
    isOpen: false,
    position: null,
    tokenAddress: '',
    tokenInfo: null,
    maxWithdrawable: '0',
    withdrawAmount: ''
  });

  const [repaymentModal, setRepaymentModal] = useState({
    isOpen: false,
    position: null,
    tokenAddress: '',
    tokenInfo: null,
    maxRepayable: '0',
    currentBorrowed: '0',
    repayAmount: ''
  });
  // Initialize component when contracts are ready
  useEffect(() => {
    if (contractsReady && signer && !initialized) {
      console.log('Initializing lending interface...');
      setInitialized(true);
      if (account) {
        loadData();
      }
    }
  }, [contractsReady, signer, account, initialized]);

  // Handle account changes after initialization
  useEffect(() => {
    if (initialized && account && DeLexContract) {
      console.log('Account connected after initialization, loading data...');
      loadData();
    }
  }, [initialized, account, DeLexContract]);

  // Update pool-specific stats when selected pool changes
  useEffect(() => {
    if (initialized && selectedPool && account) {
      loadPoolSpecificStats();
      checkBorrowingAvailability();
      checkWithdrawalAvailability(); // NEW: Check withdrawal availability
    } else {
      resetPoolStats();
      resetBorrowingState();
      resetWithdrawalState(); // NEW: Reset withdrawal state
    }
  }, [selectedPool, account, initialized]);

  // FIXED: Auto-set token address when borrowing state changes
  useEffect(() => {
    if (borrowingState.canBorrow && borrowingState.availableTokenToBorrow && activeTab === 'borrow') {
      setSelectedTokenAddress(borrowingState.availableTokenToBorrow.address);
    }
  }, [borrowingState, activeTab]);

  // NEW: Auto-set token address when withdrawal state changes
  useEffect(() => {
    if (withdrawalState.canWithdraw && withdrawalState.withdrawableTokens.length > 0 && activeTab === 'withdraw') {
      // Auto-select the first withdrawable token if none selected
      if (!selectedTokenAddress || !withdrawalState.withdrawableTokens.find(t => t.address.toLowerCase() === selectedTokenAddress.toLowerCase())) {
        setSelectedTokenAddress(withdrawalState.withdrawableTokens[0].address);
      }
    }
  }, [withdrawalState, activeTab]);

  // Load all data
  const loadData = async () => {
    if (!DeLexContract || !account) return;
    
    try {
      setDataLoading(true);
      await Promise.all([loadPools(), loadUserPositions()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load lending data');
    } finally {
      setDataLoading(false);
    }
  };

  // Load available pools
  const loadPools = async () => {
    try {
      const poolIds = await DeLexContract.getAllPools();
      const poolsData = await Promise.all(
        poolIds.map(async (poolId) => {
          try {
            const pool = await DeLexContract.getPoolInfo(poolId);
            const [tokenAInfo, tokenBInfo] = await Promise.all([
              fetchTokenInfo(pool.tokenA),
              fetchTokenInfo(pool.tokenB)
            ]);
            return { id: poolId, tokenAInfo, tokenBInfo, ...pool };
          } catch (poolError) {
            console.error(`Error loading pool ${poolId}:`, poolError);
            return null;
          }
        })
      );
      
      const validPools = poolsData.filter(pool => pool !== null);
      setPools(validPools);
      
      // Auto-select first pool if none selected
      if (validPools.length > 0 && !selectedPool) {
        setSelectedPool(validPools[0]);
      }
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  // Load user positions with better error handling
  const loadUserPositions = async () => {
    try {
      const poolIds = await DeLexContract.getAllPools();
      const positions = [];
      
      for (const poolId of poolIds) {
        try {
          const position = await DeLexContract.getUserPosition(account, poolId);
          const pool = await DeLexContract.getPoolInfo(poolId);
          
          // Check if user has any position in this pool
          if (position.collateralA.gt(0) || position.collateralB.gt(0) || 
              position.borrowedA.gt(0) || position.borrowedB.gt(0)) {
            
            const [tokenAInfo, tokenBInfo] = await Promise.all([
              fetchTokenInfo(pool.tokenA),
              fetchTokenInfo(pool.tokenB)
            ]);
            
            positions.push({
              poolId,
              pool,
              tokenAInfo,
              tokenBInfo,
              ...position
            });
          }
        } catch (positionError) {
          console.error(`Error loading position for pool ${poolId}:`, positionError);
        }
      }
      
      setUserPositions(positions);
    } catch (error) {
      console.error('Error loading user positions:', error);
    }
  };
  // Load pool-specific stats
  const loadPoolSpecificStats = async () => {
    if (!selectedPool || !account || !DeLexContract) {
      resetPoolStats();
      return;
    }

    try {
      console.log('Loading pool-specific stats for pool:', selectedPool.id);
      
      // Get user position for selected pool
      const position = await DeLexContract.getUserPosition(account, selectedPool.id);
      const collateralFactor = await DeLexContract.COLLATERAL_FACTOR();
      
      // Check if user has any position in this pool
      const hasPosition = position.collateralA.gt(0) || position.collateralB.gt(0) || 
                         position.borrowedA.gt(0) || position.borrowedB.gt(0);
      
      let totalCollateralValue = ethers.BigNumber.from(0);
      let totalBorrowedValue = ethers.BigNumber.from(0);
      let healthFactor = ethers.BigNumber.from(0);
      
      if (hasPosition) {
        // Calculate values using actual token decimals
        const collateralA = parseFloat(ethers.utils.formatUnits(position.collateralA, selectedPool.tokenAInfo.decimals));
        const collateralB = parseFloat(ethers.utils.formatUnits(position.collateralB, selectedPool.tokenBInfo.decimals));
        const borrowedA = parseFloat(ethers.utils.formatUnits(position.borrowedA, selectedPool.tokenAInfo.decimals));
        const borrowedB = parseFloat(ethers.utils.formatUnits(position.borrowedB, selectedPool.tokenBInfo.decimals));
        
        const collateralValue = collateralA + collateralB;
        const borrowedValue = borrowedA + borrowedB;
        
        // Convert to BigNumber for consistent handling
        totalCollateralValue = ethers.utils.parseEther(collateralValue.toString());
        totalBorrowedValue = ethers.utils.parseEther(borrowedValue.toString());
        
        // Calculate health factor
        if (borrowedValue > 0) {
          const collateralFactorDecimal = parseFloat(ethers.utils.formatEther(collateralFactor));
          const maxBorrowCapacity = collateralValue * collateralFactorDecimal;
          const hf = maxBorrowCapacity / borrowedValue;
          healthFactor = ethers.utils.parseEther(Math.max(0, hf).toString());
        } else {
          healthFactor = ethers.constants.MaxUint256; // Infinite when no debt
        }
      }
      
      // Calculate available to borrow for this pool
      const maxBorrowCapacity = totalCollateralValue.mul(collateralFactor).div(ethers.constants.WeiPerEther);
      const totalAvailableToBorrow = maxBorrowCapacity.gt(totalBorrowedValue) ? 
        maxBorrowCapacity.sub(totalBorrowedValue) : ethers.BigNumber.from(0);
      
      setPoolStats({
        totalCollateralValue,
        totalBorrowedValue,
        totalAvailableToBorrow,
        healthFactor,
        collateralFactor,
        hasPosition
      });
      
      setSelectedPoolPosition(hasPosition ? position : null);
      
      console.log('Pool-specific stats updated:', {
        collateralValue: ethers.utils.formatEther(totalCollateralValue),
        borrowedValue: ethers.utils.formatEther(totalBorrowedValue),
        availableToBorrow: ethers.utils.formatEther(totalAvailableToBorrow),
        hasPosition
      });
      
    } catch (error) {
      console.error('Error loading pool-specific stats:', error);
      resetPoolStats();
    }
  };

  // FIXED: Enhanced borrowing availability check with better error handling
  const checkBorrowingAvailability = async () => {
    if (!selectedPool || !account || !DeLexContract) {
      resetBorrowingState();
      return;
    }

    try {
      setBorrowingState(prev => ({ ...prev, loading: true, error: null }));
      console.log('Checking borrowing availability for pool:', selectedPool.id);
      
      const position = await DeLexContract.getUserPosition(account, selectedPool.id);
      
      // Use the contract's built-in function to determine what can be borrowed
      const contractResult = await DeLexContract.getAvailableTokensToBorrow(account, selectedPool.id);
      
      console.log('Contract getAvailableTokensToBorrow result:', {
        canBorrow: contractResult.canBorrow,
        availableToken: contractResult.availableToken,
        maxBorrowAmount: contractResult.maxBorrowAmount.toString()
      });
      
      if (!contractResult.canBorrow) {
        console.log('Contract says cannot borrow');
        setBorrowingState({
          canBorrow: false,
          availableTokenToBorrow: null,
          maxBorrowAmount: '0',
          collateralToken: null,
          borrowableToken: null,
          error: 'You need to deposit collateral first to borrow from this pool',
          loading: false
        });
        return;
      }
      
      // Determine which token info to use based on contract result
      let availableTokenToBorrow = null;
      let collateralToken = null;
      
      const availableTokenAddress = contractResult.availableToken.toLowerCase();
      const tokenAAddress = selectedPool.tokenA.toLowerCase();
      const tokenBAddress = selectedPool.tokenB.toLowerCase();
      
      if (availableTokenAddress === tokenAAddress) {
        // Can borrow tokenA, so must have tokenB as collateral
        availableTokenToBorrow = {
          address: selectedPool.tokenA,
          info: selectedPool.tokenAInfo
        };
        collateralToken = {
          address: selectedPool.tokenB,
          info: selectedPool.tokenBInfo,
          amount: position.collateralB
        };
        console.log(`Can borrow ${selectedPool.tokenAInfo.symbol}, collateral is ${selectedPool.tokenBInfo.symbol}`);
      } else if (availableTokenAddress === tokenBAddress) {
        // Can borrow tokenB, so must have tokenA as collateral  
        availableTokenToBorrow = {
          address: selectedPool.tokenB,
          info: selectedPool.tokenBInfo
        };
        collateralToken = {
          address: selectedPool.tokenA,
          info: selectedPool.tokenAInfo,
          amount: position.collateralA
        };
        console.log(`Can borrow ${selectedPool.tokenBInfo.symbol}, collateral is ${selectedPool.tokenAInfo.symbol}`);
      } else {
        console.error('Contract returned unknown token address:', contractResult.availableToken);
        setBorrowingState({
          canBorrow: false,
          availableTokenToBorrow: null,
          maxBorrowAmount: '0',
          collateralToken: null,
          borrowableToken: null,
          error: 'Error determining available tokens to borrow',
          loading: false
        });
        return;
      }
      
      // Format the max borrow amount using the correct token decimals
      const maxBorrowAmount = ethers.utils.formatUnits(
        contractResult.maxBorrowAmount,
        availableTokenToBorrow.info.decimals
      );
      
      // Check pool liquidity
      const poolReserve = availableTokenAddress === tokenAAddress ? 
        selectedPool.reserveA : selectedPool.reserveB;
      const maxBorrowAmountBN = ethers.utils.parseUnits(maxBorrowAmount, availableTokenToBorrow.info.decimals);
      
      let finalMaxBorrow = maxBorrowAmount;
      let liquidityWarning = null;
      
      if (maxBorrowAmountBN.gt(poolReserve)) {
        finalMaxBorrow = ethers.utils.formatUnits(poolReserve, availableTokenToBorrow.info.decimals);
        liquidityWarning = `Pool has limited liquidity. Max available: ${finalMaxBorrow} ${availableTokenToBorrow.info.symbol}`;
      }
      
      console.log('Final borrowing state:', {
        canBorrow: true,
        maxBorrowAmount: finalMaxBorrow,
        availableToken: availableTokenToBorrow.info.symbol,
        collateralToken: collateralToken.info.symbol,
        liquidityWarning
      });
      
      setBorrowingState({
        canBorrow: true,
        availableTokenToBorrow,
        maxBorrowAmount: finalMaxBorrow,
        collateralToken,
        borrowableToken: availableTokenToBorrow,
        error: liquidityWarning,
        loading: false
      });

    } catch (error) {
      console.error('Error checking borrowing availability:', error);
      setBorrowingState({
        canBorrow: false,
        availableTokenToBorrow: null,
        maxBorrowAmount: '0',
        collateralToken: null,
        borrowableToken: null,
        error: `Error checking borrowing availability: ${error.message}`,
        loading: false
      });
    }
  };

  // NEW: Check withdrawal availability with collateral constraint validation
// NEW: Check withdrawal availability with FIXED decimal handling
const checkWithdrawalAvailability = async () => {
  if (!selectedPool || !account || !DeLexContract) {
    resetWithdrawalState();
    return;
  }

  try {
    setWithdrawalState(prev => ({ ...prev, loading: true, error: null }));
    console.log('Checking withdrawal availability for pool:', selectedPool.id);
    
    const position = await DeLexContract.getUserPosition(account, selectedPool.id);
    const collateralFactor = await DeLexContract.COLLATERAL_FACTOR();
    
    // Check if user has any collateral
    const hasCollateralA = position.collateralA.gt(0);
    const hasCollateralB = position.collateralB.gt(0);
    
    if (!hasCollateralA && !hasCollateralB) {
      setWithdrawalState({
        canWithdraw: false,
        withdrawableTokens: [],
        maxWithdrawableAmounts: {},
        selectedWithdrawToken: null,
        withdrawAmount: '',
        loading: false,
        error: 'No collateral deposited in this pool'
      });
      return;
    }

    const withdrawableTokens = [];
    const maxWithdrawableAmounts = {};
    
    // FIXED: Use contract's built-in functions for value calculations
    const totalBorrowedValue = await DeLexContract.getBorrowValue(account, selectedPool.id);
    const totalCollateralValue = await DeLexContract.getCollateralValue(account, selectedPool.id);
    
    console.log('Contract values:', {
      totalBorrowedValue: ethers.utils.formatEther(totalBorrowedValue),
      totalCollateralValue: ethers.utils.formatEther(totalCollateralValue),
      collateralFactor: ethers.utils.formatEther(collateralFactor)
    });
    
    // If user has collateral in tokenA
    if (hasCollateralA) {
      let maxWithdrawableA = ethers.BigNumber.from(0);
      
      if (totalBorrowedValue.eq(0)) {
        // No debt, can withdraw all collateral
        maxWithdrawableA = position.collateralA;
      } else {
        // Has debt, must maintain collateral ratio
        const minRequiredCollateralValue = totalBorrowedValue.mul(ethers.constants.WeiPerEther).div(collateralFactor);
        
        if (totalCollateralValue.gt(minRequiredCollateralValue)) {
          const maxWithdrawableValue = totalCollateralValue.sub(minRequiredCollateralValue);
          
          // Convert the withdrawable value back to tokenA amount
          // Since we're using 1:1 value ratio, this is straightforward
          const collateralAValue = ethers.utils.parseEther(
            ethers.utils.formatUnits(position.collateralA, selectedPool.tokenAInfo.decimals)
          );
          
          if (maxWithdrawableValue.gte(collateralAValue)) {
            maxWithdrawableA = position.collateralA;
          } else {
            // Calculate proportional amount
            const withdrawableRatio = maxWithdrawableValue.mul(ethers.constants.WeiPerEther).div(collateralAValue);
            maxWithdrawableA = position.collateralA.mul(withdrawableRatio).div(ethers.constants.WeiPerEther);
          }
        }
      }
      
      if (maxWithdrawableA.gt(0)) {
        // FIXED: Direct formatting without conversion
        const maxWithdrawableAmount = ethers.utils.formatUnits(maxWithdrawableA, selectedPool.tokenAInfo.decimals);
        
        withdrawableTokens.push({
          address: selectedPool.tokenA,
          info: selectedPool.tokenAInfo,
          currentCollateral: position.collateralA
        });
        
        maxWithdrawableAmounts[selectedPool.tokenA.toLowerCase()] = maxWithdrawableAmount;
        console.log(`TokenA withdrawable: ${maxWithdrawableAmount} ${selectedPool.tokenAInfo.symbol}`);
      }
    }
    
    // If user has collateral in tokenB
    if (hasCollateralB) {
      let maxWithdrawableB = ethers.BigNumber.from(0);
      
      if (totalBorrowedValue.eq(0)) {
        // No debt, can withdraw all collateral
        maxWithdrawableB = position.collateralB;
      } else {
        // Has debt, must maintain collateral ratio
        const minRequiredCollateralValue = totalBorrowedValue.mul(ethers.constants.WeiPerEther).div(collateralFactor);
        
        if (totalCollateralValue.gt(minRequiredCollateralValue)) {
          const maxWithdrawableValue = totalCollateralValue.sub(minRequiredCollateralValue);
          
          // Convert the withdrawable value back to tokenB amount
          // Since we're using 1:1 value ratio, this is straightforward
          const collateralBValue = ethers.utils.parseEther(
            ethers.utils.formatUnits(position.collateralB, selectedPool.tokenBInfo.decimals)
          );
          
          if (maxWithdrawableValue.gte(collateralBValue)) {
            maxWithdrawableB = position.collateralB;
          } else {
            // Calculate proportional amount
            const withdrawableRatio = maxWithdrawableValue.mul(ethers.constants.WeiPerEther).div(collateralBValue);
            maxWithdrawableB = position.collateralB.mul(withdrawableRatio).div(ethers.constants.WeiPerEther);
          }
        }
      }
      
      if (maxWithdrawableB.gt(0)) {
        // FIXED: Direct formatting without conversion
        const maxWithdrawableAmount = ethers.utils.formatUnits(maxWithdrawableB, selectedPool.tokenBInfo.decimals);
        
        withdrawableTokens.push({
          address: selectedPool.tokenB,
          info: selectedPool.tokenBInfo,
          currentCollateral: position.collateralB
        });
        
        maxWithdrawableAmounts[selectedPool.tokenB.toLowerCase()] = maxWithdrawableAmount;
        console.log(`TokenB withdrawable: ${maxWithdrawableAmount} ${selectedPool.tokenBInfo.symbol}`);
      }
    }
    
    console.log('Withdrawal availability check result:', {
      canWithdraw: withdrawableTokens.length > 0,
      withdrawableTokens: withdrawableTokens.map(t => t.info.symbol),
      maxWithdrawableAmounts
    });
    
    setWithdrawalState({
      canWithdraw: withdrawableTokens.length > 0,
      withdrawableTokens,
      maxWithdrawableAmounts,
      selectedWithdrawToken: withdrawableTokens.length > 0 ? withdrawableTokens[0] : null,
      withdrawAmount: '',
      loading: false,
      error: withdrawableTokens.length === 0 ? 'Cannot withdraw collateral - would make position undercollateralized' : null
    });

  } catch (error) {
    console.error('Error checking withdrawal availability:', error);
    setWithdrawalState({
      canWithdraw: false,
      withdrawableTokens: [],
      maxWithdrawableAmounts: {},
      selectedWithdrawToken: null,
      withdrawAmount: '',
      loading: false,
      error: `Error checking withdrawal availability: ${error.message}`
    });
  }
};
  // Reset functions
  const resetPoolStats = () => {
    setPoolStats({
      totalCollateralValue: ethers.BigNumber.from(0),
      totalBorrowedValue: ethers.BigNumber.from(0),
      totalAvailableToBorrow: ethers.BigNumber.from(0),
      healthFactor: ethers.BigNumber.from(0),
      collateralFactor: ethers.BigNumber.from(0),
      hasPosition: false
    });
    setSelectedPoolPosition(null);
  };

  const resetBorrowingState = () => {
    setBorrowingState({
      canBorrow: false,
      availableTokenToBorrow: null,
      maxBorrowAmount: '0',
      collateralToken: null,
      borrowableToken: null,
      error: null,
      loading: false
    });
  };

  // NEW: Withdraw collateral function with proper validation
  const withdrawCollateral = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount || !isValidAddress(selectedTokenAddress)) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!withdrawalState.canWithdraw) {
      toast.error(withdrawalState.error || 'No collateral available for withdrawal');
      return;
    }

    // Find the selected token in withdrawable tokens
    const selectedWithdrawToken = withdrawalState.withdrawableTokens.find(
      token => token.address.toLowerCase() === selectedTokenAddress.toLowerCase()
    );

    if (!selectedWithdrawToken) {
      toast.error('Selected token is not available for withdrawal');
      return;
    }

    const maxWithdrawable = withdrawalState.maxWithdrawableAmounts[selectedTokenAddress.toLowerCase()];
    const withdrawAmount = parseFloat(amount);
    const maxWithdrawableAmount = parseFloat(maxWithdrawable);

    if (withdrawAmount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    if (withdrawAmount > maxWithdrawableAmount) {
      toast.error(`Maximum withdrawable amount is ${maxWithdrawableAmount.toFixed(6)} ${selectedWithdrawToken.info.symbol}`);
      return;
    }

    try {
      setLoading(true);
      
      const tokenInfo = selectedWithdrawToken.info;
      const amountWei = ethers.utils.parseUnits(amount, tokenInfo.decimals);
      
      toast.loading(`Withdrawing ${tokenInfo.symbol}...`);
      const tx = await DeLexContract.withdrawCollateral(selectedPool.id, selectedTokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success(`Withdrawn: ${amount} ${tokenInfo.symbol}`);
      
      setAmount('');
      await loadData();
      await loadPoolSpecificStats();
      await checkBorrowingAvailability();
      await checkWithdrawalAvailability();
      
    } catch (error) {
      toast.dismiss();
      
      let errorMessage = 'Failed to withdraw collateral';
      
      if (error.message.includes('Would be undercollateralized')) {
        errorMessage = 'Cannot withdraw - would make your position undercollateralized';
      } else if (error.message.includes('Insufficient collateral')) {
        errorMessage = 'Insufficient collateral balance';
      } else if (error.message.includes('Invalid token')) {
        errorMessage = 'Selected token is not part of this pool';
      }
      
      toast.error(errorMessage);
      console.error('Withdraw error:', error);
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Enhanced borrow tokens with better validation and error handling
  const borrowTokens = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!borrowingState.canBorrow) {
      toast.error(borrowingState.error || 'You need to deposit collateral first to borrow from this pool');
      return;
    }

    if (!borrowingState.availableTokenToBorrow) {
      toast.error('No tokens available to borrow from this pool');
      return;
    }

    // Auto-set the correct token address if not set
    if (!selectedTokenAddress || selectedTokenAddress.toLowerCase() !== borrowingState.availableTokenToBorrow.address.toLowerCase()) {
      setSelectedTokenAddress(borrowingState.availableTokenToBorrow.address);
    }

    // Validate amount
    const borrowAmount = parseFloat(amount);
    const maxBorrowAmount = parseFloat(borrowingState.maxBorrowAmount);
    
    if (borrowAmount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    if (borrowAmount > maxBorrowAmount) {
      toast.error(`Maximum borrowable amount is ${maxBorrowAmount.toFixed(6)} ${borrowingState.availableTokenToBorrow.info.symbol}`);
      return;
    }
    
    try {
      setLoading(true);
      
      const tokenInfo = borrowingState.availableTokenToBorrow.info;
      const amountWei = ethers.utils.parseUnits(amount, tokenInfo.decimals);
      
      toast.loading(`Borrowing ${tokenInfo.symbol}...`);
      const tx = await DeLexContract.borrow(selectedPool.id, borrowingState.availableTokenToBorrow.address, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success(`Borrowed: ${amount} ${tokenInfo.symbol}`);
      
      setAmount('');
      await loadData();
      await loadPoolSpecificStats();
      await checkBorrowingAvailability();
      await checkWithdrawalAvailability(); // NEW: Refresh withdrawal availability after borrowing
      
    } catch (error) {
      toast.dismiss();
      
      let errorMessage = 'Failed to borrow tokens';
      
      if (error.message.includes('Must deposit tokenB as collateral to borrow tokenA')) {
        errorMessage = 'You need to deposit the other token as collateral first';
      } else if (error.message.includes('Must deposit tokenA as collateral to borrow tokenB')) {
        errorMessage = 'You need to deposit the other token as collateral first';
      } else if (error.message.includes('Cannot borrow tokenA if you have tokenA as collateral')) {
        errorMessage = 'Cannot borrow the same token you deposited as collateral';
      } else if (error.message.includes('Cannot borrow tokenB if you have tokenB as collateral')) {
        errorMessage = 'Cannot borrow the same token you deposited as collateral';
      } else if (error.message.includes('Insufficient collateral')) {
        errorMessage = 'Insufficient collateral - deposit more collateral or borrow less';
      } else if (error.message.includes('Insufficient liquidity')) {
        errorMessage = 'Insufficient liquidity in the pool for this borrow amount';
      } else if (error.message.includes('execution reverted')) {
        errorMessage = 'Transaction failed - please check your collateral and try again';
      }
      
      toast.error(errorMessage);
      console.error('Borrow error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Repay tokens function (keeping existing implementation)
  const repayTokens = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount || !isValidAddress(selectedTokenAddress)) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      setLoading(true);
      
      const position = await DeLexContract.getUserPosition(account, selectedPool.id);
      const tokenInfo = await fetchTokenInfo(selectedTokenAddress);
      
      let borrowedAmount;
      if (selectedTokenAddress.toLowerCase() === selectedPool.tokenA.toLowerCase()) {
        borrowedAmount = position.borrowedA;
      } else if (selectedTokenAddress.toLowerCase() === selectedPool.tokenB.toLowerCase()) {
        borrowedAmount = position.borrowedB;
      } else {
        toast.error('Selected token is not part of this pool');
        return;
      }
      
      if (borrowedAmount.eq(0)) {
        toast.error(`You have no borrowed ${tokenInfo.symbol} to repay in this pool`);
        return;
      }
      
      const amountWei = ethers.utils.parseUnits(amount, tokenInfo.decimals);
      const borrowedFormatted = parseFloat(ethers.utils.formatUnits(borrowedAmount, tokenInfo.decimals));
      const repayAmountFormatted = parseFloat(amount);
      
      if (amountWei.gt(borrowedAmount)) {
        toast.error(`Cannot repay ${amount} ${tokenInfo.symbol}. You only borrowed ${borrowedFormatted.toFixed(4)} ${tokenInfo.symbol}`);
        return;
      }
      
      const userBalance = await getTokenBalance(selectedTokenAddress, account);
      const userBalanceFormatted = parseFloat(userBalance);
      
      if (repayAmountFormatted > userBalanceFormatted) {
        toast.error(`Insufficient balance. You have ${userBalanceFormatted.toFixed(4)} ${tokenInfo.symbol} but trying to repay ${amount} ${tokenInfo.symbol}`);
        return;
      }
      
      const currentAllowance = await getTokenAllowance(selectedTokenAddress, account, DeLexContract.address);
      const currentAllowanceWei = ethers.utils.parseUnits(currentAllowance, tokenInfo.decimals);
      
      if (currentAllowanceWei.lt(amountWei)) {
        toast.loading(`Approving ${tokenInfo.symbol}...`);
        const approveTx = await approveToken(selectedTokenAddress, DeLexContract.address, amount);
        await approveTx.wait();
      }
      
      toast.loading(`Repaying ${tokenInfo.symbol}...`);
      const tx = await DeLexContract.repay(selectedPool.id, selectedTokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success(`Repaid: ${amount} ${tokenInfo.symbol}`);
      
      setAmount('');
      await loadData();
      await loadPoolSpecificStats();
      await checkBorrowingAvailability();
      await checkWithdrawalAvailability(); // NEW: Refresh withdrawal availability after repaying
    } catch (error) {
      toast.dismiss();
      
      let errorMessage = 'Failed to repay tokens';
      
      if (error.message.includes('arithmetic underflow or overflow')) {
        errorMessage = 'Cannot repay more than you borrowed. Check your borrowed amount and try a smaller amount.';
      } else if (error.message.includes('ERC20InsufficientBalance')) {
        errorMessage = 'Insufficient token balance to complete repayment';
      } else if (error.message.includes('ERC20InsufficientAllowance')) {
        errorMessage = 'Token approval failed or insufficient allowance';
      } else if (error.message.includes('Invalid token')) {
        errorMessage = 'Selected token is not part of this pool';
      }
      
      toast.error(errorMessage);
      console.error('Repay error:', error);
    } finally {
      setLoading(false);
    }
  }; 

  const resetWithdrawalState = () => {
    setWithdrawalState({
      canWithdraw: false,
      withdrawableTokens: [],
      maxWithdrawableAmounts: {},
      selectedWithdrawToken: null,
      withdrawAmount: '',
      loading: false,
      error: null
    });
  };

  // FIXED: Enhanced deposit collateral with better validation
  const depositCollateral = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount || !isValidAddress(selectedTokenAddress)) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      setLoading(true);
      
      const tokenInfo = await fetchTokenInfo(selectedTokenAddress);
      const amountWei = ethers.utils.parseUnits(amount, tokenInfo.decimals);
      
      // Check if this token is part of the selected pool
      const isValidToken = selectedTokenAddress.toLowerCase() === selectedPool.tokenA.toLowerCase() || 
                          selectedTokenAddress.toLowerCase() === selectedPool.tokenB.toLowerCase();
      
      if (!isValidToken) {
        toast.error('Token must be part of the selected pool');
        return;
      }
      
      // Check user balance
      const userBalance = await getTokenBalance(selectedTokenAddress, account);
      const userBalanceBN = ethers.utils.parseUnits(userBalance, tokenInfo.decimals);
      
      if (amountWei.gt(userBalanceBN)) {
        toast.error(`Insufficient balance. You have ${userBalance} ${tokenInfo.symbol}`);
        return;
      }
      
      // Check allowance and approve if needed
      const currentAllowance = await getTokenAllowance(selectedTokenAddress, account, DeLexContract.address);
      const currentAllowanceWei = ethers.utils.parseUnits(currentAllowance, tokenInfo.decimals);
      
      if (currentAllowanceWei.lt(amountWei)) {
        toast.loading(`Approving ${tokenInfo.symbol}...`);
        const approveTx = await approveToken(selectedTokenAddress, DeLexContract.address, amount);
        await approveTx.wait();
      }
      
      toast.loading('Depositing collateral...');
      const tx = await DeLexContract.depositCollateral(selectedPool.id, selectedTokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success(`Collateral deposited: ${amount} ${tokenInfo.symbol}`);
      
      setAmount('');
      await loadData();
      await loadPoolSpecificStats();
      await checkBorrowingAvailability();
      await checkWithdrawalAvailability(); // NEW: Refresh withdrawal availability
    } catch (error) {
      toast.dismiss();
      
      let errorMessage = 'Failed to deposit collateral';
      
      if (error.message.includes('Cannot deposit tokenA as collateral if you have tokenB position')) {
        errorMessage = 'Cannot deposit this token as collateral - you already have a position with the other token in this pool';
      } else if (error.message.includes('Cannot deposit tokenB as collateral if you have tokenA position')) {
        errorMessage = 'Cannot deposit this token as collateral - you already have a position with the other token in this pool';
      } else if (error.message.includes('ERC20InsufficientBalance')) {
        errorMessage = 'Insufficient token balance';
      } else if (error.message.includes('ERC20InsufficientAllowance')) {
        errorMessage = 'Token approval failed';
      }
      
      toast.error(errorMessage);
      console.error('Deposit error:', error);
    } finally {
      setLoading(false);
    }
  };
// Utility functions
  const formatAmount = (amount, decimals = 18) => {
    try {
      const formatted = parseFloat(ethers.utils.formatUnits(amount, decimals));
      return formatted > 0 ? formatted.toFixed(4) : '0';
    } catch (error) {
      console.error('Error formatting amount:', error);
      return '0';
    }
  };

  const formatValue = (value) => {
    try {
      const formatted = parseFloat(ethers.utils.formatEther(value));
      return formatted.toFixed(2);
    } catch (error) {
      console.error('Error formatting value:', error);
      return '0.00';
    }
  };

  const getAvailableTokens = () => {
    if (!selectedPool) return [];
    return [
      { address: selectedPool.tokenA, info: selectedPool.tokenAInfo },
      { address: selectedPool.tokenB, info: selectedPool.tokenBInfo }
    ];
  };

  const getHealthFactorColor = (healthFactor) => {
    if (healthFactor === 'Safe' || healthFactor === 'Error' || healthFactor === 'Unknown') return 'text-neon-green';
    const factor = parseFloat(healthFactor);
    if (isNaN(factor)) return 'text-gray-400';
    if (factor > 2) return 'text-neon-green';
    if (factor > 1.5) return 'text-laser-orange';
    return 'text-hot-pink';
  };

  const formatHealthFactor = (healthFactor) => {
    if (healthFactor.eq(0)) return 'Safe';
    try {
      const formatted = parseFloat(ethers.utils.formatEther(healthFactor));
      if (formatted > 1000000) return 'Safe';
      return formatted.toFixed(2);
    } catch (error) {
      return 'Error';
    }
  };

  // Early returns for loading states
  if (!contractsReady || !signer) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-center items-center py-12">
          <div className="text-electric-purple font-cyber text-lg animate-pulse">
            Initializing contracts...
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="cyber-card border-laser-orange rounded-xl p-8 text-center">
            <div className="text-laser-orange font-cyber text-lg mb-4">
              Wallet Not Connected
            </div>
            <p className="text-gray-400">Please connect your wallet to access lending features</p>
          </div>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-center items-center py-12">
          <div className="text-neon-green font-cyber text-lg animate-pulse">
            Loading lending data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Tab Navigation - ENHANCED: Added Withdraw tab */}
      <div className="flex mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-6 py-3 font-cyber text-lg rounded-l-lg transition-all whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-cyber-blue text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('deposit')}
          className={`px-6 py-3 font-cyber text-lg transition-all whitespace-nowrap ${
            activeTab === 'deposit'
              ? 'bg-neon-green text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`px-6 py-3 font-cyber text-lg transition-all whitespace-nowrap ${
            activeTab === 'withdraw'
              ? 'bg-laser-orange text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Withdraw
        </button>
        <button
          onClick={() => setActiveTab('borrow')}
          className={`px-6 py-3 font-cyber text-lg transition-all whitespace-nowrap ${
            activeTab === 'borrow'
              ? 'bg-electric-purple text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Borrow
        </button>
        <button
          onClick={() => setActiveTab('repay')}
          className={`px-6 py-3 font-cyber text-lg rounded-r-lg transition-all whitespace-nowrap ${
            activeTab === 'repay'
              ? 'bg-hot-pink text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Repay
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Pool Selection for Dashboard */}
          <div className="cyber-card border-cyber-blue rounded-xl p-6 thin-neon-border">
            <h3 className="text-xl font-cyber text-cyber-blue mb-4">Select Pool for Detailed View</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pools.map(pool => (
                <button
                  key={pool.id}
                  onClick={() => setSelectedPool(pool)}
                  className={`p-4 border rounded-lg transition-all ${
                    selectedPool?.id === pool.id
                      ? 'border-neon-green bg-neon-green bg-opacity-20 text-neon-green'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="font-cyber text-lg">
                    {pool.tokenAInfo.symbol} / {pool.tokenBInfo.symbol}
                  </div>
                  <div className="text-xs opacity-75">
                    TVL: ${(parseFloat(ethers.utils.formatEther(pool.reserveA)) + parseFloat(ethers.utils.formatEther(pool.reserveB))).toFixed(2)}
                  </div>
                  {selectedPool?.id === pool.id && (
                    <div className="text-xs font-bold mt-1">SELECTED</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Pool-Specific Overview Stats */}
          {selectedPool && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="cyber-card border-neon-green rounded-xl p-4 text-center thin-neon-border">
                <div className="text-2xl font-cyber text-neon-green mb-1">
                  ${formatValue(poolStats.totalCollateralValue)}
                </div>
                <div className="text-gray-400 text-sm">Your Collateral</div>
                <div className="text-gray-500 text-xs mt-1">in {selectedPool.tokenAInfo.symbol}/{selectedPool.tokenBInfo.symbol}</div>
              </div>
              <div className="cyber-card border-hot-pink rounded-xl p-4 text-center thin-neon-border">
                <div className="text-2xl font-cyber text-hot-pink mb-1">
                  ${formatValue(poolStats.totalBorrowedValue)}
                </div>
                <div className="text-gray-400 text-sm">Your Borrowed</div>
                <div className="text-gray-500 text-xs mt-1">in {selectedPool.tokenAInfo.symbol}/{selectedPool.tokenBInfo.symbol}</div>
              </div>
              <div className="cyber-card border-electric-purple rounded-xl p-4 text-center thin-neon-border">
                <div className="text-2xl font-cyber text-electric-purple mb-1">
                  ${formatValue(poolStats.totalAvailableToBorrow)}
                </div>
                <div className="text-gray-400 text-sm">Available to Borrow</div>
                <div className="text-gray-500 text-xs mt-1">from this pool</div>
              </div>
              <div className="cyber-card border-laser-orange rounded-xl p-4 text-center thin-neon-border">
                <div className={`text-2xl font-cyber mb-1 ${getHealthFactorColor(formatHealthFactor(poolStats.healthFactor))}`}>
                  {formatHealthFactor(poolStats.healthFactor)}
                </div>
                <div className="text-gray-400 text-sm">Health Factor</div>
                <div className="text-gray-500 text-xs mt-1">for this pool</div>
              </div>
            </div>
          )}

          {/* Borrowing Instructions for Selected Pool */}
          {selectedPool && borrowingState.canBorrow && (
            <div className="cyber-card border-electric-purple rounded-xl p-6 thin-neon-border">
              <h3 className="text-xl font-cyber text-electric-purple mb-4">Borrowing Available</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400 mb-2">Your Collateral:</div>
                  <div className="text-neon-green font-cyber">
                    {borrowingState.collateralToken && formatAmount(
                      borrowingState.collateralToken.amount, 
                      borrowingState.collateralToken.info.decimals
                    )} {borrowingState.collateralToken?.info.symbol}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-2">Available to Borrow:</div>
                  <div className="text-hot-pink font-cyber">
                    Up to {parseFloat(borrowingState.maxBorrowAmount).toFixed(4)} {borrowingState.availableTokenToBorrow?.info.symbol}
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-900 rounded-lg">
                <div className="text-cyber-blue text-sm font-cyber mb-1">Cross-Token Borrowing Rule:</div>
                <div className="text-gray-400 text-xs">
                  You deposited {borrowingState.collateralToken?.info.symbol} as collateral, so you can only borrow {borrowingState.availableTokenToBorrow?.info.symbol} from this pool.
                </div>
              </div>
            </div>
          )}

          {/* NEW: Withdrawal Information for Selected Pool */}
          {selectedPool && withdrawalState.canWithdraw && (
            <div className="cyber-card border-laser-orange rounded-xl p-6 thin-neon-border">
              <h3 className="text-xl font-cyber text-laser-orange mb-4">Collateral Withdrawal Available</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {withdrawalState.withdrawableTokens.map(token => (
                  <div key={token.address} className="p-3 bg-gray-900 rounded-lg">
                    <div className="text-sm text-gray-400 mb-2">{token.info.symbol} Collateral:</div>
                    <div className="text-neon-green font-cyber mb-1">
                      Deposited: {formatAmount(token.currentCollateral, token.info.decimals)} {token.info.symbol}
                    </div>
                    <div className="text-laser-orange font-cyber">
                      Max Withdrawable: {parseFloat(withdrawalState.maxWithdrawableAmounts[token.address.toLowerCase()]).toFixed(4)} {token.info.symbol}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-gray-900 rounded-lg">
                <div className="text-laser-orange text-sm font-cyber mb-1">Withdrawal Safety Rule:</div>
                <div className="text-gray-400 text-xs">
                  You can only withdraw collateral that won't make your position undercollateralized. Remaining collateral must cover your borrowed amount.
                </div>
              </div>
            </div>
          )}

          {/* No Position Message */}
          {selectedPool && !poolStats.hasPosition && (
            <div className="cyber-card border-gray-600 rounded-xl p-8 text-center">
              <div className="text-gray-400 font-cyber text-lg mb-4">
                No Position in {selectedPool.tokenAInfo.symbol}/{selectedPool.tokenBInfo.symbol}
              </div>
              <p className="text-gray-500 text-sm mb-6">
                You haven't deposited any collateral or borrowed any tokens from this pool yet.
              </p>
              <button
                onClick={() => setActiveTab('deposit')}
                className="px-6 py-3 bg-neon-green text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
              >
                Deposit Collateral to Start
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Tabs (Deposit, Withdraw, Borrow, Repay) */}
      {activeTab !== 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Action Panel */}
          <div className="cyber-card border-cyber-blue rounded-xl p-6 pencil-effect">
            <h2 className="text-2xl font-cyber text-neon-green mb-6 text-center animate-glow">
              {activeTab === 'deposit' && 'Deposit Collateral'}
              {activeTab === 'withdraw' && 'Withdraw Collateral'}
              {activeTab === 'borrow' && 'Borrow Tokens'}
              {activeTab === 'repay' && 'Repay Tokens'}
            </h2>

            {/* Pool Selection */}
            <div className="mb-4">
              <label className="text-gray-300 font-cyber mb-2 block">Select Pool:</label>
              <select
                value={selectedPool?.id || ''}
                onChange={(e) => {
                  const pool = pools.find(p => p.id === e.target.value);
                  setSelectedPool(pool);
                  setSelectedTokenAddress(''); // Reset token selection
                  setAmount(''); // Reset amount
                }}
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
              >
                <option value="">Select a pool</option>
                {pools.map(pool => (
                  <option key={pool.id} value={pool.id}>
                    {pool.tokenAInfo.symbol} / {pool.tokenBInfo.symbol}
                  </option>
                ))}
              </select>
            </div>

            {/* ENHANCED: Withdraw Token Display */}
            {selectedPool && activeTab === 'withdraw' && (
              <div className="mb-4">
                <label className="text-gray-300 font-cyber mb-2 block">Available for Withdrawal:</label>
                
                {withdrawalState.loading ? (
                  <div className="p-3 border border-laser-orange rounded-lg bg-laser-orange bg-opacity-10">
                    <div className="text-laser-orange font-cyber text-sm animate-pulse">
                      Checking withdrawal availability...
                    </div>
                  </div>
                ) : withdrawalState.canWithdraw ? (
                  <div className="space-y-2">
                    {withdrawalState.withdrawableTokens.map(token => (
                      <div 
                        key={token.address}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedTokenAddress === token.address
                            ? 'border-laser-orange bg-laser-orange bg-opacity-20'
                            : 'border-gray-600 hover:border-laser-orange bg-gray-900'
                        }`}
                        onClick={() => setSelectedTokenAddress(token.address)}
                      >
                        <div className="text-laser-orange font-cyber text-lg">
                          {token.info.symbol}
                        </div>
                        <div className="text-gray-400 text-sm">
                          Deposited: {formatAmount(token.currentCollateral, token.info.decimals)} {token.info.symbol}
                        </div>
                        <div className="text-gray-400 text-sm">
                          Max Withdrawable: {parseFloat(withdrawalState.maxWithdrawableAmounts[token.address.toLowerCase()]).toFixed(6)} {token.info.symbol}
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          Token: {token.address.slice(0, 8)}...
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 border border-red-500 rounded-lg bg-red-900 bg-opacity-20">
                    <div className="text-red-400 font-cyber text-sm">
                      {withdrawalState.error || 'No collateral available for withdrawal'}
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                      Deposit collateral first or repay loans to free up collateral
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FIXED: Enhanced Borrow Token Display */}
            {selectedPool && activeTab === 'borrow' && (
              <div className="mb-4">
                <label className="text-gray-300 font-cyber mb-2 block">Available to Borrow:</label>
                
                {borrowingState.loading ? (
                  <div className="p-3 border border-electric-purple rounded-lg bg-electric-purple bg-opacity-10">
                    <div className="text-electric-purple font-cyber text-sm animate-pulse">
                      Checking borrowing availability...
                    </div>
                  </div>
                ) : borrowingState.canBorrow ? (
                  <div className="p-3 border border-electric-purple rounded-lg bg-electric-purple bg-opacity-20">
                    <div className="text-electric-purple font-cyber text-lg">
                      {borrowingState.availableTokenToBorrow.info.symbol}
                    </div>
                    <div className="text-gray-400 text-sm">
                      Max: {parseFloat(borrowingState.maxBorrowAmount).toFixed(6)} {borrowingState.availableTokenToBorrow.info.symbol}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      Token: {borrowingState.availableTokenToBorrow.address.slice(0, 8)}...
                    </div>
                    <div className="text-gray-500 text-xs">
                      Collateral: {borrowingState.collateralToken?.info.symbol}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 border border-red-500 rounded-lg bg-red-900 bg-opacity-20">
                    <div className="text-red-400 font-cyber text-sm">
                      {borrowingState.error || 'No borrowing available'}
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                      Deposit collateral first to enable borrowing
                    </div>
                  </div>
                )}

                {/* Display borrowing error/warning */}
                {borrowingState.error && borrowingState.canBorrow && (
                  <div className="mt-2 p-2 bg-yellow-900 bg-opacity-30 border border-yellow-500 rounded-lg">
                    <div className="text-yellow-400 text-xs">
                      ⚠️ {borrowingState.error}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Token Selection for Deposit and Repay */}
            {selectedPool && (activeTab === 'deposit' || activeTab === 'repay') && (
              <div className="mb-4">
                <label className="text-gray-300 font-cyber mb-2 block">Select Token:</label>
                <div className="grid grid-cols-2 gap-2">
                  {getAvailableTokens().map(({ address, info }) => (
                    <button
                      key={address}
                      onClick={() => setSelectedTokenAddress(address)}
                      className={`p-3 border rounded-lg font-cyber text-sm transition-all ${
                        selectedTokenAddress === address
                          ? 'border-cyber-blue bg-cyber-blue bg-opacity-20 text-cyber-blue'
                          : 'border-gray-600 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <div className="font-bold">{info.symbol}</div>
                      <div className="text-xs opacity-75">{address.slice(0, 8)}...</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="mb-6">
              <label className="text-gray-300 font-cyber mb-2 block">Amount:</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
              />
              
              {/* ENHANCED: Withdraw Limits Display with Percentage Buttons */}
              {activeTab === 'withdraw' && withdrawalState.canWithdraw && selectedTokenAddress && (
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">
                      Max: {parseFloat(withdrawalState.maxWithdrawableAmounts[selectedTokenAddress.toLowerCase()] || '0').toFixed(6)} {withdrawalState.withdrawableTokens.find(t => t.address.toLowerCase() === selectedTokenAddress.toLowerCase())?.info.symbol}
                    </span>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          const maxAmount = parseFloat(withdrawalState.maxWithdrawableAmounts[selectedTokenAddress.toLowerCase()] || '0');
                          setAmount((maxAmount * 0.25).toFixed(6));
                        }}
                        className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                      >
                        25%
                      </button>
                      <button
                        onClick={() => {
                          const maxAmount = parseFloat(withdrawalState.maxWithdrawableAmounts[selectedTokenAddress.toLowerCase()] || '0');
                          setAmount((maxAmount * 0.5).toFixed(6));
                        }}
                        className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                      >
                        50%
                      </button>
                      <button
                        onClick={() => {
                          const maxAmount = parseFloat(withdrawalState.maxWithdrawableAmounts[selectedTokenAddress.toLowerCase()] || '0');
                          setAmount((maxAmount * 0.75).toFixed(6));
                        }}
                        className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                      >
                        75%
                      </button>
                      <button
                        onClick={() => {
                          const maxAmount = withdrawalState.maxWithdrawableAmounts[selectedTokenAddress.toLowerCase()] || '0';
                          setAmount(maxAmount);
                        }}
                        className="px-2 py-1 bg-laser-orange text-black text-xs rounded hover:bg-opacity-80"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  
                  {/* Amount validation for withdraw */}
                  {amount && withdrawalState.canWithdraw && selectedTokenAddress && (
                    <div className="text-xs">
                      {parseFloat(amount) > parseFloat(withdrawalState.maxWithdrawableAmounts[selectedTokenAddress.toLowerCase()] || '0') ? (
                        <span className="text-red-400">
                          ❌ Amount exceeds maximum withdrawable
                        </span>
                      ) : parseFloat(amount) > 0 ? (
                        <span className="text-neon-green">
                          ✅ Valid withdrawal amount
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
              
              {/* FIXED: Enhanced Borrow Limits Display */}
              {activeTab === 'borrow' && borrowingState.canBorrow && (
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">
                      Max: {parseFloat(borrowingState.maxBorrowAmount).toFixed(6)} {borrowingState.availableTokenToBorrow?.info.symbol}
                    </span>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => setAmount((parseFloat(borrowingState.maxBorrowAmount) * 0.25).toFixed(6))}
                        className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                      >
                        25%
                      </button>
                      <button
                        onClick={() => setAmount((parseFloat(borrowingState.maxBorrowAmount) * 0.5).toFixed(6))}
                        className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                      >
                        50%
                      </button>
                      <button
                        onClick={() => setAmount((parseFloat(borrowingState.maxBorrowAmount) * 0.75).toFixed(6))}
                        className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                      >
                        75%
                      </button>
                      <button
                        onClick={() => setAmount(borrowingState.maxBorrowAmount)}
                        className="px-2 py-1 bg-electric-purple text-black text-xs rounded hover:bg-opacity-80"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  
                  {/* Amount validation for borrow */}
                  {amount && borrowingState.canBorrow && (
                    <div className="text-xs">
                      {parseFloat(amount) > parseFloat(borrowingState.maxBorrowAmount) ? (
                        <span className="text-red-400">
                          ❌ Amount exceeds maximum borrowable
                        </span>
                      ) : parseFloat(amount) > 0 ? (
                        <span className="text-neon-green">
                          ✅ Valid borrow amount
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ENHANCED: Cross-token Information for Withdraw */}
            {activeTab === 'withdraw' && selectedPool && withdrawalState.canWithdraw && (
              <div className="mb-4 p-3 bg-gray-900 rounded-lg">
                <div className="text-laser-orange text-sm font-cyber mb-2">
                  🔒 Collateral Safety Rules
                </div>
                <div className="text-gray-400 text-xs space-y-1">
                  <div>• Remaining collateral must cover your borrowed amount</div>
                  <div>• Withdrawal cannot make your position undercollateralized</div>
                  <div>• Collateral factor: {parseFloat(ethers.utils.formatEther(poolStats.collateralFactor)).toFixed(0)}%</div>
                  {poolStats.totalBorrowedValue.gt(0) && (
                    <div className="text-hot-pink">
                      ⚠️ You have ${formatValue(poolStats.totalBorrowedValue)} borrowed - withdrawal limited
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FIXED: Enhanced Cross-token Borrowing Information */}
            {activeTab === 'borrow' && selectedPool && (
              <div className="mb-4 p-3 bg-gray-900 rounded-lg">
                <div className="text-cyber-blue text-sm font-cyber mb-2">
                  🔄 Cross-Token Borrowing Rules
                </div>
                <div className="text-gray-400 text-xs space-y-1">
                  <div>• You can only borrow the token you didn't deposit as collateral</div>
                  <div>• Deposit {selectedPool.tokenAInfo.symbol} → Borrow {selectedPool.tokenBInfo.symbol}</div>
                  <div>• Deposit {selectedPool.tokenBInfo.symbol} → Borrow {selectedPool.tokenAInfo.symbol}</div>
                  {borrowingState.canBorrow && (
                    <div className="text-neon-green">
                      ✅ You can borrow {borrowingState.availableTokenToBorrow?.info.symbol} (collateral: {borrowingState.collateralToken?.info.symbol})
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ENHANCED: Action Button */}
            <button
              onClick={() => {
                if (activeTab === 'deposit') depositCollateral();
                else if (activeTab === 'withdraw') withdrawCollateral();
                else if (activeTab === 'borrow') borrowTokens();
                else if (activeTab === 'repay') repayTokens();
              }}
              disabled={loading || !account || !selectedPool || 
                       (activeTab === 'borrow' && (!borrowingState.canBorrow || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(borrowingState.maxBorrowAmount))) ||
                       (activeTab === 'withdraw' && (!withdrawalState.canWithdraw || !amount || parseFloat(amount) <= 0 || !selectedTokenAddress || parseFloat(amount) > parseFloat(withdrawalState.maxWithdrawableAmounts[selectedTokenAddress.toLowerCase()] || '0'))) ||
                       ((activeTab === 'deposit' || activeTab === 'repay') && (!amount || !isValidAddress(selectedTokenAddress)))}
              className={`w-full py-3 font-cyber text-lg rounded-lg transition-all neon-border disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === 'deposit' ? 'bg-neon-green border-neon-green text-black hover:bg-opacity-80' :
                activeTab === 'withdraw' ? 'bg-laser-orange border-laser-orange text-black hover:bg-opacity-80' :
                activeTab === 'borrow' ? 'bg-electric-purple border-electric-purple text-black hover:bg-opacity-80' :
                'bg-hot-pink border-hot-pink text-black hover:bg-opacity-80'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                activeTab === 'deposit' ? 'Deposit Collateral' :
                activeTab === 'withdraw' ? (
                  !selectedPool ? 'Select Pool First' :
                  !withdrawalState.canWithdraw ? 'No Collateral to Withdraw' :
                  !selectedTokenAddress ? 'Select Token' :
                  !amount ? 'Enter Amount' :
                  parseFloat(amount) <= 0 ? 'Enter Valid Amount' :
                  parseFloat(amount) > parseFloat(withdrawalState.maxWithdrawableAmounts[selectedTokenAddress.toLowerCase()] || '0') ? 'Amount Too High' :
                  `Withdraw ${withdrawalState.withdrawableTokens.find(t => t.address.toLowerCase() === selectedTokenAddress.toLowerCase())?.info.symbol || 'Collateral'}`
                ) :
                activeTab === 'borrow' ? (
                  !selectedPool ? 'Select Pool First' :
                  !borrowingState.canBorrow ? 'Deposit Collateral First' :
                  !amount ? 'Enter Amount' :
                  parseFloat(amount) <= 0 ? 'Enter Valid Amount' :
                  parseFloat(amount) > parseFloat(borrowingState.maxBorrowAmount) ? 'Amount Too High' :
                  `Borrow ${borrowingState.availableTokenToBorrow?.info.symbol || 'Tokens'}`
                ) : 'Repay Tokens'
              )}
            </button>

            {/* ENHANCED: Instructions */}
            <div className="mt-6 p-4 bg-gray-900 rounded-lg">
              <h4 className="text-cyber-blue font-cyber text-sm mb-2">
                {activeTab === 'deposit' && 'Deposit Instructions:'}
                {activeTab === 'withdraw' && 'Withdraw Instructions:'}
                {activeTab === 'borrow' && 'Borrowing Instructions:'}
                {activeTab === 'repay' && 'Repayment Instructions:'}
              </h4>
              <ul className="text-gray-400 text-xs space-y-1">
                {activeTab === 'deposit' && (
                  <>
                    <li>1. Select a pool with tokens you want to deposit</li>
                    <li>2. Choose which token to deposit as collateral</li>
                    <li>3. Enter the amount to deposit</li>
                    <li>4. Approve and deposit your collateral</li>
                    <li>5. You can then borrow the other token from the pool</li>
                  </>
                )}
                {activeTab === 'withdraw' && (
                  <>
                    <li>1. Select a pool where you have collateral deposited</li>
                    <li>2. Choose which collateral token to withdraw</li>
                    <li>3. Use percentage buttons or enter custom amount</li>
                    <li>4. System ensures withdrawal won't undercollateralize position</li>
                    <li>5. Withdrawn tokens will be sent to your wallet</li>
                  </>
                )}
                {activeTab === 'borrow' && (
                  <>
                    <li>1. Select a pool where you have collateral deposited</li>
                    <li>2. System will show which token you can borrow</li>
                    <li>3. Enter amount to borrow (up to your limit)</li>
                    <li>4. Borrowed tokens will be sent to your wallet</li>
                    <li>5. Remember: you can only borrow the token you didn't deposit</li>
                  </>
                )}
                {activeTab === 'repay' && (
                  <>
                    <li>1. Select the pool where you have borrowed tokens</li>
                    <li>2. Choose which borrowed token to repay</li>
                    <li>3. Enter amount to repay (max: your borrowed amount)</li>
                    <li>4. Approve and repay to reduce your debt</li>
                    <li>5. Repaying improves your health factor and frees collateral</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* ENHANCED: Pool Summary Panel */}
          <div className="cyber-card border-laser-orange rounded-xl p-6 pencil-effect">
            <h3 className="text-xl font-cyber text-laser-orange mb-4 animate-glow">
              {selectedPool ? `${selectedPool.tokenAInfo.symbol}/${selectedPool.tokenBInfo.symbol} Pool Summary` : 'Select Pool for Summary'}
            </h3>
            
            {selectedPool ? (
              <div className="space-y-4">
                {/* Pool-Specific Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-900 rounded-lg">
                    <div className="text-neon-green font-cyber text-lg">
                      ${formatValue(poolStats.totalCollateralValue)}
                    </div>
                    <div className="text-gray-400 text-xs">Your Collateral</div>
                  </div>
                  <div className="p-3 bg-gray-900 rounded-lg">
                    <div className="text-hot-pink font-cyber text-lg">
                      ${formatValue(poolStats.totalBorrowedValue)}
                    </div>
                    <div className="text-gray-400 text-xs">Your Borrowed</div>
                  </div>
                </div>
                
                <div className="p-3 bg-gray-900 rounded-lg">
                  <div className="text-electric-purple font-cyber text-lg">
                    ${formatValue(poolStats.totalAvailableToBorrow)}
                  </div>
                  <div className="text-gray-400 text-xs">Available to Borrow</div>
                </div>
                
                <div className="p-3 bg-gray-900 rounded-lg">
                  <div className={`font-cyber text-lg ${getHealthFactorColor(formatHealthFactor(poolStats.healthFactor))}`}>
                    {formatHealthFactor(poolStats.healthFactor)}
                  </div>
                  <div className="text-gray-400 text-xs">Health Factor</div>
                </div>

                {/* ENHANCED: Withdrawal Status Display */}
                {activeTab === 'withdraw' && (
                  <div className="p-3 bg-gray-900 rounded-lg">
                    <div className="text-laser-orange font-cyber text-sm mb-2">
                      Withdrawal Status
                    </div>
                    {withdrawalState.loading ? (
                      <div className="text-gray-400 text-xs animate-pulse">
                        Checking availability...
                      </div>
                    ) : withdrawalState.canWithdraw ? (
                      <div className="space-y-1">
                        <div className="text-neon-green text-xs">
                          ✅ Can withdraw from {withdrawalState.withdrawableTokens.length} token(s)
                        </div>
                        {withdrawalState.withdrawableTokens.map(token => (
                          <div key={token.address} className="text-gray-400 text-xs">
                            Max {token.info.symbol}: {parseFloat(withdrawalState.maxWithdrawableAmounts[token.address.toLowerCase()]).toFixed(4)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-red-400 text-xs">
                        ❌ {withdrawalState.error || 'Cannot withdraw from this pool'}
                      </div>
                    )}
                  </div>
                )}

                {/* FIXED: Enhanced Borrowing Status Display */}
                {activeTab === 'borrow' && (
                  <div className="p-3 bg-gray-900 rounded-lg">
                    <div className="text-electric-purple font-cyber text-sm mb-2">
                      Borrowing Status
                    </div>
                    {borrowingState.loading ? (
                      <div className="text-gray-400 text-xs animate-pulse">
                        Checking availability...
                      </div>
                    ) : borrowingState.canBorrow ? (
                      <div className="space-y-1">
                        <div className="text-neon-green text-xs">
                          ✅ Can borrow {borrowingState.availableTokenToBorrow?.info.symbol}
                        </div>
                        <div className="text-gray-400 text-xs">
                          Max: {parseFloat(borrowingState.maxBorrowAmount).toFixed(4)} {borrowingState.availableTokenToBorrow?.info.symbol}
                        </div>
                        <div className="text-gray-400 text-xs">
                          Collateral: {borrowingState.collateralToken?.info.symbol}
                        </div>
                      </div>
                    ) : (
                      <div className="text-red-400 text-xs">
                        ❌ {borrowingState.error || 'Cannot borrow from this pool'}
                      </div>
                    )}
                  </div>
                )}

                {/* Enhanced Quick Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="w-full py-2 bg-cyber-blue text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all text-sm"
                  >
                    View Pool Dashboard
                  </button>
                  
                  {poolStats.totalAvailableToBorrow.gt(0) && borrowingState.canBorrow && (
                    <button
                      onClick={() => {
                        setActiveTab('borrow');
                        if (borrowingState.availableTokenToBorrow) {
                          setSelectedTokenAddress(borrowingState.availableTokenToBorrow.address);
                        }
                      }}
                      className="w-full py-2 bg-electric-purple text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all text-sm"
                    >
                      Borrow {borrowingState.availableTokenToBorrow?.info.symbol} (${formatValue(poolStats.totalAvailableToBorrow)} Available)
                    </button>
                  )}
                  
                  {withdrawalState.canWithdraw && (
                    <button
                      onClick={() => setActiveTab('withdraw')}
                      className="w-full py-2 bg-laser-orange text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all text-sm"
                    >
                      Withdraw Collateral ({withdrawalState.withdrawableTokens.length} Available)
                    </button>
                  )}
                  
                  {poolStats.totalBorrowedValue.gt(0) && (
                    <button
                      onClick={() => setActiveTab('repay')}
                      className="w-full py-2 bg-hot-pink text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all text-sm"
                    >
                      Repay Loans
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 font-cyber mb-4">
                  No Pool Selected
                </p>
                <p className="text-gray-500 text-sm">
                  Select a pool above to view detailed lending information and perform actions.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LendingInterface;
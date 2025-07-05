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

  // Borrowing state - FIXED for cross-token borrowing
  const [borrowingState, setBorrowingState] = useState({
    canBorrow: false,
    availableTokenToBorrow: null,
    maxBorrowAmount: '0',
    collateralToken: null,
    borrowableToken: null
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

  // FIXED: Initialize component when contracts are ready
  useEffect(() => {
    if (contractsReady && signer && !initialized) {
      console.log('Initializing lending interface...');
      setInitialized(true);
      if (account) {
        loadData();
      }
    }
  }, [contractsReady, signer, account, initialized]);

  // FIXED: Handle account changes after initialization
  useEffect(() => {
    if (initialized && account && DeLexContract) {
      console.log('Account connected after initialization, loading data...');
      loadData();
    }
  }, [initialized, account, DeLexContract]);

  // FIXED: Update pool-specific stats when selected pool changes
  useEffect(() => {
    if (initialized && selectedPool && account) {
      loadPoolSpecificStats();
      checkBorrowingAvailability();
    } else {
      resetPoolStats();
      resetBorrowingState();
    }
  }, [selectedPool, account, initialized]);

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

  // FIXED: Load user positions with better error handling
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

  // FIXED: Load pool-specific stats instead of global stats
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

  // FIXED: Check borrowing availability based on contract rules
// FIXED: Check borrowing availability with better pool liquidity handling
const checkBorrowingAvailability = async () => {
  if (!selectedPool || !account || !DeLexContract) {
    resetBorrowingState();
    return;
  }

  try {
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
      resetBorrowingState();
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
      resetBorrowingState();
      return;
    }
    
    // Format the max borrow amount using the correct token decimals
    const maxBorrowAmount = ethers.utils.formatUnits(
      contractResult.maxBorrowAmount,
      availableTokenToBorrow.info.decimals
    );
    
    console.log('Final borrowing state:', {
      canBorrow: true,
      maxBorrowAmount,
      availableToken: availableTokenToBorrow.info.symbol,
      collateralToken: collateralToken.info.symbol
    });
    
    setBorrowingState({
      canBorrow: true,
      availableTokenToBorrow,
      maxBorrowAmount,
      collateralToken,
      borrowableToken: availableTokenToBorrow
    });

    // Auto-select the available token for borrowing
    if (activeTab === 'borrow') {
      setSelectedTokenAddress(availableTokenToBorrow.address);
    }

  } catch (error) {
    console.error('Error checking borrowing availability:', error);
    resetBorrowingState();
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
      borrowableToken: null
    });
  };

  // Continue with other component code...
  // This is Part 1 - State and Initialization

  // FIXED: Deposit collateral with proper validation
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
    } catch (error) {
      toast.dismiss();
      
      let errorMessage = 'Failed to deposit collateral';
      
      if (error.message.includes('Cannot deposit tokenA as collateral if you have tokenB position')) {
        errorMessage = 'Cannot deposit this token as collateral - you already have a position with the other token in this pool';
      } else if (error.message.includes('Cannot deposit tokenB as collateral if you have tokenA position')) {
        errorMessage = 'Cannot deposit this token as collateral - you already have a position with the other token in this pool';
      }
      
      toast.error(errorMessage);
      console.error('Deposit error:', error);
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Borrow tokens with proper cross-token validation
  const borrowTokens = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount || !isValidAddress(selectedTokenAddress)) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!borrowingState.canBorrow) {
      toast.error('You need to deposit collateral first to borrow from this pool');
      return;
    }

    if (!borrowingState.availableTokenToBorrow || 
        selectedTokenAddress.toLowerCase() !== borrowingState.availableTokenToBorrow.address.toLowerCase()) {
      toast.error(`You can only borrow ${borrowingState.availableTokenToBorrow?.info?.symbol || 'the available token'} from this pool based on your collateral`);
      return;
    }
    
    try {
      setLoading(true);
      
      const tokenInfo = await fetchTokenInfo(selectedTokenAddress);
      const amountWei = ethers.utils.parseUnits(amount, tokenInfo.decimals);
      
      // Check if amount exceeds max borrowable
      if (parseFloat(amount) > parseFloat(borrowingState.maxBorrowAmount)) {
        toast.error(`Maximum borrowable amount is ${parseFloat(borrowingState.maxBorrowAmount).toFixed(4)} ${tokenInfo.symbol}`);
        return;
      }
      
      toast.loading(`Borrowing ${tokenInfo.symbol}...`);
      const tx = await DeLexContract.borrow(selectedPool.id, selectedTokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success(`Borrowed: ${amount} ${tokenInfo.symbol}`);
      
      setAmount('');
      await loadData();
      await loadPoolSpecificStats();
      await checkBorrowingAvailability();
      
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
      }
      
      toast.error(errorMessage);
      console.error('Borrow error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Repay tokens function
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

  // Modal functions
  const calculateMaxWithdrawable = async (poolId, tokenAddress, tokenInfo, currentCollateral) => {
    try {
      const position = await DeLexContract.getUserPosition(account, poolId);
      const pool = await DeLexContract.getPoolInfo(poolId);
      const collateralFactor = await DeLexContract.COLLATERAL_FACTOR();
      
      const [tokenAInfo, tokenBInfo] = await Promise.all([
        fetchTokenInfo(pool.tokenA),
        fetchTokenInfo(pool.tokenB)
      ]);
      
      const collateralA = parseFloat(ethers.utils.formatUnits(position.collateralA, tokenAInfo.decimals));
      const collateralB = parseFloat(ethers.utils.formatUnits(position.collateralB, tokenBInfo.decimals));
      const borrowedA = parseFloat(ethers.utils.formatUnits(position.borrowedA, tokenAInfo.decimals));
      const borrowedB = parseFloat(ethers.utils.formatUnits(position.borrowedB, tokenBInfo.decimals));
      
      const totalCollateralValue = collateralA + collateralB;
      const totalBorrowedValue = borrowedA + borrowedB;
      
      if (totalBorrowedValue === 0) {
        return ethers.utils.formatUnits(currentCollateral, tokenInfo.decimals);
      }
      
      const collateralFactorDecimal = parseFloat(ethers.utils.formatEther(collateralFactor));
      const minCollateralValue = totalBorrowedValue / collateralFactorDecimal;
      const safeMinCollateralValue = minCollateralValue * 1.1;
      
      if (totalCollateralValue <= safeMinCollateralValue) {
        return '0';
      }
      
      const maxWithdrawableValue = totalCollateralValue - safeMinCollateralValue;
      const currentCollateralFormatted = parseFloat(ethers.utils.formatUnits(currentCollateral, tokenInfo.decimals));
      const actualMaxWithdrawable = Math.min(maxWithdrawableValue, currentCollateralFormatted);
      
      return Math.max(0, actualMaxWithdrawable).toFixed(6);
    } catch (error) {
      console.error('Error calculating max withdrawable:', error);
      return '0';
    }
  };

  const calculateMaxRepayable = async (poolId, tokenAddress, tokenInfo) => {
    try {
      const position = await DeLexContract.getUserPosition(account, poolId);
      const pool = await DeLexContract.getPoolInfo(poolId);
      
      let borrowedAmount;
      if (tokenAddress.toLowerCase() === pool.tokenA.toLowerCase()) {
        borrowedAmount = position.borrowedA;
      } else if (tokenAddress.toLowerCase() === pool.tokenB.toLowerCase()) {
        borrowedAmount = position.borrowedB;
      } else {
        return { maxRepayable: '0', borrowed: '0' };
      }
      
      if (borrowedAmount.eq(0)) {
        return { maxRepayable: '0', borrowed: '0' };
      }
      
      const userBalance = await getTokenBalance(tokenAddress, account);
      const userBalanceWei = ethers.utils.parseUnits(userBalance, tokenInfo.decimals);
      
      const maxRepayableWei = borrowedAmount.gt(userBalanceWei) ? userBalanceWei : borrowedAmount;
      
      return {
        maxRepayable: ethers.utils.formatUnits(maxRepayableWei, tokenInfo.decimals),
        borrowed: ethers.utils.formatUnits(borrowedAmount, tokenInfo.decimals)
      };
    } catch (error) {
      console.error('Error calculating max repayable:', error);
      return { maxRepayable: '0', borrowed: '0' };
    }
  };

  // Withdrawal modal functions
  const openWithdrawalModal = async (position, tokenAddress, tokenInfo, currentCollateral) => {
    try {
      const maxWithdrawable = await calculateMaxWithdrawable(
        position.poolId, 
        tokenAddress, 
        tokenInfo, 
        currentCollateral
      );
      
      setWithdrawalModal({
        isOpen: true,
        position,
        tokenAddress,
        tokenInfo,
        maxWithdrawable,
        withdrawAmount: ''
      });
    } catch (error) {
      console.error('Error opening withdrawal modal:', error);
      toast.error('Failed to calculate withdrawal limits');
    }
  };

  const closeWithdrawalModal = () => {
    setWithdrawalModal({
      isOpen: false,
      position: null,
      tokenAddress: '',
      tokenInfo: null,
      maxWithdrawable: '0',
      withdrawAmount: ''
    });
  };

  const withdrawCollateral = async () => {
    const { position, tokenAddress, tokenInfo, withdrawAmount } = withdrawalModal;
    
    if (!account || !DeLexContract || !withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid withdrawal amount');
      return;
    }

    if (parseFloat(withdrawAmount) > parseFloat(withdrawalModal.maxWithdrawable)) {
      toast.error(`Maximum withdrawable amount is ${withdrawalModal.maxWithdrawable} ${tokenInfo.symbol}`);
      return;
    }
    
    try {
      setLoading(true);
      const amountWei = ethers.utils.parseUnits(withdrawAmount, tokenInfo.decimals);
      
      toast.loading(`Withdrawing ${withdrawAmount} ${tokenInfo.symbol}...`);
      const tx = await DeLexContract.withdrawCollateral(position.poolId, tokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success(`Collateral withdrawn: ${withdrawAmount} ${tokenInfo.symbol}`);
      
      closeWithdrawalModal();
      await loadData();
      await loadPoolSpecificStats();
      await checkBorrowingAvailability();
    } catch (error) {
      toast.dismiss();
      
      let errorMessage = 'Failed to withdraw collateral';
      
      if (error.message.includes('Would be undercollateralized')) {
        errorMessage = 'Withdrawal would make your position undercollateralized. Try withdrawing a smaller amount or repay some debt first.';
      } else if (error.message.includes('Insufficient collateral')) {
        errorMessage = 'You don\'t have enough collateral of this token to withdraw';
      } else if (error.message.includes('UNPREDICTABLE_GAS_LIMIT')) {
        errorMessage = 'Transaction would fail - withdrawal amount too high for current debt level';
      }
      
      toast.error(errorMessage);
      console.error('Withdraw error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Repayment modal functions
  const openRepaymentModal = async (position, tokenAddress, tokenInfo) => {
    try {
      const { maxRepayable, borrowed } = await calculateMaxRepayable(
        position.poolId, 
        tokenAddress, 
        tokenInfo
      );
      
      setRepaymentModal({
        isOpen: true,
        position,
        tokenAddress,
        tokenInfo,
        maxRepayable,
        currentBorrowed: borrowed,
        repayAmount: ''
      });
    } catch (error) {
      console.error('Error opening repayment modal:', error);
      toast.error('Failed to calculate repayment limits');
    }
  };

  const closeRepaymentModal = () => {
    setRepaymentModal({
      isOpen: false,
      position: null,
      tokenAddress: '',
      tokenInfo: null,
      maxRepayable: '0',
      currentBorrowed: '0',
      repayAmount: ''
    });
  };

  const refreshRepaymentModal = async () => {
    if (repaymentModal.isOpen) {
      const { maxRepayable, borrowed } = await calculateMaxRepayable(
        repaymentModal.position.poolId, 
        repaymentModal.tokenAddress, 
        repaymentModal.tokenInfo
      );
      
      setRepaymentModal(prev => ({
        ...prev,
        maxRepayable,
        currentBorrowed: borrowed,
        repayAmount: ''
      }));
    }
  };

  const handleModalRepayment = async () => {
    const { position, tokenAddress, tokenInfo, repayAmount } = repaymentModal;
    
    if (!account || !DeLexContract || !repayAmount || parseFloat(repayAmount) <= 0) {
      toast.error('Please enter a valid repayment amount');
      return;
    }

    if (parseFloat(repayAmount) > parseFloat(repaymentModal.maxRepayable)) {
      toast.error(`Maximum repayable amount is ${repaymentModal.maxRepayable} ${tokenInfo.symbol}`);
      return;
    }
    
    try {
      setLoading(true);
      
      const currentPosition = await DeLexContract.getUserPosition(account, position.poolId);
      
      let actualBorrowedAmount;
      if (tokenAddress.toLowerCase() === position.pool.tokenA.toLowerCase()) {
        actualBorrowedAmount = currentPosition.borrowedA;
      } else if (tokenAddress.toLowerCase() === position.pool.tokenB.toLowerCase()) {
        actualBorrowedAmount = currentPosition.borrowedB;
      } else {
        toast.error('Invalid token for this pool');
        return;
      }
      
      if (actualBorrowedAmount.eq(0)) {
        toast.error(`No ${tokenInfo.symbol} debt found in this pool`);
        return;
      }
      
      const amountWei = ethers.utils.parseUnits(repayAmount, tokenInfo.decimals);
      
      if (amountWei.gt(actualBorrowedAmount)) {
        const actualBorrowedFormatted = ethers.utils.formatUnits(actualBorrowedAmount, tokenInfo.decimals);
        toast.error(`Cannot repay ${repayAmount} ${tokenInfo.symbol}. You only borrowed ${parseFloat(actualBorrowedFormatted).toFixed(6)} ${tokenInfo.symbol}`);
        return;
      }
      
      const userBalance = await getTokenBalance(tokenAddress, account);
      const userBalanceWei = ethers.utils.parseUnits(userBalance, tokenInfo.decimals);
      
      if (amountWei.gt(userBalanceWei)) {
        toast.error(`Insufficient balance. You have ${userBalance} ${tokenInfo.symbol} but trying to repay ${repayAmount} ${tokenInfo.symbol}`);
        return;
      }
      
      const currentAllowance = await getTokenAllowance(tokenAddress, account, DeLexContract.address);
      const currentAllowanceWei = ethers.utils.parseUnits(currentAllowance, tokenInfo.decimals);
      
      if (currentAllowanceWei.lt(amountWei)) {
        toast.loading(`Approving ${tokenInfo.symbol}...`);
        const approveTx = await approveToken(tokenAddress, DeLexContract.address, repayAmount);
        await approveTx.wait();
        toast.dismiss();
      }
      
      toast.loading(`Repaying ${repayAmount} ${tokenInfo.symbol}...`);
      
      const finalRepayAmount = amountWei.gt(actualBorrowedAmount) ? actualBorrowedAmount : amountWei;
      
      const tx = await DeLexContract.repay(position.poolId, tokenAddress, finalRepayAmount);
      await tx.wait();
      
      toast.dismiss();
      const finalRepayFormatted = ethers.utils.formatUnits(finalRepayAmount, tokenInfo.decimals);
      toast.success(`Repaid: ${parseFloat(finalRepayFormatted).toFixed(6)} ${tokenInfo.symbol}`);
      
      closeRepaymentModal();
      await loadData();
      await loadPoolSpecificStats();
      await checkBorrowingAvailability();
    } catch (error) {
      toast.dismiss();
      
      let errorMessage = 'Failed to repay tokens';
      
      if (error.message.includes('arithmetic underflow or overflow')) {
        errorMessage = 'Repayment amount exceeds borrowed amount. Please refresh and try again.';
      } else if (error.message.includes('ERC20InsufficientBalance')) {
        errorMessage = 'Insufficient token balance to complete repayment';
      } else if (error.message.includes('UNPREDICTABLE_GAS_LIMIT')) {
        errorMessage = 'Transaction would fail. Please refresh the page and try again with updated data.';
      }
      
      toast.error(errorMessage);
      console.error('Modal repay error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Utility functions
  const calculatePositionHealthFactor = async (position) => {
    if (!DeLexContract || !account) return 'Unknown';
    
    try {
      const collateralA = parseFloat(ethers.utils.formatUnits(position.collateralA, position.tokenAInfo.decimals));
      const collateralB = parseFloat(ethers.utils.formatUnits(position.collateralB, position.tokenBInfo.decimals));
      const borrowedA = parseFloat(ethers.utils.formatUnits(position.borrowedA, position.tokenAInfo.decimals));
      const borrowedB = parseFloat(ethers.utils.formatUnits(position.borrowedB, position.tokenBInfo.decimals));
      
      const totalCollateralValue = collateralA + collateralB;
      const totalBorrowedValue = borrowedA + borrowedB;
      
      if (totalBorrowedValue === 0) return 'Safe';
      if (totalCollateralValue === 0) return '0.00';
      
      const collateralFactor = parseFloat(ethers.utils.formatEther(poolStats.collateralFactor));
      const maxBorrowCapacity = totalCollateralValue * collateralFactor;
      const healthFactor = maxBorrowCapacity / totalBorrowedValue;
      
      return Math.max(0, healthFactor).toFixed(2);
    } catch (error) {
      console.error('Error calculating health factor:', error);
      return 'Error';
    }
  };

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

  const getCollateralFactorPercentage = () => {
    try {
      const factor = parseFloat(ethers.utils.formatEther(poolStats.collateralFactor)) * 100;
      return factor.toFixed(0);
    } catch (error) {
      return '75';
    }
  };

  const getBorrowingUtilization = () => {
    try {
      if (poolStats.totalCollateralValue.eq(0)) return 0;
      
      const maxBorrow = poolStats.totalCollateralValue.mul(poolStats.collateralFactor).div(ethers.constants.WeiPerEther);
      if (maxBorrow.eq(0)) return 0;
      
      const utilization = poolStats.totalBorrowedValue.mul(10000).div(maxBorrow);
      return Math.min(10000, utilization.toNumber()) / 100;
    } catch (error) {
      console.error('Error calculating utilization:', error);
      return 0;
    }
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

  // Continue with render code in Part 3...

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
      {/* Withdrawal Modal */}
      {withdrawalModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="cyber-card border-laser-orange rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-cyber text-laser-orange mb-4">
              Withdraw {withdrawalModal.tokenInfo?.symbol} Collateral
            </h3>
            
            <div className="mb-4">
              <div className="text-gray-300 text-sm mb-2">
                Available to withdraw: {withdrawalModal.maxWithdrawable} {withdrawalModal.tokenInfo?.symbol}
              </div>
              
              <input
                type="number"
                value={withdrawalModal.withdrawAmount}
                onChange={(e) => setWithdrawalModal(prev => ({
                  ...prev,
                  withdrawAmount: e.target.value
                }))}
                max={withdrawalModal.maxWithdrawable}
                placeholder="0.0"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
              />
              
              <div className="flex justify-between mt-2">
                <button
                  onClick={() => setWithdrawalModal(prev => ({
                    ...prev,
                    withdrawAmount: (parseFloat(prev.maxWithdrawable) * 0.25).toFixed(4)
                  }))}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                >
                  25%
                </button>
                <button
                  onClick={() => setWithdrawalModal(prev => ({
                    ...prev,
                    withdrawAmount: (parseFloat(prev.maxWithdrawable) * 0.5).toFixed(4)
                  }))}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                >
                  50%
                </button>
                <button
                  onClick={() => setWithdrawalModal(prev => ({
                    ...prev,
                    withdrawAmount: (parseFloat(prev.maxWithdrawable) * 0.75).toFixed(4)
                  }))}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                >
                  75%
                </button>
                <button
                  onClick={() => setWithdrawalModal(prev => ({
                    ...prev,
                    withdrawAmount: prev.maxWithdrawable
                  }))}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                >
                  MAX
                </button>
              </div>
            </div>

            {parseFloat(withdrawalModal.maxWithdrawable) === 0 && (
              <div className="mb-4 p-3 bg-red-900 bg-opacity-30 border border-red-500 rounded-lg">
                <div className="text-red-400 text-sm">
                  ⚠️ Cannot withdraw any collateral. Your current debt level requires all collateral to maintain health factor above 1.0.
                </div>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={withdrawCollateral}
                disabled={loading || !withdrawalModal.withdrawAmount || parseFloat(withdrawalModal.withdrawAmount) <= 0 || parseFloat(withdrawalModal.maxWithdrawable) === 0}
                className="flex-1 py-2 bg-laser-orange text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all disabled:opacity-50"
              >
                {loading ? 'Withdrawing...' : 'Withdraw'}
              </button>
              <button
                onClick={closeWithdrawalModal}
                disabled={loading}
                className="flex-1 py-2 bg-gray-600 text-white font-cyber rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {repaymentModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="cyber-card border-hot-pink rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-cyber text-hot-pink mb-4">
              Repay {repaymentModal.tokenInfo?.symbol} Loan
            </h3>
            
            <div className="mb-4">
              <div className="text-gray-300 text-sm mb-2">
                Borrowed: {repaymentModal.currentBorrowed} {repaymentModal.tokenInfo?.symbol}
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300 text-sm">
                  Available to repay: {repaymentModal.maxRepayable} {repaymentModal.tokenInfo?.symbol}
                </span>
                <button
                  onClick={refreshRepaymentModal}
                  className="px-2 py-1 bg-cyber-blue text-black text-xs rounded hover:bg-opacity-80"
                >
                  🔄 Refresh
                </button>
              </div>
              
              <input
                type="number"
                value={repaymentModal.repayAmount}
                onChange={(e) => setRepaymentModal(prev => ({
                  ...prev,
                  repayAmount: e.target.value
                }))}
                max={repaymentModal.maxRepayable}
                placeholder="0.0"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-2 text-white font-cyber"
              />
              
              <div className="flex justify-between mt-2">
                <button
                  onClick={() => setRepaymentModal(prev => ({
                    ...prev,
                    repayAmount: (parseFloat(prev.maxRepayable) * 0.25).toFixed(4)
                  }))}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                >
                  25%
                </button>
                <button
                  onClick={() => setRepaymentModal(prev => ({
                    ...prev,
                    repayAmount: (parseFloat(prev.maxRepayable) * 0.5).toFixed(4)
                  }))}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                >
                  50%
                </button>
                <button
                  onClick={() => setRepaymentModal(prev => ({
                    ...prev,
                    repayAmount: (parseFloat(prev.maxRepayable) * 0.75).toFixed(4)
                  }))}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                >
                  75%
                </button>
                <button
                  onClick={() => setRepaymentModal(prev => ({
                    ...prev,
                    repayAmount: prev.maxRepayable
                  }))}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                >
                  MAX
                </button>
              </div>
            </div>

            {parseFloat(repaymentModal.maxRepayable) === 0 && (
              <div className="mb-4 p-3 bg-red-900 bg-opacity-30 border border-red-500 rounded-lg">
                <div className="text-red-400 text-sm">
                  ⚠️ No tokens available to repay. Either you have no debt for this token or insufficient balance.
                </div>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={handleModalRepayment}
                disabled={loading || !repaymentModal.repayAmount || parseFloat(repaymentModal.repayAmount) <= 0 || parseFloat(repaymentModal.maxRepayable) === 0}
                className="flex-1 py-2 bg-hot-pink text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all disabled:opacity-50"
              >
                {loading ? 'Repaying...' : 'Repay'}
              </button>
              <button
                onClick={closeRepaymentModal}
                disabled={loading}
                className="flex-1 py-2 bg-gray-600 text-white font-cyber rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
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

          {/* Pool-Specific Borrowing Power */}
          {selectedPool && poolStats.hasPosition && (
            <div className="cyber-card border-cyber-blue rounded-xl p-6 thin-neon-border">
              <h3 className="text-xl font-cyber text-cyber-blue mb-4">
                Borrowing Power in {selectedPool.tokenAInfo.symbol}/{selectedPool.tokenBInfo.symbol}
              </h3>
              <div className="flex items-center mb-4">
                <div className="flex-1 bg-gray-700 rounded-full h-4">
                  <div 
                    className="bg-gradient-to-r from-neon-green to-electric-purple h-4 rounded-full transition-all duration-500"
                    style={{ width: `${getBorrowingUtilization()}%` }}
                  ></div>
                </div>
                <div className="ml-4 text-white font-cyber">
                  {getBorrowingUtilization().toFixed(1)}%
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Used:</span>
                  <span className="text-white ml-2">${formatValue(poolStats.totalBorrowedValue)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Available:</span>
                  <span className="text-white ml-2">${formatValue(poolStats.totalAvailableToBorrow)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Collateral Factor:</span>
                  <span className="text-white ml-2">{getCollateralFactorPercentage()}%</span>
                </div>
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

          {/* Your Position in Selected Pool */}
          {selectedPool && selectedPoolPosition && (
            <div className="cyber-card border-laser-orange rounded-xl p-6 thin-neon-border">
              <h3 className="text-xl font-cyber text-laser-orange mb-4">
                Your Position in {selectedPool.tokenAInfo.symbol}/{selectedPool.tokenBInfo.symbol}
              </h3>
              
              <PositionCard 
                position={{
                  poolId: selectedPool.id,
                  pool: selectedPool,
                  tokenAInfo: selectedPool.tokenAInfo,
                  tokenBInfo: selectedPool.tokenBInfo,
                  ...selectedPoolPosition
                }}
                onWithdraw={openWithdrawalModal} 
                onRepay={openRepaymentModal}
                loading={loading}
                calculateHealthFactor={calculatePositionHealthFactor}
                formatAmount={formatAmount}
                getHealthFactorColor={getHealthFactorColor}
              />
            </div>
          )}

          {/* All User Positions Summary */}
          {userPositions.length > 0 && (
            <div className="cyber-card border-gray-500 rounded-xl p-6 thin-neon-border">
              <h3 className="text-xl font-cyber text-gray-400 mb-4">
                All Your Positions ({userPositions.length} pools)
              </h3>
              <div className="space-y-4">
                {userPositions.map((position, index) => (
                  <div 
                    key={index}
                    className={`p-4 border rounded-lg transition-all cursor-pointer ${
                      selectedPool?.id === position.poolId
                        ? 'border-neon-green bg-neon-green bg-opacity-10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => {
                      const pool = pools.find(p => p.id === position.poolId);
                      if (pool) setSelectedPool(pool);
                    }}
                  >
                    <PositionSummary 
                      position={position} 
                      calculateHealthFactor={calculatePositionHealthFactor}
                      getHealthFactorColor={getHealthFactorColor}
                      isSelected={selectedPool?.id === position.poolId}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Tabs (Deposit, Borrow, Repay) */}
      {activeTab !== 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Action Panel */}
          <div className="cyber-card border-cyber-blue rounded-xl p-6 pencil-effect">
            <h2 className="text-2xl font-cyber text-neon-green mb-6 text-center animate-glow">
              {activeTab === 'deposit' && 'Deposit Collateral'}
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

            {/* Token Selection for Pool */}
            {selectedPool && activeTab !== 'borrow' && (
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

            {/* Borrow Token Display (Fixed for cross-token borrowing) */}
            {selectedPool && activeTab === 'borrow' && (
              <div className="mb-4">
                <label className="text-gray-300 font-cyber mb-2 block">Available to Borrow:</label>
                {borrowingState.canBorrow ? (
                  <div className="p-3 border border-electric-purple rounded-lg bg-electric-purple bg-opacity-20">
                    <div className="text-electric-purple font-cyber text-lg">
                      {borrowingState.availableTokenToBorrow.info.symbol}
                    </div>
                    <div className="text-gray-400 text-sm">
                      Max: {parseFloat(borrowingState.maxBorrowAmount).toFixed(4)} {borrowingState.availableTokenToBorrow.info.symbol}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      Token: {borrowingState.availableTokenToBorrow.address.slice(0, 8)}...
                    </div>
                  </div>
                ) : (
                  <div className="p-3 border border-red-500 rounded-lg bg-red-900 bg-opacity-20">
                    <div className="text-red-400 font-cyber text-sm">
                      No borrowing available
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                      Deposit collateral first to enable borrowing
                    </div>
                  </div>
                )}
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
              
              {/* Borrow Limits Display */}
              {activeTab === 'borrow' && borrowingState.canBorrow && (
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-gray-400 text-sm">
                    Max: {parseFloat(borrowingState.maxBorrowAmount).toFixed(4)}
                  </span>
                  <button
                    onClick={() => setAmount(borrowingState.maxBorrowAmount)}
                    className="px-2 py-1 bg-electric-purple text-black text-xs rounded hover:bg-opacity-80"
                  >
                    Max
                  </button>
                </div>
              )}
            </div>

            {/* Cross-token Borrowing Warning */}
            {activeTab === 'borrow' && selectedPool && !borrowingState.canBorrow && (
              <div className="mb-4 p-3 bg-yellow-900 bg-opacity-30 border border-yellow-500 rounded-lg">
                <div className="text-yellow-400 text-sm font-cyber mb-2">
                  ⚠️ Cross-Token Borrowing Rules
                </div>
                <div className="text-yellow-300 text-xs space-y-1">
                  <div>• You can only borrow the token you didn't deposit as collateral</div>
                  <div>• Deposit {selectedPool.tokenAInfo.symbol} to borrow {selectedPool.tokenBInfo.symbol}</div>
                  <div>• Deposit {selectedPool.tokenBInfo.symbol} to borrow {selectedPool.tokenAInfo.symbol}</div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={() => {
                if (activeTab === 'deposit') depositCollateral();
                else if (activeTab === 'borrow') borrowTokens();
                else if (activeTab === 'repay') repayTokens();
              }}
              disabled={loading || !account || !amount || !selectedPool || 
                       (activeTab === 'borrow' && !borrowingState.canBorrow) ||
                       (activeTab !== 'borrow' && !isValidAddress(selectedTokenAddress)) ||
                       (activeTab === 'borrow' && borrowingState.canBorrow && !borrowingState.availableTokenToBorrow)}
              className={`w-full py-3 font-cyber text-lg rounded-lg transition-all neon-border disabled:opacity-50 ${
                activeTab === 'deposit' ? 'bg-neon-green border-neon-green text-black' :
                activeTab === 'borrow' ? 'bg-electric-purple border-electric-purple text-black' :
                'bg-hot-pink border-hot-pink text-black'
              }`}
            >
              {loading ? 'Processing...' : 
               activeTab === 'deposit' ? 'Deposit Collateral' :
               activeTab === 'borrow' ? (borrowingState.canBorrow ? 'Borrow Tokens' : 'Deposit Collateral First') :
               'Repay Tokens'}
            </button>

            {/* Pool Information */}
            {selectedPool && (
              <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                <h4 className="text-cyber-blue font-cyber text-sm mb-2">Pool Information:</h4>
                <div className="text-gray-400 text-xs space-y-1">
                  <div>Pool: {selectedPool.tokenAInfo.symbol} / {selectedPool.tokenBInfo.symbol}</div>
                  <div>Total Liquidity: {formatValue(selectedPool.totalLiquidity)}</div>
                  <div>Total Borrowed A: {formatAmount(selectedPool.totalBorrowedA, selectedPool.tokenAInfo.decimals)} {selectedPool.tokenAInfo.symbol}</div>
                  <div>Total Borrowed B: {formatAmount(selectedPool.totalBorrowedB, selectedPool.tokenBInfo.decimals)} {selectedPool.tokenBInfo.symbol}</div>
                  <div>Interest Rate A: {formatValue(selectedPool.interestRateA)}%</div>
                  <div>Interest Rate B: {formatValue(selectedPool.interestRateB)}%</div>
                </div>
              </div>
            )}
          </div>

          {/* Pool-Specific Lending Summary Panel */}
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

                {/* Pool Health Factor Warning */}
                {poolStats.healthFactor.gt(0) && 
                 parseFloat(ethers.utils.formatEther(poolStats.healthFactor)) < 1.5 && 
                 parseFloat(ethers.utils.formatEther(poolStats.healthFactor)) < 1000000 && (
                  <div className="p-3 bg-red-900 bg-opacity-30 border border-red-500 rounded-lg">
                    <div className="text-red-400 font-cyber text-sm mb-1">
                      ⚠️ Health Factor Warning
                    </div>
                    <div className="text-red-300 text-xs">
                      Your health factor is low for this pool. Consider repaying loans or adding more collateral.
                    </div>
                  </div>
                )}

                {/* Borrowing State Info */}
                {borrowingState.canBorrow && (
                  <div className="p-3 bg-green-900 bg-opacity-30 border border-green-500 rounded-lg">
                    <div className="text-green-400 font-cyber text-sm mb-1">
                      ✅ Borrowing Available
                    </div>
                    <div className="text-green-300 text-xs">
                      You can borrow up to {parseFloat(borrowingState.maxBorrowAmount).toFixed(4)} {borrowingState.availableTokenToBorrow?.info.symbol}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
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
                  
                  {poolStats.totalBorrowedValue.gt(0) && (
                    <button
                      onClick={() => setActiveTab('repay')}
                      className="w-full py-2 bg-hot-pink text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all text-sm"
                    >
                      Repay Loans
                    </button>
                  )}
                </div>

                {/* Pool Position Details */}
                {poolStats.hasPosition && (
                  <div className="mt-6">
                    <h4 className="text-gray-300 font-cyber text-sm mb-3">Position Details:</h4>
                    <div className="space-y-2">
                      <PositionSummary 
                        position={{
                          poolId: selectedPool.id,
                          tokenAInfo: selectedPool.tokenAInfo,
                          tokenBInfo: selectedPool.tokenBInfo,
                          ...selectedPoolPosition
                        }}
                        calculateHealthFactor={calculatePositionHealthFactor}
                        getHealthFactorColor={getHealthFactorColor}
                        isSelected={true}
                      />
                    </div>
                  </div>
                )}
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

// Position Card Component (Updated for better display)
const PositionCard = ({ 
  position, 
  onWithdraw, 
  onRepay,
  loading, 
  calculateHealthFactor, 
  formatAmount, 
  getHealthFactorColor 
}) => {
  const [healthFactor, setHealthFactor] = useState('Loading...');

  useEffect(() => {
    const loadHealthFactor = async () => {
      const hf = await calculateHealthFactor(position);
      setHealthFactor(hf);
    };
    loadHealthFactor();
  }, [position, calculateHealthFactor]);

  return (
    <div className="border border-gray-600 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-white font-cyber text-lg">
            {position.tokenAInfo.symbol} / {position.tokenBInfo.symbol}
          </h4>
          <div className="text-sm text-gray-400">
            Health Factor: <span className={`font-bold ${getHealthFactorColor(healthFactor)}`}>
              {healthFactor}
            </span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Collateral */}
        <div>
          <div className="text-neon-green text-sm font-cyber mb-2">Collateral Deposited:</div>
          {position.collateralA.gt(0) && (
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-neon-green">
                {position.tokenAInfo.symbol}: {formatAmount(position.collateralA, position.tokenAInfo.decimals)}
              </span>
              <button
                onClick={() => onWithdraw(
                  position,
                  position.pool.tokenA, 
                  position.tokenAInfo,
                  position.collateralA
                )}
                disabled={loading}
                className="px-2 py-1 bg-laser-orange text-black rounded text-xs hover:bg-opacity-80 disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          )}
          {position.collateralB.gt(0) && (
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-neon-green">
                {position.tokenBInfo.symbol}: {formatAmount(position.collateralB, position.tokenBInfo.decimals)}
              </span>
              <button
                onClick={() => onWithdraw(
                  position,
                  position.pool.tokenB, 
                  position.tokenBInfo,
                  position.collateralB
                )}
                disabled={loading}
                className="px-2 py-1 bg-laser-orange text-black rounded text-xs hover:bg-opacity-80 disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          )}
          {position.collateralA.eq(0) && position.collateralB.eq(0) && (
            <div className="text-gray-500 text-sm">No collateral deposited</div>
          )}
        </div>
        
        {/* Borrowed */}
        <div>
          <div className="text-hot-pink text-sm font-cyber mb-2">Amount Borrowed:</div>
          {position.borrowedA.gt(0) && (
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-hot-pink">
                {position.tokenAInfo.symbol}: {formatAmount(position.borrowedA, position.tokenAInfo.decimals)}
              </span>
              <button
                onClick={() => onRepay(
                  position,
                  position.pool.tokenA, 
                  position.tokenAInfo
                )}
                disabled={loading}
                className="px-2 py-1 bg-electric-purple text-black rounded text-xs hover:bg-opacity-80 disabled:opacity-50"
              >
                Repay
              </button>
            </div>
          )}
          {position.borrowedB.gt(0) && (
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-hot-pink">
                {position.tokenBInfo.symbol}: {formatAmount(position.borrowedB, position.tokenBInfo.decimals)}
              </span>
              <button
                onClick={() => onRepay(
                  position,
                  position.pool.tokenB, 
                  position.tokenBInfo
                )}
                disabled={loading}
                className="px-2 py-1 bg-electric-purple text-black rounded text-xs hover:bg-opacity-80 disabled:opacity-50"
              >
                Repay
              </button>
            </div>
          )}
          {position.borrowedA.eq(0) && position.borrowedB.eq(0) && (
            <div className="text-gray-500 text-sm">No tokens borrowed</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Position Summary Component (Updated for better display)
const PositionSummary = ({ 
  position, 
  calculateHealthFactor, 
  getHealthFactorColor,
  isSelected = false
}) => {
  const [healthFactor, setHealthFactor] = useState('Loading...');

  useEffect(() => {
    const loadHealthFactor = async () => {
      const hf = await calculateHealthFactor(position);
      setHealthFactor(hf);
    };
    loadHealthFactor();
  }, [position, calculateHealthFactor]);

  return (
    <div className={`p-2 rounded text-xs ${isSelected ? 'bg-neon-green bg-opacity-20' : 'bg-gray-800'}`}>
      <div className="flex justify-between items-center">
        <span className="text-white font-cyber">
          {position.tokenAInfo.symbol}/{position.tokenBInfo.symbol}
          {isSelected && <span className="text-neon-green ml-2">⭐</span>}
        </span>
        <span className={`font-cyber ${getHealthFactorColor(healthFactor)}`}>
          HF: {healthFactor}
        </span>
      </div>
    </div>
  );
};

export default LendingInterface;
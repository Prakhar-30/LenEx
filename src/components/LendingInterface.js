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
  
  const [pools, setPools] = useState([]);
  const [userPositions, setUserPositions] = useState([]);
  const [selectedPool, setSelectedPool] = useState(null);
  const [amount, setAmount] = useState('');
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    totalCollateralValue: ethers.BigNumber.from(0),
    totalBorrowedValue: ethers.BigNumber.from(0),
    totalAvailableToBorrow: ethers.BigNumber.from(0),
    overallHealthFactor: ethers.BigNumber.from(0),
    totalPositions: 0,
    collateralFactor: ethers.BigNumber.from(0)
  });

  // Withdrawal modal state
  const [withdrawalModal, setWithdrawalModal] = useState({
    isOpen: false,
    position: null,
    tokenAddress: '',
    tokenInfo: null,
    maxWithdrawable: '0',
    withdrawAmount: ''
  });

  // Repayment modal state
  const [repaymentModal, setRepaymentModal] = useState({
    isOpen: false,
    position: null,
    tokenAddress: '',
    tokenInfo: null,
    maxRepayable: '0',
    currentBorrowed: '0',
    repayAmount: ''
  });

  useEffect(() => {
    if (DeLexContract && contractsReady && account) {
      loadData();
    }
  }, [DeLexContract, contractsReady, account]);

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
            
            return { 
              id: poolId, 
              tokenAInfo,
              tokenBInfo,
              ...pool 
            };
          } catch (poolError) {
            console.error(`Error loading pool ${poolId}:`, poolError);
            return null;
          }
        })
      );
      
      const validPools = poolsData.filter(pool => pool !== null);
      setPools(validPools);
      
      if (validPools.length > 0 && !selectedPool) {
        setSelectedPool(validPools[0]);
      }
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  // FIXED: Improved user positions loading with better calculations
  const loadUserPositions = async () => {
    try {
      const poolIds = await DeLexContract.getAllPools();
      const positions = [];
      const collateralFactor = await DeLexContract.COLLATERAL_FACTOR();
      
      let totalCollateralValue = ethers.BigNumber.from(0);
      let totalBorrowedValue = ethers.BigNumber.from(0);
      let lowestHealthFactor = ethers.constants.MaxUint256;
      let hasAnyBorrowedAmount = false;
      
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
            
            const positionData = {
              poolId,
              pool,
              tokenAInfo,
              tokenBInfo,
              ...position
            };
            
            positions.push(positionData);
            
            // FIXED: Manual calculation instead of relying on contract view functions
            // Calculate collateral value (simplified 1:1 ratio for now)
            const collateralA = parseFloat(ethers.utils.formatUnits(position.collateralA, tokenAInfo.decimals));
            const collateralB = parseFloat(ethers.utils.formatUnits(position.collateralB, tokenBInfo.decimals));
            const positionCollateralValue = collateralA + collateralB;
            
            // Calculate borrowed value (simplified 1:1 ratio for now)
            const borrowedA = parseFloat(ethers.utils.formatUnits(position.borrowedA, tokenAInfo.decimals));
            const borrowedB = parseFloat(ethers.utils.formatUnits(position.borrowedB, tokenBInfo.decimals));
            const positionBorrowedValue = borrowedA + borrowedB;
            
            // Convert back to BigNumber for aggregation
            const collateralValueWei = ethers.utils.parseEther(positionCollateralValue.toString());
            const borrowedValueWei = ethers.utils.parseEther(positionBorrowedValue.toString());
            
            totalCollateralValue = totalCollateralValue.add(collateralValueWei);
            totalBorrowedValue = totalBorrowedValue.add(borrowedValueWei);
            
            // FIXED: Proper health factor calculation
            if (positionBorrowedValue > 0) {
              hasAnyBorrowedAmount = true;
              // Health factor = (collateralValue * collateralFactor) / borrowedValue
              const collateralFactorDecimal = parseFloat(ethers.utils.formatEther(collateralFactor));
              const maxBorrowCapacity = positionCollateralValue * collateralFactorDecimal;
              const healthFactor = maxBorrowCapacity / positionBorrowedValue;
              
              console.log(`Position health factor calculation:`, {
                collateralValue: positionCollateralValue,
                borrowedValue: positionBorrowedValue,
                collateralFactor: collateralFactorDecimal,
                maxBorrowCapacity,
                healthFactor
              });
              
              if (healthFactor < parseFloat(ethers.utils.formatEther(lowestHealthFactor))) {
                lowestHealthFactor = ethers.utils.parseEther(healthFactor.toString());
              }
            }
          }
        } catch (positionError) {
          console.error(`Error loading position for pool ${poolId}:`, positionError);
        }
      }
      
      // Calculate available to borrow
      const maxBorrowCapacity = totalCollateralValue.mul(collateralFactor).div(ethers.constants.WeiPerEther);
      const totalAvailableToBorrow = maxBorrowCapacity.sub(totalBorrowedValue);
      
      console.log('Dashboard stats calculation:', {
        totalCollateralValue: ethers.utils.formatEther(totalCollateralValue),
        totalBorrowedValue: ethers.utils.formatEther(totalBorrowedValue),
        totalAvailableToBorrow: ethers.utils.formatEther(totalAvailableToBorrow),
        hasAnyBorrowedAmount,
        positionsCount: positions.length
      });
      
      setUserPositions(positions);
      setDashboardStats({
        totalCollateralValue,
        totalBorrowedValue,
        totalAvailableToBorrow: totalAvailableToBorrow.gt(0) ? totalAvailableToBorrow : ethers.BigNumber.from(0),
        overallHealthFactor: hasAnyBorrowedAmount ? lowestHealthFactor : ethers.BigNumber.from(0),
        totalPositions: positions.length,
        collateralFactor
      });
    } catch (error) {
      console.error('Error loading user positions:', error);
    }
  };

  // Calculate maximum withdrawable amount without becoming undercollateralized
  const calculateMaxWithdrawable = async (poolId, tokenAddress, tokenInfo, currentCollateral) => {
    try {
      // Get current position data
      const position = await DeLexContract.getUserPosition(account, poolId);
      const pool = await DeLexContract.getPoolInfo(poolId);
      const collateralFactor = await DeLexContract.COLLATERAL_FACTOR();
      
      // Manual calculation using simplified 1:1 token values
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
      
      // If no borrowed amount, can withdraw all
      if (totalBorrowedValue === 0) {
        return ethers.utils.formatUnits(currentCollateral, tokenInfo.decimals);
      }
      
      // Calculate minimum collateral needed
      const collateralFactorDecimal = parseFloat(ethers.utils.formatEther(collateralFactor));
      const minCollateralValue = totalBorrowedValue / collateralFactorDecimal;
      
      // Add 10% safety buffer
      const safeMinCollateralValue = minCollateralValue * 1.1;
      
      if (totalCollateralValue <= safeMinCollateralValue) {
        return '0';
      }
      
      // Maximum value that can be withdrawn
      const maxWithdrawableValue = totalCollateralValue - safeMinCollateralValue;
      
      // Don't allow withdrawal of more than current collateral
      const currentCollateralFormatted = parseFloat(ethers.utils.formatUnits(currentCollateral, tokenInfo.decimals));
      const actualMaxWithdrawable = Math.min(maxWithdrawableValue, currentCollateralFormatted);
      
      return Math.max(0, actualMaxWithdrawable).toFixed(6);
    } catch (error) {
      console.error('Error calculating max withdrawable:', error);
      return '0';
    }
  };

  // Calculate max repayable amount
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

  const depositCollateral = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount || !isValidAddress(selectedTokenAddress)) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      setLoading(true);
      
      const tokenInfo = await fetchTokenInfo(selectedTokenAddress);
      const amountWei = ethers.utils.parseUnits(amount, tokenInfo.decimals);
      
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
      loadData();
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to deposit collateral: ' + error.message);
      console.error('Deposit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const borrowTokens = async () => {
    if (!account || !DeLexContract || !selectedPool || !amount || !isValidAddress(selectedTokenAddress)) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      setLoading(true);
      
      const tokenInfo = await fetchTokenInfo(selectedTokenAddress);
      const amountWei = ethers.utils.parseUnits(amount, tokenInfo.decimals);
      
      toast.loading(`Borrowing ${tokenInfo.symbol}...`);
      const tx = await DeLexContract.borrow(selectedPool.id, selectedTokenAddress, amountWei);
      await tx.wait();
      
      toast.dismiss();
      toast.success(`Borrowed: ${amount} ${tokenInfo.symbol}`);
      
      setAmount('');
      loadData();
    } catch (error) {
      toast.dismiss();
      let errorMessage = 'Failed to borrow tokens';
      
      if (error.message.includes('Insufficient collateral')) {
        errorMessage = 'Insufficient collateral - deposit more collateral or borrow less';
      } else if (error.message.includes('Insufficient liquidity')) {
        errorMessage = 'Insufficient liquidity in the pool for this borrow amount';
      } else if (error.message.includes('Invalid token')) {
        errorMessage = 'Invalid token - token must be part of the selected pool';
      }
      
      toast.error(errorMessage);
      console.error('Borrow error:', error);
    } finally {
      setLoading(false);
    }
  };

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
      loadData();
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
      loadData();
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
      loadData();
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

  // FIXED: Better health factor calculation
  const calculatePositionHealthFactor = async (position) => {
    if (!DeLexContract || !account) return 'Unknown';
    
    try {
      // Manual calculation using position data
      const collateralA = parseFloat(ethers.utils.formatUnits(position.collateralA, position.tokenAInfo.decimals));
      const collateralB = parseFloat(ethers.utils.formatUnits(position.collateralB, position.tokenBInfo.decimals));
      const borrowedA = parseFloat(ethers.utils.formatUnits(position.borrowedA, position.tokenAInfo.decimals));
      const borrowedB = parseFloat(ethers.utils.formatUnits(position.borrowedB, position.tokenBInfo.decimals));
      
      const totalCollateralValue = collateralA + collateralB;
      const totalBorrowedValue = borrowedA + borrowedB;
      
      if (totalBorrowedValue === 0) return 'Safe';
      if (totalCollateralValue === 0) return '0.00';
      
      const collateralFactor = parseFloat(ethers.utils.formatEther(dashboardStats.collateralFactor));
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
      const factor = parseFloat(ethers.utils.formatEther(dashboardStats.collateralFactor)) * 100;
      return factor.toFixed(0);
    } catch (error) {
      return '75'; // fallback
    }
  };

  const getBorrowingUtilization = () => {
    try {
      if (dashboardStats.totalCollateralValue.eq(0)) return 0;
      
      const maxBorrow = dashboardStats.totalCollateralValue.mul(dashboardStats.collateralFactor).div(ethers.constants.WeiPerEther);
      if (maxBorrow.eq(0)) return 0;
      
      const utilization = dashboardStats.totalBorrowedValue.mul(10000).div(maxBorrow);
      return Math.min(10000, utilization.toNumber()) / 100;
    } catch (error) {
      console.error('Error calculating utilization:', error);
      return 0;
    }
  };

  // FIXED: Better health factor formatting
  const formatHealthFactor = (healthFactor) => {
    if (healthFactor.eq(0)) return 'Safe';
    try {
      const formatted = parseFloat(ethers.utils.formatEther(healthFactor));
      // Prevent extremely large numbers
      if (formatted > 1000000) return 'Safe';
      return formatted.toFixed(2);
    } catch (error) {
      return 'Error';
    }
  };

  if (!contractsReady) {
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
        <div className="flex justify-center items-center py-12">
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
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="cyber-card border-neon-green rounded-xl p-4 text-center thin-neon-border">
              <div className="text-2xl font-cyber text-neon-green mb-1">
                ${formatValue(dashboardStats.totalCollateralValue)}
              </div>
              <div className="text-gray-400 text-sm">Total Collateral</div>
            </div>
            <div className="cyber-card border-hot-pink rounded-xl p-4 text-center thin-neon-border">
              <div className="text-2xl font-cyber text-hot-pink mb-1">
                ${formatValue(dashboardStats.totalBorrowedValue)}
              </div>
              <div className="text-gray-400 text-sm">Total Borrowed</div>
            </div>
            <div className="cyber-card border-electric-purple rounded-xl p-4 text-center thin-neon-border">
              <div className="text-2xl font-cyber text-electric-purple mb-1">
                ${formatValue(dashboardStats.totalAvailableToBorrow)}
              </div>
              <div className="text-gray-400 text-sm">Available to Borrow</div>
            </div>
            <div className="cyber-card border-laser-orange rounded-xl p-4 text-center thin-neon-border">
              <div className={`text-2xl font-cyber mb-1 ${getHealthFactorColor(formatHealthFactor(dashboardStats.overallHealthFactor))}`}>
                {formatHealthFactor(dashboardStats.overallHealthFactor)}
              </div>
              <div className="text-gray-400 text-sm">Health Factor</div>
            </div>
          </div>

          {/* Borrowing Power */}
          <div className="cyber-card border-cyber-blue rounded-xl p-6 thin-neon-border">
            <h3 className="text-xl font-cyber text-cyber-blue mb-4">Borrowing Power</h3>
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
                <span className="text-white ml-2">${formatValue(dashboardStats.totalBorrowedValue)}</span>
              </div>
              <div>
                <span className="text-gray-400">Available:</span>
                <span className="text-white ml-2">${formatValue(dashboardStats.totalAvailableToBorrow)}</span>
              </div>
              <div>
                <span className="text-gray-400">Collateral Factor:</span>
                <span className="text-white ml-2">{getCollateralFactorPercentage()}%</span>
              </div>
            </div>
          </div>

          {/* Your Positions */}
          <div className="cyber-card border-laser-orange rounded-xl p-6 thin-neon-border">
            <h3 className="text-xl font-cyber text-laser-orange mb-4">
              Your Positions ({userPositions.length})
            </h3>
            
            {userPositions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 font-cyber mb-4">
                  No lending positions found.
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  Start by depositing collateral to begin lending and borrowing.
                </p>
                <button
                  onClick={() => setActiveTab('deposit')}
                  className="px-6 py-3 bg-neon-green text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all"
                >
                  Deposit Collateral
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {userPositions.map((position, index) => (
                  <PositionCard 
                    key={index} 
                    position={position} 
                    onWithdraw={openWithdrawalModal} 
                    onRepay={openRepaymentModal}
                    loading={loading}
                    calculateHealthFactor={calculatePositionHealthFactor}
                    formatAmount={formatAmount}
                    getHealthFactorColor={getHealthFactorColor}
                  />
                ))}
              </div>
            )}
          </div>
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
                onChange={(e) => setSelectedPool(pools.find(p => p.id === e.target.value))}
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
            {selectedPool && (
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

            {/* Custom Token Input */}
            <div className="mb-6">
              <label className="text-gray-300 font-cyber mb-2 block">Or Enter Custom Token:</label>
              <TokenInput
                label=""
                tokenAddress={selectedTokenAddress}
                onTokenChange={setSelectedTokenAddress}
                amount={amount}
                onAmountChange={setAmount}
                placeholder="Enter any token address"
                showBalance={true}
              />
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                if (activeTab === 'deposit') depositCollateral();
                else if (activeTab === 'borrow') borrowTokens();
                else if (activeTab === 'repay') repayTokens();
              }}
              disabled={loading || !account || !amount || !selectedPool || !isValidAddress(selectedTokenAddress)}
              className={`w-full py-3 font-cyber text-lg rounded-lg transition-all neon-border disabled:opacity-50 ${
                activeTab === 'deposit' ? 'bg-neon-green border-neon-green text-black' :
                activeTab === 'borrow' ? 'bg-electric-purple border-electric-purple text-black' :
                'bg-hot-pink border-hot-pink text-black'
              }`}
            >
              {loading ? 'Processing...' : 
               activeTab === 'deposit' ? 'Deposit Collateral' :
               activeTab === 'borrow' ? 'Borrow Tokens' : 'Repay Tokens'}
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

          {/* Dashboard Summary Panel */}
          <div className="cyber-card border-laser-orange rounded-xl p-6 pencil-effect">
            <h3 className="text-xl font-cyber text-laser-orange mb-4 animate-glow">
              Your Lending Summary
            </h3>
            
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-900 rounded-lg">
                  <div className="text-neon-green font-cyber text-lg">
                    ${formatValue(dashboardStats.totalCollateralValue)}
                  </div>
                  <div className="text-gray-400 text-xs">Total Collateral</div>
                </div>
                <div className="p-3 bg-gray-900 rounded-lg">
                  <div className="text-hot-pink font-cyber text-lg">
                    ${formatValue(dashboardStats.totalBorrowedValue)}
                  </div>
                  <div className="text-gray-400 text-xs">Total Borrowed</div>
                </div>
              </div>
              
              <div className="p-3 bg-gray-900 rounded-lg">
                <div className="text-electric-purple font-cyber text-lg">
                  ${formatValue(dashboardStats.totalAvailableToBorrow)}
                </div>
                <div className="text-gray-400 text-xs">Available to Borrow</div>
              </div>
              
              <div className="p-3 bg-gray-900 rounded-lg">
                <div className={`font-cyber text-lg ${getHealthFactorColor(formatHealthFactor(dashboardStats.overallHealthFactor))}`}>
                  {formatHealthFactor(dashboardStats.overallHealthFactor)}
                </div>
                <div className="text-gray-400 text-xs">Overall Health Factor</div>
              </div>

              {/* Health Factor Warning */}
              {dashboardStats.overallHealthFactor.gt(0) && 
               parseFloat(ethers.utils.formatEther(dashboardStats.overallHealthFactor)) < 1.5 && 
               parseFloat(ethers.utils.formatEther(dashboardStats.overallHealthFactor)) < 1000000 && (
                <div className="p-3 bg-red-900 bg-opacity-30 border border-red-500 rounded-lg">
                  <div className="text-red-400 font-cyber text-sm mb-1">
                    ⚠️ Health Factor Warning
                  </div>
                  <div className="text-red-300 text-xs">
                    Your health factor is low. Consider repaying loans or adding more collateral.
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="w-full py-2 bg-cyber-blue text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all text-sm"
                >
                  View Full Dashboard
                </button>
                
                {dashboardStats.totalAvailableToBorrow.gt(0) && (
                  <button
                    onClick={() => setActiveTab('borrow')}
                    className="w-full py-2 bg-electric-purple text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all text-sm"
                  >
                    Borrow More (${formatValue(dashboardStats.totalAvailableToBorrow)} Available)
                  </button>
                )}
                
                {dashboardStats.totalBorrowedValue.gt(0) && (
                  <button
                    onClick={() => setActiveTab('repay')}
                    className="w-full py-2 bg-hot-pink text-black font-cyber rounded-lg hover:bg-opacity-80 transition-all text-sm"
                  >
                    Repay Loans
                  </button>
                )}
              </div>

              {/* Recent Activity */}
              {userPositions.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-gray-300 font-cyber text-sm mb-3">Your Active Positions:</h4>
                  <div className="space-y-2">
                    {userPositions.slice(0, 3).map((position, index) => (
                      <PositionSummary 
                        key={index} 
                        position={position} 
                        calculateHealthFactor={calculatePositionHealthFactor}
                        getHealthFactorColor={getHealthFactorColor}
                      />
                    ))}
                    {userPositions.length > 3 && (
                      <div className="text-center text-gray-400 text-xs">
                        +{userPositions.length - 3} more positions
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Position Card Component
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

// Position Summary Component
const PositionSummary = ({ 
  position, 
  calculateHealthFactor, 
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
    <div className="p-2 bg-gray-800 rounded text-xs">
      <div className="flex justify-between items-center">
        <span className="text-white">
          {position.tokenAInfo.symbol}/{position.tokenBInfo.symbol}
        </span>
        <span className={`font-cyber ${getHealthFactorColor(healthFactor)}`}>
          {healthFactor}
        </span>
      </div>
    </div>
  );
};

export default LendingInterface;
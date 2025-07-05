import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';

const LiquidationProtectionDeployer = () => {
  const [deploymentState, setDeploymentState] = useState({
    callbackContract: null,
    reactiveContract: null,
    approvalTx: null,
    isDeploying: false,
    step: 'idle' // idle, callback, reactive, approval, complete
  });

  const [formData, setFormData] = useState({
    poolId: '',
    thresholdHealthFactor: '1.2',
    targetHealthFactor: '1.5',
    collateralToken: '',
    maxCollateralAmount: '',
    userAddress: ''
  });

  const [connectedAddress, setConnectedAddress] = useState('');
  const [errors, setErrors] = useState({});

  // Chain configurations
  const chains = {
    sepolia: {
      chainId: 11155111,
      name: 'Sepolia',
      rpc: 'wss://ethereum-sepolia-rpc.publicnode.com',
      currency: 'ETH'
    },
    kopli: {
      chainId: 5318008,
      name: 'Kopli',
      rpc: 'https://kopli-rpc.rnk.dev/',
      currency: 'ETH'
    }
  };

  // Contract ABIs
  const callbackABI = [
	{
		"inputs": [],
		"stateMutability": "payable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "message",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value1",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value2",
				"type": "uint256"
			}
		],
		"name": "DebugLog",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "newHealthFactor",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "collateralAdded",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "collateralToken",
				"type": "address"
			}
		],
		"name": "PositionProtected",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "reason",
				"type": "string"
			}
		],
		"name": "ProtectionFailed",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "thresholdHealthFactor",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "targetHealthFactor",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "collateralToken",
						"type": "address"
					},
					{
						"internalType": "bool",
						"name": "isActive",
						"type": "bool"
					},
					{
						"internalType": "uint256",
						"name": "maxCollateralAmount",
						"type": "uint256"
					}
				],
				"internalType": "struct DeLexLiquidationProtectionCallback.ProtectionConfig",
				"name": "config",
				"type": "tuple"
			}
		],
		"name": "_executeProtection",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"internalType": "uint256",
				"name": "targetHealthFactor",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "collateralToken",
				"type": "address"
			}
		],
		"name": "calculateCollateralNeeded",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "coverDebt",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			}
		],
		"name": "deactivateProtection",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "delexCore",
		"outputs": [
			{
				"internalType": "contract IDeLexCore",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			}
		],
		"name": "getProtectionConfig",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "thresholdHealthFactor",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "targetHealthFactor",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "collateralToken",
						"type": "address"
					},
					{
						"internalType": "bool",
						"name": "isActive",
						"type": "bool"
					},
					{
						"internalType": "uint256",
						"name": "maxCollateralAmount",
						"type": "uint256"
					}
				],
				"internalType": "struct DeLexLiquidationProtectionCallback.ProtectionConfig",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			}
		],
		"name": "isProtectionNeeded",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "pay",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			}
		],
		"name": "protectPosition",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"name": "protectionConfigs",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "thresholdHealthFactor",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "targetHealthFactor",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "collateralToken",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "isActive",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "maxCollateralAmount",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"internalType": "uint256",
				"name": "thresholdHealthFactor",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "targetHealthFactor",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "collateralToken",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "maxCollateralAmount",
				"type": "uint256"
			}
		],
		"name": "setupProtection",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	}
];

  const reactiveABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_callbackContract",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_protectedUser",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "_protectedPoolId",
				"type": "bytes32"
			},
			{
				"internalType": "uint256",
				"name": "_healthFactorThreshold",
				"type": "uint256"
			}
		],
		"stateMutability": "payable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "chain_id",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "_contract",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint64",
				"name": "gas_limit",
				"type": "uint64"
			},
			{
				"indexed": false,
				"internalType": "bytes",
				"name": "payload",
				"type": "bytes"
			}
		],
		"name": "Callback",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [],
		"name": "Done",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "currentHealthFactor",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "threshold",
				"type": "uint256"
			}
		],
		"name": "HealthFactorChecked",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "healthFactor",
				"type": "uint256"
			}
		],
		"name": "ProtectionTriggered",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "coverDebt",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "cronTopic",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getProtectionParams",
		"outputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"internalType": "uint256",
				"name": "threshold",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "isTriggered",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "manualTrigger",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "pause",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "pay",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "chain_id",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "_contract",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "topic_0",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "topic_1",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "topic_2",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "topic_3",
						"type": "uint256"
					},
					{
						"internalType": "bytes",
						"name": "data",
						"type": "bytes"
					},
					{
						"internalType": "uint256",
						"name": "block_number",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "op_code",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "block_hash",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "tx_hash",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "log_index",
						"type": "uint256"
					}
				],
				"internalType": "struct IReactive.LogRecord",
				"name": "log",
				"type": "tuple"
			}
		],
		"name": "react",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "resume",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_newUser",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "_newPoolId",
				"type": "bytes32"
			},
			{
				"internalType": "uint256",
				"name": "_newThreshold",
				"type": "uint256"
			}
		],
		"name": "updateProtectionParams",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	}
];

  const erc20ABI = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "symbol",
				"type": "string"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "allowance",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "needed",
				"type": "uint256"
			}
		],
		"name": "ERC20InsufficientAllowance",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "balance",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "needed",
				"type": "uint256"
			}
		],
		"name": "ERC20InsufficientBalance",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "approver",
				"type": "address"
			}
		],
		"name": "ERC20InvalidApprover",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "receiver",
				"type": "address"
			}
		],
		"name": "ERC20InvalidReceiver",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "ERC20InvalidSender",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			}
		],
		"name": "ERC20InvalidSpender",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "Approval",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			}
		],
		"name": "allowance",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "decimals",
		"outputs": [
			{
				"internalType": "uint8",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalSupply",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "transfer",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	}
];

  // Get connected wallet address
  useEffect(() => {
    const getConnectedAddress = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setConnectedAddress(accounts[0]);
            setFormData(prev => ({ ...prev, userAddress: accounts[0] }));
          }
        } catch (error) {
          console.error('Error getting connected address:', error);
        }
      }
    };

    getConnectedAddress();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setConnectedAddress(accounts[0]);
          setFormData(prev => ({ ...prev, userAddress: accounts[0] }));
        }
      });
    }
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.poolId) {
      newErrors.poolId = 'Pool ID is required';
    } else if (!/^0x[a-fA-F0-9]{64}$/.test(formData.poolId)) {
      newErrors.poolId = 'Invalid pool ID format (must be 32 bytes hex)';
    }

    if (!formData.userAddress) {
      newErrors.userAddress = 'User address is required';
    } else if (!ethers.utils.isAddress(formData.userAddress)) {
      newErrors.userAddress = 'Invalid user address';
    }

    if (!formData.collateralToken) {
      newErrors.collateralToken = 'Collateral token address is required';
    } else if (!ethers.utils.isAddress(formData.collateralToken)) {
      newErrors.collateralToken = 'Invalid collateral token address';
    }

    if (!formData.maxCollateralAmount || parseFloat(formData.maxCollateralAmount) <= 0) {
      newErrors.maxCollateralAmount = 'Max collateral amount must be greater than 0';
    }

    const threshold = parseFloat(formData.thresholdHealthFactor);
    const target = parseFloat(formData.targetHealthFactor);

    if (threshold <= 1.0) {
      newErrors.thresholdHealthFactor = 'Threshold must be greater than 1.0';
    }

    if (target <= threshold) {
      newErrors.targetHealthFactor = 'Target must be greater than threshold';
    }

    if (target > 3.0) {
      newErrors.targetHealthFactor = 'Target must be less than or equal to 3.0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkBalance = async (provider, requiredAmount) => {
    try {
      const signer = provider.getSigner();
      const balance = await signer.getBalance();
      const required = ethers.utils.parseEther(requiredAmount);
      
      if (balance.lt(required)) {
        throw new Error(`Insufficient balance. Required: ${requiredAmount} ETH, Available: ${ethers.utils.formatEther(balance)} ETH`);
      }
      
      return true;
    } catch (error) {
      throw error;
    }
  };

  const switchToNetwork = async (chainId) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error) {
      if (error.code === 4902) {
        const chain = Object.values(chains).find(c => c.chainId === chainId);
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${chainId.toString(16)}`,
            chainName: chain.name,
            rpcUrls: [chain.rpc],
            nativeCurrency: {
              name: chain.currency,
              symbol: chain.currency,
              decimals: 18
            }
          }]
        });
      } else {
        throw error;
      }
    }
  };

  const deployCallbackContract = async () => {
    try {
      setDeploymentState(prev => ({ ...prev, step: 'callback' }));
      
      await switchToNetwork(chains.sepolia.chainId);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      await checkBalance(provider, "0.01");
      
      // TODO: Replace with actual bytecode from Remix compilation
      const callbackBytecode = "60a060405273c9f36411c9897e7f959d99ffca2a0ba7ee0d7bda3360025f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550805f806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506100a7816100f560201b60201c565b50730be9c90ea6c387b974888de1c21c6a0f96bc50c673ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff168152505061014c565b6001805f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f6101000a81548160ff02191690831515021790555050565b608051612f9f6101aa5f395f81816107f00152818161088d015281816109b601528181610aa201528181610e5b01528181610edb015281816112cd015281816114910152818161154d015281816115ea01526116870152612f9f5ff3fe60806040526004361061009f575f3560e01c80635bea140b116100635780635bea140b146101c65780637a90b990146101ee578063ab673a5614610204578063c290d6911461022e578063c383d69f14610256578063d229137a14610292576100a6565b8063335c8b99146100aa578063397617e9146100e65780633b5183fb1461010e5780634bd56da81461014e578063545896961461018a576100a6565b366100a657005b5f80fd5b3480156100b5575f80fd5b506100d060048036038101906100cb9190611ae5565b6102ba565b6040516100dd9190611bca565b60405180910390f35b3480156100f1575f80fd5b5061010c60048036038101906101079190611c0d565b6103ae565b005b348015610119575f80fd5b50610134600480360381019061012f9190611ae5565b61068a565b604051610145959493929190611cb1565b60405180910390f35b348015610159575f80fd5b50610174600480360381019061016f9190611ae5565b6106f3565b6040516101819190611d02565b60405180910390f35b348015610195575f80fd5b506101b060048036038101906101ab9190611e5a565b610944565b6040516101bd9190611eaa565b60405180910390f35b3480156101d1575f80fd5b506101ec60048036038101906101e79190611ec3565b610fb1565b005b3480156101f9575f80fd5b506102026113c8565b005b34801561020f575f80fd5b5061021861148f565b6040516102259190611f6e565b60405180910390f35b348015610239575f80fd5b50610254600480360381019061024f9190611f87565b6114b3565b005b348015610261575f80fd5b5061027c60048036038101906102779190611fb2565b611549565b6040516102899190611eaa565b60405180910390f35b34801561029d575f80fd5b506102b860048036038101906102b39190612016565b611858565b005b6102c2611a09565b60035f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8381526020019081526020015f206040518060a00160405290815f820154815260200160018201548152602001600282015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016002820160149054906101000a900460ff16151515158152602001600382015481525050905092915050565b8383670de0b6b3a764000082116103fa576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016103f19061209b565b60405180910390fd5b81811161043c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161043390612103565b60405180910390fd5b6729a2241af62c0000811115610487576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161047e9061216b565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff16036104f5576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104ec906121d3565b60405180910390fd5b5f8311610537576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161052e9061223b565b60405180910390fd5b6040518060a001604052808781526020018681526020018573ffffffffffffffffffffffffffffffffffffffff1681526020016001151581526020018481525060035f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8981526020019081526020015f205f820151815f0155602082015181600101556040820151816002015f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060608201518160020160146101000a81548160ff021916908315150217905550608082015181600301559050507f1e12a21fdf194d5d13bc6106efc72ff0f33ff3272045d478355d95e3e1aa3ff686866040516106799291906122a3565b60405180910390a150505050505050565b6003602052815f5260405f20602052805f5260405f205f9150915050805f015490806001015490806002015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060020160149054906101000a900460ff16908060030154905085565b5f8060035f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8481526020019081526020015f206040518060a00160405290815f820154815260200160018201548152602001600282015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016002820160149054906101000a900460ff16151515158152602001600382015481525050905080606001516107ed575f91505061093e565b5f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166317f791b786866040518363ffffffff1660e01b81526004016108499291906122ec565b602060405180830381865afa158015610864573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906108889190612327565b90505f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff16631fe1524687876040518363ffffffff1660e01b81526004016108e69291906122ec565b602060405180830381865afa158015610901573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906109259190612327565b90505f811180156109385750825f015182105b93505050505b92915050565b5f3073ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146109b3576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016109aa9061239c565b60405180910390fd5b5f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166317f791b786866040518363ffffffff1660e01b8152600401610a0f9291906122ec565b602060405180830381865afa158015610a2a573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610a4e9190612327565b9050825f01518110610a9f577f1e12a21fdf194d5d13bc6106efc72ff0f33ff3272045d478355d95e3e1aa3ff681845f0151604051610a8e929190612404565b60405180910390a15f915050610faa565b5f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff16631fe1524687876040518363ffffffff1660e01b8152600401610afb9291906122ec565b602060405180830381865afa158015610b16573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610b3a9190612327565b90505f8103610b86577f1e12a21fdf194d5d13bc6106efc72ff0f33ff3272045d478355d95e3e1aa3ff65f80604051610b749291906124c1565b60405180910390a15f92505050610faa565b5f610b9b878787602001518860400151611549565b90505f8103610be8577f1e12a21fdf194d5d13bc6106efc72ff0f33ff3272045d478355d95e3e1aa3ff65f80604051610bd5929190612545565b60405180910390a15f9350505050610faa565b8460800151811115610c3957846080015190507f1e12a21fdf194d5d13bc6106efc72ff0f33ff3272045d478355d95e3e1aa3ff6818660800151604051610c309291906125c9565b60405180910390a15b5f856040015190505f8173ffffffffffffffffffffffffffffffffffffffff166370a082318a6040518263ffffffff1660e01b8152600401610c7b9190612603565b602060405180830381865afa158015610c96573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610cba9190612327565b90505f8273ffffffffffffffffffffffffffffffffffffffff1663dd62ed3e8b306040518363ffffffff1660e01b8152600401610cf892919061261c565b602060405180830381865afa158015610d13573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610d379190612327565b905083821015610d7c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610d739061268d565b60405180910390fd5b83811015610dbf576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610db6906126f5565b60405180910390fd5b8273ffffffffffffffffffffffffffffffffffffffff166323b872dd8b30876040518463ffffffff1660e01b8152600401610dfc93929190612713565b6020604051808303815f875af1158015610e18573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610e3c919061275c565b508273ffffffffffffffffffffffffffffffffffffffff1663095ea7b37f0000000000000000000000000000000000000000000000000000000000000000866040518363ffffffff1660e01b8152600401610e98929190612787565b6020604051808303815f875af1158015610eb4573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610ed8919061275c565b507f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166352cccdb38a8a60400151876040518463ffffffff1660e01b8152600401610f3a939291906127ae565b5f604051808303815f87803b158015610f51575f80fd5b505af1158015610f63573d5f803e3d5ffd5b505050507f1e12a21fdf194d5d13bc6106efc72ff0f33ff3272045d478355d95e3e1aa3ff6845f604051610f9892919061282d565b60405180910390a18396505050505050505b9392505050565b60015f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f9054906101000a900460ff1661103a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611031906128b1565b60405180910390fd5b5f60035f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8381526020019081526020015f206040518060a00160405290815f820154815260200160018201548152602001600282015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016002820160149054906101000a900460ff161515151581526020016003820154815250509050806060015161117d57818373ffffffffffffffffffffffffffffffffffffffff167f0a64e4ffd3aacca7c18400177ecbf28fe139e00b3fcb368a3417799cd0749a0060405161116f90612919565b60405180910390a3506113c3565b3073ffffffffffffffffffffffffffffffffffffffff1663545896968484846040518463ffffffff1660e01b81526004016111ba93929190612937565b6020604051808303815f875af19250505080156111f557506040513d601f19601f820116820180604052508101906111f29190612327565b60015b6112ca57611201612978565b806308c379a0036112755750611215612997565b806112205750611277565b828473ffffffffffffffffffffffffffffffffffffffff167f0a64e4ffd3aacca7c18400177ecbf28fe139e00b3fcb368a3417799cd0749a00836040516112679190612a76565b60405180910390a3506112c5565b505b818373ffffffffffffffffffffffffffffffffffffffff167f0a64e4ffd3aacca7c18400177ecbf28fe139e00b3fcb368a3417799cd0749a006040516112bc90612ae0565b60405180910390a35b6113c1565b5f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166317f791b786866040518363ffffffff1660e01b81526004016113269291906122ec565b602060405180830381865afa158015611341573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906113659190612327565b9050838573ffffffffffffffffffffffffffffffffffffffff167f6834ce6e0be3f9ce0728e47232cf36ae777f2f469dd9134fac892df2c9071b84838587604001516040516113b693929190612afe565b60405180910390a350505b505b505050565b5f805f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16639b6c56ec306040518263ffffffff1660e01b81526004016114229190612603565b602060405180830381865afa15801561143d573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906114619190612327565b905061148c5f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff16826118c2565b50565b7f000000000000000000000000000000000000000000000000000000000000000081565b60015f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f9054906101000a900460ff1661153c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611533906128b1565b60405180910390fd5b61154633826118c2565b50565b5f807f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166303de2d6a87876040518363ffffffff1660e01b81526004016115a69291906122ec565b602060405180830381865afa1580156115c1573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906115e59190612327565b90505f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff16631fe1524688886040518363ffffffff1660e01b81526004016116439291906122ec565b602060405180830381865afa15801561165e573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906116829190612327565b90505f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166317f49e056040518163ffffffff1660e01b8152600401602060405180830381865afa1580156116ee573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906117129190612327565b90505f8203611726575f9350505050611850565b5f8187846117349190612b60565b61173e9190612bce565b9050838111611753575f945050505050611850565b5f84826117609190612bfe565b90505f8773ffffffffffffffffffffffffffffffffffffffff1663313ce5676040518163ffffffff1660e01b8152600401602060405180830381865afa1580156117ac573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906117d09190612c67565b90505f60128260ff16036117e657829050611845565b60128260ff16101561181d578160126117ff9190612c92565b600a61180b9190612df5565b836118169190612bce565b9050611844565b60128261182a9190612c92565b600a6118369190612df5565b836118419190612b60565b90505b5b809750505050505050505b949350505050565b5f60035f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8381526020019081526020015f2060020160146101000a81548160ff02191690831515021790555050565b80471015611905576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016118fc90612e89565b60405180910390fd5b5f811115611a05575f8273ffffffffffffffffffffffffffffffffffffffff16825f67ffffffffffffffff8111156119405761193f611d2f565b5b6040519080825280601f01601f1916602001820160405280156119725781602001600182028036833780820191505090505b506040516119809190612eeb565b5f6040518083038185875af1925050503d805f81146119ba576040519150601f19603f3d011682016040523d82523d5f602084013e6119bf565b606091505b5050905080611a03576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016119fa90612f4b565b60405180910390fd5b505b5050565b6040518060a001604052805f81526020015f81526020015f73ffffffffffffffffffffffffffffffffffffffff1681526020015f151581526020015f81525090565b5f604051905090565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f611a8182611a58565b9050919050565b611a9181611a77565b8114611a9b575f80fd5b50565b5f81359050611aac81611a88565b92915050565b5f819050919050565b611ac481611ab2565b8114611ace575f80fd5b50565b5f81359050611adf81611abb565b92915050565b5f8060408385031215611afb57611afa611a54565b5b5f611b0885828601611a9e565b9250506020611b1985828601611ad1565b9150509250929050565b5f819050919050565b611b3581611b23565b82525050565b611b4481611a77565b82525050565b5f8115159050919050565b611b5e81611b4a565b82525050565b60a082015f820151611b785f850182611b2c565b506020820151611b8b6020850182611b2c565b506040820151611b9e6040850182611b3b565b506060820151611bb16060850182611b55565b506080820151611bc46080850182611b2c565b50505050565b5f60a082019050611bdd5f830184611b64565b92915050565b611bec81611b23565b8114611bf6575f80fd5b50565b5f81359050611c0781611be3565b92915050565b5f805f805f60a08688031215611c2657611c25611a54565b5b5f611c3388828901611ad1565b9550506020611c4488828901611bf9565b9450506040611c5588828901611bf9565b9350506060611c6688828901611a9e565b9250506080611c7788828901611bf9565b9150509295509295909350565b611c8d81611b23565b82525050565b611c9c81611a77565b82525050565b611cab81611b4a565b82525050565b5f60a082019050611cc45f830188611c84565b611cd16020830187611c84565b611cde6040830186611c93565b611ceb6060830185611ca2565b611cf86080830184611c84565b9695505050505050565b5f602082019050611d155f830184611ca2565b92915050565b5f80fd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b611d6582611d1f565b810181811067ffffffffffffffff82111715611d8457611d83611d2f565b5b80604052505050565b5f611d96611a4b565b9050611da28282611d5c565b919050565b611db081611b4a565b8114611dba575f80fd5b50565b5f81359050611dcb81611da7565b92915050565b5f60a08284031215611de657611de5611d1b565b5b611df060a0611d8d565b90505f611dff84828501611bf9565b5f830152506020611e1284828501611bf9565b6020830152506040611e2684828501611a9e565b6040830152506060611e3a84828501611dbd565b6060830152506080611e4e84828501611bf9565b60808301525092915050565b5f805f60e08486031215611e7157611e70611a54565b5b5f611e7e86828701611a9e565b9350506020611e8f86828701611ad1565b9250506040611ea086828701611dd1565b9150509250925092565b5f602082019050611ebd5f830184611c84565b92915050565b5f805f60608486031215611eda57611ed9611a54565b5b5f611ee786828701611a9e565b9350506020611ef886828701611a9e565b9250506040611f0986828701611ad1565b9150509250925092565b5f819050919050565b5f611f36611f31611f2c84611a58565b611f13565b611a58565b9050919050565b5f611f4782611f1c565b9050919050565b5f611f5882611f3d565b9050919050565b611f6881611f4e565b82525050565b5f602082019050611f815f830184611f5f565b92915050565b5f60208284031215611f9c57611f9b611a54565b5b5f611fa984828501611bf9565b91505092915050565b5f805f8060808587031215611fca57611fc9611a54565b5b5f611fd787828801611a9e565b9450506020611fe887828801611ad1565b9350506040611ff987828801611bf9565b925050606061200a87828801611a9e565b91505092959194509250565b5f6020828403121561202b5761202a611a54565b5b5f61203884828501611ad1565b91505092915050565b5f82825260208201905092915050565b7f5468726573686f6c64206d757374206265203e20312e300000000000000000005f82015250565b5f612085601783612041565b915061209082612051565b602082019050919050565b5f6020820190508181035f8301526120b281612079565b9050919050565b7f546172676574206d757374206265203e207468726573686f6c640000000000005f82015250565b5f6120ed601a83612041565b91506120f8826120b9565b602082019050919050565b5f6020820190508181035f83015261211a816120e1565b9050919050565b7f54617267657420746f6f206869676820286d617820332e3029000000000000005f82015250565b5f612155601983612041565b915061216082612121565b602082019050919050565b5f6020820190508181035f83015261218281612149565b9050919050565b7f496e76616c696420636f6c6c61746572616c20746f6b656e00000000000000005f82015250565b5f6121bd601883612041565b91506121c882612189565b602082019050919050565b5f6020820190508181035f8301526121ea816121b1565b9050919050565b7f4d617820636f6c6c61746572616c206d757374206265203e20300000000000005f82015250565b5f612225601a83612041565b9150612230826121f1565b602082019050919050565b5f6020820190508181035f83015261225281612219565b9050919050565b7f50726f74656374696f6e207365747570000000000000000000000000000000005f82015250565b5f61228d601083612041565b915061229882612259565b602082019050919050565b5f6060820190508181035f8301526122ba81612281565b90506122c96020830185611c84565b6122d66040830184611c84565b9392505050565b6122e681611ab2565b82525050565b5f6040820190506122ff5f830185611c93565b61230c60208301846122dd565b9392505050565b5f8151905061232181611be3565b92915050565b5f6020828403121561233c5761233b611a54565b5b5f61234984828501612313565b91505092915050565b7f496e7465726e616c2066756e6374696f6e206f6e6c79000000000000000000005f82015250565b5f612386601683612041565b915061239182612352565b602082019050919050565b5f6020820190508181035f8301526123b38161237a565b9050919050565b7f4e6f2070726f74656374696f6e206e65656465640000000000000000000000005f82015250565b5f6123ee601483612041565b91506123f9826123ba565b602082019050919050565b5f6060820190508181035f83015261241b816123e2565b905061242a6020830185611c84565b6124376040830184611c84565b9392505050565b7f4e6f206465627420746f2070726f7465637400000000000000000000000000005f82015250565b5f612472601283612041565b915061247d8261243e565b602082019050919050565b5f819050919050565b5f6124ab6124a66124a184612488565b611f13565b611b23565b9050919050565b6124bb81612491565b82525050565b5f6060820190508181035f8301526124d881612466565b90506124e760208301856124b2565b6124f460408301846124b2565b9392505050565b7f4e6f20636f6c6c61746572616c206e65656465640000000000000000000000005f82015250565b5f61252f601483612041565b915061253a826124fb565b602082019050919050565b5f6060820190508181035f83015261255c81612523565b905061256b60208301856124b2565b61257860408301846124b2565b9392505050565b7f43617070656420746f206d617820616d6f756e740000000000000000000000005f82015250565b5f6125b3601483612041565b91506125be8261257f565b602082019050919050565b5f6060820190508181035f8301526125e0816125a7565b90506125ef6020830185611c84565b6125fc6040830184611c84565b9392505050565b5f6020820190506126165f830184611c93565b92915050565b5f60408201905061262f5f830185611c93565b61263c6020830184611c93565b9392505050565b7f496e73756666696369656e7420757365722062616c616e6365000000000000005f82015250565b5f612677601983612041565b915061268282612643565b602082019050919050565b5f6020820190508181035f8301526126a48161266b565b9050919050565b7f496e73756666696369656e7420616c6c6f77616e6365000000000000000000005f82015250565b5f6126df601683612041565b91506126ea826126ab565b602082019050919050565b5f6020820190508181035f83015261270c816126d3565b9050919050565b5f6060820190506127265f830186611c93565b6127336020830185611c93565b6127406040830184611c84565b949350505050565b5f8151905061275681611da7565b92915050565b5f6020828403121561277157612770611a54565b5b5f61277e84828501612748565b91505092915050565b5f60408201905061279a5f830185611c93565b6127a76020830184611c84565b9392505050565b5f6060820190506127c15f8301866122dd565b6127ce6020830185611c93565b6127db6040830184611c84565b949350505050565b7f436f6c6c61746572616c206164646564000000000000000000000000000000005f82015250565b5f612817601083612041565b9150612822826127e3565b602082019050919050565b5f6060820190508181035f8301526128448161280b565b90506128536020830185611c84565b61286060408301846124b2565b9392505050565b7f417574686f72697a65642073656e646572206f6e6c79000000000000000000005f82015250565b5f61289b601683612041565b91506128a682612867565b602082019050919050565b5f6020820190508181035f8301526128c88161288f565b9050919050565b7f50726f74656374696f6e206e6f742061637469766500000000000000000000005f82015250565b5f612903601583612041565b915061290e826128cf565b602082019050919050565b5f6020820190508181035f830152612930816128f7565b9050919050565b5f60e08201905061294a5f830186611c93565b61295760208301856122dd565b6129646040830184611b64565b949350505050565b5f8160e01c9050919050565b5f60033d11156129945760045f803e6129915f5161296c565b90505b90565b5f60443d10612a23576129a8611a4b565b60043d036004823e80513d602482011167ffffffffffffffff821117156129d0575050612a23565b808201805167ffffffffffffffff8111156129ee5750505050612a23565b80602083010160043d038501811115612a0b575050505050612a23565b612a1a82602001850186611d5c565b82955050505050505b90565b5f81519050919050565b8281835e5f83830152505050565b5f612a4882612a26565b612a528185612041565b9350612a62818560208601612a30565b612a6b81611d1f565b840191505092915050565b5f6020820190508181035f830152612a8e8184612a3e565b905092915050565b7f556e6b6e6f776e206572726f7220647572696e672070726f74656374696f6e005f82015250565b5f612aca601f83612041565b9150612ad582612a96565b602082019050919050565b5f6020820190508181035f830152612af781612abe565b9050919050565b5f606082019050612b115f830186611c84565b612b1e6020830185611c84565b612b2b6040830184611c93565b949350505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f612b6a82611b23565b9150612b7583611b23565b9250828202612b8381611b23565b91508282048414831517612b9a57612b99612b33565b5b5092915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601260045260245ffd5b5f612bd882611b23565b9150612be383611b23565b925082612bf357612bf2612ba1565b5b828204905092915050565b5f612c0882611b23565b9150612c1383611b23565b9250828203905081811115612c2b57612c2a612b33565b5b92915050565b5f60ff82169050919050565b612c4681612c31565b8114612c50575f80fd5b50565b5f81519050612c6181612c3d565b92915050565b5f60208284031215612c7c57612c7b611a54565b5b5f612c8984828501612c53565b91505092915050565b5f612c9c82612c31565b9150612ca783612c31565b9250828203905060ff811115612cc057612cbf612b33565b5b92915050565b5f8160011c9050919050565b5f808291508390505b6001851115612d1b57808604811115612cf757612cf6612b33565b5b6001851615612d065780820291505b8081029050612d1485612cc6565b9450612cdb565b94509492505050565b5f82612d335760019050612dee565b81612d40575f9050612dee565b8160018114612d565760028114612d6057612d8f565b6001915050612dee565b60ff841115612d7257612d71612b33565b5b8360020a915084821115612d8957612d88612b33565b5b50612dee565b5060208310610133831016604e8410600b8410161715612dc45782820a905083811115612dbf57612dbe612b33565b5b612dee565b612dd18484846001612cd2565b92509050818404811115612de857612de7612b33565b5b81810290505b9392505050565b5f612dff82611b23565b9150612e0a83612c31565b9250612e377fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8484612d24565b905092915050565b7f496e73756666696369656e742066756e647300000000000000000000000000005f82015250565b5f612e73601283612041565b9150612e7e82612e3f565b602082019050919050565b5f6020820190508181035f830152612ea081612e67565b9050919050565b5f81519050919050565b5f81905092915050565b5f612ec582612ea7565b612ecf8185612eb1565b9350612edf818560208601612a30565b80840191505092915050565b5f612ef68284612ebb565b915081905092915050565b7f5472616e73666572206661696c656400000000000000000000000000000000005f82015250565b5f612f35600f83612041565b9150612f4082612f01565b602082019050919050565b5f6020820190508181035f830152612f6281612f29565b905091905056fea264697066735822122098d0e2631135fc74a3a3d1b83a297c8365dd926165e5f0f5330b4dcd00766e8664736f6c634300081a0033";
      
      const factory = new ethers.ContractFactory(callbackABI, callbackBytecode, signer);
      
      toast.loading('Deploying callback contract on Sepolia with 0.01 ETH...');
      
      const contract = await factory.deploy({
        value: ethers.utils.parseEther("0.01")
      });
      await contract.deployed();
      
      toast.dismiss();
      toast.success(`Callback contract deployed at: ${contract.address}`);
      
      setDeploymentState(prev => ({
        ...prev,
        callbackContract: {
          address: contract.address,
          transactionHash: contract.deployTransaction.hash
        }
      }));
      
      return contract.address;
    } catch (error) {
      toast.dismiss();
      toast.error(`Failed to deploy callback contract: ${error.message}`);
      throw error;
    }
  };

  const deployReactiveContract = async (callbackAddress) => {
    try {
      setDeploymentState(prev => ({ ...prev, step: 'reactive' }));
      
      await switchToNetwork(chains.kopli.chainId);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      await checkBalance(provider, "0.01");
      
      // TODO: Replace with actual bytecode from Remix compilation
      const reactiveBytecode = "608060405260405161230538038061230583398181016040528101906100259190610583565b62ffffff600260016101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555f806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506100b862ffffff61044260201b60201c565b6100c661049960201b60201c565b3360035f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555062ffffff600260016101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505f600360156101000a81548160ff0219169083151502179055508360045f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508260055f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600681905550806007819055507ff02d6ea5c22a71cffe930a4523fcb4f129be6c804db50e4202fb4e0b07ccb51460088190555060025f9054906101000a900460ff1661043957600260019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16635a6aced046600260019054906101000a900473ffffffffffffffffffffffffffffffffffffffff166008547fa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad807fa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad6040518763ffffffff1660e01b81526004016102f596959493929190610605565b5f604051808303815f87803b15801561030c575f80fd5b505af115801561031e573d5f803e3d5ffd5b50505050600260019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16635a6aced062aa36a760045f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff167f7c35d88b632b81e36da99d43f78d9a1a4a1d00a84e9b0d3c2f5f7f6a8c9d0e1f7fa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad807fa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad6040518763ffffffff1660e01b815260040161040b96959493929190610605565b5f604051808303815f87803b158015610422575f80fd5b505af1158015610434573d5f803e3d5ffd5b505050505b50505050610664565b6001805f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f6101000a81548160ff02191690831515021790555050565b5f62ffffff3b90505f811460025f6101000a81548160ff02191690831515021790555050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6104ec826104c3565b9050919050565b6104fc816104e2565b8114610506575f80fd5b50565b5f81519050610517816104f3565b92915050565b5f819050919050565b61052f8161051d565b8114610539575f80fd5b50565b5f8151905061054a81610526565b92915050565b5f819050919050565b61056281610550565b811461056c575f80fd5b50565b5f8151905061057d81610559565b92915050565b5f805f806080858703121561059b5761059a6104bf565b5b5f6105a887828801610509565b94505060206105b987828801610509565b93505060406105ca8782880161053c565b92505060606105db8782880161056f565b91505092959194509250565b6105f081610550565b82525050565b6105ff816104e2565b82525050565b5f60c0820190506106185f8301896105e7565b61062560208301886105f6565b61063260408301876105e7565b61063f60608301866105e7565b61064c60808301856105e7565b61065960a08301846105e7565b979650505050505050565b611c94806106715f395ff3fe608060405260043610610089575f3560e01c80637a90b990116100585780637a90b990146101155780638456cb591461012b578063c290d69114610141578063d3315a7814610169578063ec68c7241461019157610090565b8063022fe1eb14610094578063046f7da2146100aa5780630d152c2c146100c05780632fae1b8d146100e857610090565b3661009057005b5f80fd5b34801561009f575f80fd5b506100a86101bb565b005b3480156100b5575f80fd5b506100be610463565b005b3480156100cb575f80fd5b506100e660048036038101906100e191906112d3565b610719565b005b3480156100f3575f80fd5b506100fc610a36565b60405161010c94939291906113a3565b60405180910390f35b348015610120575f80fd5b50610129610a80565b005b348015610136575f80fd5b5061013f610b47565b005b34801561014c575f80fd5b5061016760048036038101906101629190611410565b610dff565b005b348015610174575f80fd5b5061018f600480360381019061018a919061148f565b610e95565b005b34801561019c575f80fd5b506101a5610fcf565b6040516101b291906114df565b60405180910390f35b60055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461024a576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161024190611578565b60405180910390fd5b600360159054906101000a900460ff161561029a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610291906115e0565b60405180910390fd5b5f8060055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff166006546040516024016102d3939291906115fe565b6040516020818303038152906040527f5bea140b000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff838183161783525050505090506001600360156101000a81548160ff02191690831515021790555060065460055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8f064ecb88ecb86171c9346c623db80bd0f2dd47e2a6f41e7f426f831825db5d5f6040516103d79190611675565b60405180910390a3620f424067ffffffffffffffff1660045f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1662aa36a77f8dd725fa9d6cd150017ab9e60318d40616439424e2fade9c1c58854950917dfc8460405161045891906116fe565b60405180910390a450565b60025f9054906101000a900460ff16156104b2576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104a990611768565b60405180910390fd5b60035f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610541576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610538906117d0565b60405180910390fd5b600360149054906101000a900460ff16610590576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161058790611838565b60405180910390fd5b5f610599610fd5565b90505f5b815181146106fb57600260019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16635a6aced08383815181106105f6576105f5611856565b5b60200260200101515f015184848151811061061457610613611856565b5b60200260200101516020015185858151811061063357610632611856565b5b60200260200101516040015186868151811061065257610651611856565b5b60200260200101516060015187878151811061067157610670611856565b5b6020026020010151608001518888815181106106905761068f611856565b5b602002602001015160a001516040518763ffffffff1660e01b81526004016106bd96959493929190611883565b5f604051808303815f87803b1580156106d4575f80fd5b505af11580156106e6573d5f803e3d5ffd5b50505050806106f49061190f565b905061059d565b505f600360146101000a81548160ff02191690831515021790555050565b60025f9054906101000a900460ff16610767576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161075e906119a0565b60405180910390fd5b60085481604001350361095457600360159054906101000a900460ff16610a33575f8060055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff166006546040516024016107c1939291906115fe565b6040516020818303038152906040527f5bea140b000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff838183161783525050505090506001600360156101000a81548160ff02191690831515021790555060065460055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8f064ecb88ecb86171c9346c623db80bd0f2dd47e2a6f41e7f426f831825db5d5f6040516108c59190611675565b60405180910390a3620f424067ffffffffffffffff1660045f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1662aa36a77f8dd725fa9d6cd150017ab9e60318d40616439424e2fade9c1c58854950917dfc8460405161094691906116fe565b60405180910390a450610a32565b60045f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681602001602081019061099f91906119be565b73ffffffffffffffffffffffffffffffffffffffff161480156109e557507f7c35d88b632b81e36da99d43f78d9a1a4a1d00a84e9b0d3c2f5f7f6a8c9d0e1f8160400135145b15610a31575f600360156101000a81548160ff0219169083151502179055507f9f9fb434574749b74458e0ddc3cf5fd5bdb1b009c8615e825606b53724576f3560405160405180910390a15b5b5b50565b5f805f8060055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff16600654600754600360159054906101000a900460ff16935093509350935090919293565b5f805f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16639b6c56ec306040518263ffffffff1660e01b8152600401610ada91906119e9565b602060405180830381865afa158015610af5573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610b199190611a16565b9050610b445f8054906101000a900473ffffffffffffffffffffffffffffffffffffffff168261111b565b50565b60025f9054906101000a900460ff1615610b96576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b8d90611768565b60405180910390fd5b60035f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610c25576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610c1c906117d0565b60405180910390fd5b600360149054906101000a900460ff1615610c75576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610c6c90611a8b565b60405180910390fd5b5f610c7e610fd5565b90505f5b81518114610de057600260019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16632f807336838381518110610cdb57610cda611856565b5b60200260200101515f0151848481518110610cf957610cf8611856565b5b602002602001015160200151858581518110610d1857610d17611856565b5b602002602001015160400151868681518110610d3757610d36611856565b5b602002602001015160600151878781518110610d5657610d55611856565b5b602002602001015160800151888881518110610d7557610d74611856565b5b602002602001015160a001516040518763ffffffff1660e01b8152600401610da296959493929190611883565b5f604051808303815f87803b158015610db9575f80fd5b505af1158015610dcb573d5f803e3d5ffd5b5050505080610dd99061190f565b9050610c82565b506001600360146101000a81548160ff02191690831515021790555050565b60015f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f9054906101000a900460ff16610e88576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610e7f90611af3565b60405180910390fd5b610e92338261111b565b50565b60055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161480610f3d5750600260019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16145b610f7c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610f73906117d0565b60405180910390fd5b8260055f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508160068190555080600781905550505050565b60085481565b60605f600167ffffffffffffffff811115610ff357610ff2611b11565b5b60405190808252806020026020018201604052801561102c57816020015b611019611262565b8152602001906001900390816110115790505b5090506040518060c00160405280468152602001600260019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200160085481526020017fa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad81526020017fa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad81526020017fa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad815250815f8151811061110957611108611856565b5b60200260200101819052508091505090565b8047101561115e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161115590611b88565b60405180910390fd5b5f81111561125e575f8273ffffffffffffffffffffffffffffffffffffffff16825f67ffffffffffffffff81111561119957611198611b11565b5b6040519080825280601f01601f1916602001820160405280156111cb5781602001600182028036833780820191505090505b506040516111d99190611be0565b5f6040518083038185875af1925050503d805f8114611213576040519150601f19603f3d011682016040523d82523d5f602084013e611218565b606091505b505090508061125c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161125390611c40565b60405180910390fd5b505b5050565b6040518060c001604052805f81526020015f73ffffffffffffffffffffffffffffffffffffffff1681526020015f81526020015f81526020015f81526020015f81525090565b5f80fd5b5f80fd5b5f80fd5b5f61018082840312156112ca576112c96112b0565b5b81905092915050565b5f602082840312156112e8576112e76112a8565b5b5f82013567ffffffffffffffff811115611305576113046112ac565b5b611311848285016112b4565b91505092915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6113438261131a565b9050919050565b61135381611339565b82525050565b5f819050919050565b61136b81611359565b82525050565b5f819050919050565b61138381611371565b82525050565b5f8115159050919050565b61139d81611389565b82525050565b5f6080820190506113b65f83018761134a565b6113c36020830186611362565b6113d0604083018561137a565b6113dd6060830184611394565b95945050505050565b6113ef81611371565b81146113f9575f80fd5b50565b5f8135905061140a816113e6565b92915050565b5f60208284031215611425576114246112a8565b5b5f611432848285016113fc565b91505092915050565b61144481611339565b811461144e575f80fd5b50565b5f8135905061145f8161143b565b92915050565b61146e81611359565b8114611478575f80fd5b50565b5f8135905061148981611465565b92915050565b5f805f606084860312156114a6576114a56112a8565b5b5f6114b386828701611451565b93505060206114c48682870161147b565b92505060406114d5868287016113fc565b9150509250925092565b5f6020820190506114f25f83018461137a565b92915050565b5f82825260208201905092915050565b7f4f6e6c792070726f74656374656420757365722063616e206d616e75616c6c795f8201527f2074726967676572000000000000000000000000000000000000000000000000602082015250565b5f6115626028836114f8565b915061156d82611508565b604082019050919050565b5f6020820190508181035f83015261158f81611556565b9050919050565b7f416c7265616479207472696767657265640000000000000000000000000000005f82015250565b5f6115ca6011836114f8565b91506115d582611596565b602082019050919050565b5f6020820190508181035f8301526115f7816115be565b9050919050565b5f6060820190506116115f83018661134a565b61161e602083018561134a565b61162b6040830184611362565b949350505050565b5f819050919050565b5f819050919050565b5f61165f61165a61165584611633565b61163c565b611371565b9050919050565b61166f81611645565b82525050565b5f6020820190506116885f830184611666565b92915050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f6116d08261168e565b6116da8185611698565b93506116ea8185602086016116a8565b6116f3816116b6565b840191505092915050565b5f6020820190508181035f83015261171681846116c6565b905092915050565b7f5265616374697665204e6574776f726b206f6e6c7900000000000000000000005f82015250565b5f6117526015836114f8565b915061175d8261171e565b602082019050919050565b5f6020820190508181035f83015261177f81611746565b9050919050565b7f556e617574686f72697a656400000000000000000000000000000000000000005f82015250565b5f6117ba600c836114f8565b91506117c582611786565b602082019050919050565b5f6020820190508181035f8301526117e7816117ae565b9050919050565b7f4e6f7420706175736564000000000000000000000000000000000000000000005f82015250565b5f611822600a836114f8565b915061182d826117ee565b602082019050919050565b5f6020820190508181035f83015261184f81611816565b9050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52603260045260245ffd5b5f60c0820190506118965f83018961137a565b6118a3602083018861134a565b6118b0604083018761137a565b6118bd606083018661137a565b6118ca608083018561137a565b6118d760a083018461137a565b979650505050505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f61191982611371565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff820361194b5761194a6118e2565b5b600182019050919050565b7f564d206f6e6c79000000000000000000000000000000000000000000000000005f82015250565b5f61198a6007836114f8565b915061199582611956565b602082019050919050565b5f6020820190508181035f8301526119b78161197e565b9050919050565b5f602082840312156119d3576119d26112a8565b5b5f6119e084828501611451565b91505092915050565b5f6020820190506119fc5f83018461134a565b92915050565b5f81519050611a10816113e6565b92915050565b5f60208284031215611a2b57611a2a6112a8565b5b5f611a3884828501611a02565b91505092915050565b7f416c7265616479207061757365640000000000000000000000000000000000005f82015250565b5f611a75600e836114f8565b9150611a8082611a41565b602082019050919050565b5f6020820190508181035f830152611aa281611a69565b9050919050565b7f417574686f72697a65642073656e646572206f6e6c79000000000000000000005f82015250565b5f611add6016836114f8565b9150611ae882611aa9565b602082019050919050565b5f6020820190508181035f830152611b0a81611ad1565b9050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b7f496e73756666696369656e742066756e647300000000000000000000000000005f82015250565b5f611b726012836114f8565b9150611b7d82611b3e565b602082019050919050565b5f6020820190508181035f830152611b9f81611b66565b9050919050565b5f81905092915050565b5f611bba8261168e565b611bc48185611ba6565b9350611bd48185602086016116a8565b80840191505092915050565b5f611beb8284611bb0565b915081905092915050565b7f5472616e73666572206661696c656400000000000000000000000000000000005f82015250565b5f611c2a600f836114f8565b9150611c3582611bf6565b602082019050919050565b5f6020820190508181035f830152611c5781611c1e565b905091905056fea264697066735822122023f8c85dccc8774d9bab35c54b3873f37190d5aa129a80d2bb5ac67da539007e64736f6c634300081a0033";
      
      const factory = new ethers.ContractFactory(reactiveABI, reactiveBytecode, signer);
      
      const thresholdWei = ethers.utils.parseEther(formData.thresholdHealthFactor);
      const poolIdBytes = ethers.utils.formatBytes32String(formData.poolId);
      
      toast.loading('Deploying reactive contract on Kopli with 0.01 ETH...');
      
      const contract = await factory.deploy(
        callbackAddress,
        formData.userAddress,
        poolIdBytes,
        thresholdWei,
        { value: ethers.utils.parseEther("0.01") }
      );
      await contract.deployed();
      
      toast.dismiss();
      toast.success(`Reactive contract deployed at: ${contract.address}`);
      
      setDeploymentState(prev => ({
        ...prev,
        reactiveContract: {
          address: contract.address,
          transactionHash: contract.deployTransaction.hash
        }
      }));
      
      return contract.address;
    } catch (error) {
      toast.dismiss();
      toast.error(`Failed to deploy reactive contract: ${error.message}`);
      throw error;
    }
  };

  const approveCallbackContract = async (callbackAddress) => {
    try {
      setDeploymentState(prev => ({ ...prev, step: 'approval' }));
      
      // Switch back to Sepolia for approval
      await switchToNetwork(chains.sepolia.chainId);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      const tokenContract = new ethers.Contract(formData.collateralToken, erc20ABI, signer);
      
      // Get token info for display
      const symbol = await tokenContract.symbol();
      const decimals = await tokenContract.decimals();
      const balance = await tokenContract.balanceOf(formData.userAddress);
      
      // Convert max collateral amount to wei
      const maxAmountWei = ethers.utils.parseUnits(formData.maxCollateralAmount, decimals);
      
      // Check if user has enough balance
      if (balance.lt(maxAmountWei)) {
        throw new Error(`Insufficient ${symbol} balance. Required: ${formData.maxCollateralAmount}, Available: ${ethers.utils.formatUnits(balance, decimals)}`);
      }
      
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(formData.userAddress, callbackAddress);
      
      if (currentAllowance.gte(maxAmountWei)) {
        toast.success(`${symbol} already approved for callback contract`);
        return null; // No need to approve
      }
      
      toast.loading(`Approving ${formData.maxCollateralAmount} ${symbol} for callback contract...`);
      
      const approveTx = await tokenContract.approve(callbackAddress, maxAmountWei);
      await approveTx.wait();
      
      toast.dismiss();
      toast.success(`${symbol} approved for callback contract`);
      
      setDeploymentState(prev => ({
        ...prev,
        approvalTx: {
          hash: approveTx.hash,
          amount: formData.maxCollateralAmount,
          symbol: symbol
        }
      }));
      
      return approveTx.hash;
    } catch (error) {
      toast.dismiss();
      toast.error(`Failed to approve collateral token: ${error.message}`);
      throw error;
    }
  };

  const setupProtection = async (callbackAddress) => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      const contract = new ethers.Contract(callbackAddress, callbackABI, signer);
      
      const poolIdBytes = ethers.utils.formatBytes32String(formData.poolId);
      const thresholdWei = ethers.utils.parseEther(formData.thresholdHealthFactor);
      const targetWei = ethers.utils.parseEther(formData.targetHealthFactor);
      
      // Get token decimals for proper conversion
      const tokenContract = new ethers.Contract(formData.collateralToken, erc20ABI, signer);
      const decimals = await tokenContract.decimals();
      const maxAmountWei = ethers.utils.parseUnits(formData.maxCollateralAmount, decimals);
      
      toast.loading('Setting up protection configuration...');
      const tx = await contract.setupProtection(
        poolIdBytes,
        thresholdWei,
        targetWei,
        formData.collateralToken,
        maxAmountWei
      );
      await tx.wait();
      
      toast.dismiss();
      toast.success('Protection setup completed!');
    } catch (error) {
      toast.dismiss();
      toast.error(`Failed to setup protection: ${error.message}`);
      throw error;
    }
  };

  const handleDeploy = async () => {
    if (!validateForm()) {
      toast.error('Please fix form errors before deploying');
      return;
    }

    if (!window.ethereum) {
      toast.error('Please install MetaMask to deploy contracts');
      return;
    }

    if (!connectedAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setDeploymentState(prev => ({ ...prev, isDeploying: true }));

    try {
      // Step 1: Deploy callback contract on Sepolia
      const callbackAddress = await deployCallbackContract();
      
      // Step 2: Deploy reactive contract on Kopli
      await deployReactiveContract(callbackAddress);
      
      // Step 3: Approve callback contract to spend collateral token
      await approveCallbackContract(callbackAddress);
      
      // Step 4: Setup protection configuration
      await setupProtection(callbackAddress);
      
      setDeploymentState(prev => ({ ...prev, step: 'complete' }));
      toast.success('🎉 Liquidation protection system deployed successfully!');
      
    } catch (error) {
      console.error('Deployment error:', error);
      setDeploymentState(prev => ({ ...prev, isDeploying: false, step: 'idle' }));
    }
  };

  const resetDeployment = () => {
    setDeploymentState({
      callbackContract: null,
      reactiveContract: null,
      approvalTx: null,
      isDeploying: false,
      step: 'idle'
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 border border-purple-500 rounded-xl p-6 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              Deploy Liquidation Protection
            </h2>
            <p className="text-gray-400">
              Deploy smart contracts to protect your positions from liquidation
            </p>
            <div className="mt-4 p-3 bg-gray-900 rounded-lg border border-yellow-500">
              <p className="text-sm text-yellow-400">
                ⚠️ This deployment requires 0.02 ETH total (0.01 ETH for each contract)
              </p>
              {connectedAddress && (
                <p className="text-xs text-gray-400 mt-1">
                  Connected: {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                </p>
              )}
            </div>
          </div>

          {/* Deployment Status */}
          {deploymentState.step !== 'idle' && (
            <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
              <h3 className="font-bold text-blue-400 mb-3">Deployment Progress</h3>
              <div className="space-y-2">
                <div className={`flex items-center ${deploymentState.step === 'callback' ? 'text-purple-400' : deploymentState.callbackContract ? 'text-green-400' : 'text-gray-500'}`}>
                  <span className="mr-2">
                    {deploymentState.callbackContract ? '✅' : deploymentState.step === 'callback' ? '🔄' : '⏳'}
                  </span>
                  <span>Deploy Callback Contract (Sepolia) - 0.01 ETH</span>
                  {deploymentState.callbackContract && (
                    <span className="ml-2 text-xs text-gray-400">
                      {deploymentState.callbackContract.address.slice(0, 8)}...
                    </span>
                  )}
                </div>
                <div className={`flex items-center ${deploymentState.step === 'reactive' ? 'text-purple-400' : deploymentState.reactiveContract ? 'text-green-400' : 'text-gray-500'}`}>
                  <span className="mr-2">
                    {deploymentState.reactiveContract ? '✅' : deploymentState.step === 'reactive' ? '🔄' : '⏳'}
                  </span>
                  <span>Deploy Reactive Contract (Kopli) - 0.01 ETH</span>
                  {deploymentState.reactiveContract && (
                    <span className="ml-2 text-xs text-gray-400">
                      {deploymentState.reactiveContract.address.slice(0, 8)}...
                    </span>
                  )}
                </div>
                <div className={`flex items-center ${deploymentState.step === 'approval' ? 'text-purple-400' : deploymentState.approvalTx ? 'text-green-400' : 'text-gray-500'}`}>
                  <span className="mr-2">
                    {deploymentState.approvalTx ? '✅' : deploymentState.step === 'approval' ? '🔄' : '⏳'}
                  </span>
                  <span>Approve Collateral Token</span>
                  {deploymentState.approvalTx && (
                    <span className="ml-2 text-xs text-gray-400">
                      {deploymentState.approvalTx.amount} {deploymentState.approvalTx.symbol}
                    </span>
                  )}
                </div>
                <div className={`flex items-center ${deploymentState.step === 'complete' ? 'text-green-400' : 'text-gray-500'}`}>
                  <span className="mr-2">
                    {deploymentState.step === 'complete' ? '✅' : '⏳'}
                  </span>
                  <span>Setup Protection Configuration</span>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Protected User Address
                </label>
                <input
                  type="text"
                  value={formData.userAddress}
                  onChange={(e) => handleInputChange('userAddress', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-lg font-mono text-sm text-white focus:outline-none focus:ring-2 ${
                    errors.userAddress ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-purple-500'
                  }`}
                  placeholder="0x..."
                  disabled={deploymentState.isDeploying}
                  readOnly={connectedAddress ? true : false}
                />
                {errors.userAddress && (
                  <p className="mt-1 text-sm text-red-400">{errors.userAddress}</p>
                )}
                {connectedAddress && (
                  <p className="mt-1 text-xs text-gray-400">Auto-filled with your connected wallet</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pool ID
                </label>
                <input
                  type="text"
                  value={formData.poolId}
                  onChange={(e) => handleInputChange('poolId', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-lg font-mono text-sm text-white focus:outline-none focus:ring-2 ${
                    errors.poolId ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-purple-500'
                  }`}
                  placeholder="0x..."
                  disabled={deploymentState.isDeploying}
                />
                {errors.poolId && (
                  <p className="mt-1 text-sm text-red-400">{errors.poolId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Threshold Health Factor
                  <span className="text-xs text-gray-500 ml-1">(When to trigger protection)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  max="2.9"
                  value={formData.thresholdHealthFactor}
                  onChange={(e) => handleInputChange('thresholdHealthFactor', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-lg font-mono text-sm text-white focus:outline-none focus:ring-2 ${
                    errors.thresholdHealthFactor ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-purple-500'
                  }`}
                  disabled={deploymentState.isDeploying}
                />
                {errors.thresholdHealthFactor && (
                  <p className="mt-1 text-sm text-red-400">{errors.thresholdHealthFactor}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Target Health Factor
                  <span className="text-xs text-gray-500 ml-1">(Restore to this level)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.2"
                  max="3.0"
                  value={formData.targetHealthFactor}
                  onChange={(e) => handleInputChange('targetHealthFactor', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-lg font-mono text-sm text-white focus:outline-none focus:ring-2 ${
                    errors.targetHealthFactor ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-purple-500'
                  }`}
                  disabled={deploymentState.isDeploying}
                />
                {errors.targetHealthFactor && (
                  <p className="mt-1 text-sm text-red-400">{errors.targetHealthFactor}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Collateral Token Address
                </label>
                <input
                  type="text"
                  value={formData.collateralToken}
                  onChange={(e) => handleInputChange('collateralToken', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-lg font-mono text-sm text-white focus:outline-none focus:ring-2 ${
                    errors.collateralToken ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-purple-500'
                  }`}
                  placeholder="0x..."
                  disabled={deploymentState.isDeploying}
                />
                {errors.collateralToken && (
                  <p className="mt-1 text-sm text-red-400">{errors.collateralToken}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Collateral Amount
                  <span className="text-xs text-gray-500 ml-1">(Will be approved for callback)</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0.000001"
                  value={formData.maxCollateralAmount}
                  onChange={(e) => handleInputChange('maxCollateralAmount', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-lg font-mono text-sm text-white focus:outline-none focus:ring-2 ${
                    errors.maxCollateralAmount ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-purple-500'
                  }`}
                  placeholder="1000.0"
                  disabled={deploymentState.isDeploying}
                />
                {errors.maxCollateralAmount && (
                  <p className="mt-1 text-sm text-red-400">{errors.maxCollateralAmount}</p>
                )}
              </div>
            </div>

            {/* Deploy Button */}
            <div className="flex justify-center space-x-4">
              {deploymentState.step === 'idle' && (
                <button
                  type="button"
                  onClick={handleDeploy}
                  disabled={deploymentState.isDeploying || !connectedAddress}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {deploymentState.isDeploying ? 'Deploying...' : 'Deploy Protection System (0.02 ETH)'}
                </button>
              )}
              
              {deploymentState.step === 'complete' && (
                <button
                  type="button"
                  onClick={resetDeployment}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-blue-600 transition-all shadow-lg"
                >
                  Deploy Another System
                </button>
              )}
            </div>
          </div>

          {/* Deployment Results */}
          {deploymentState.step === 'complete' && (
            <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-green-500">
              <h3 className="font-bold text-green-400 mb-4">🎉 Deployment Complete!</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Callback Contract (Sepolia):</span>
                  <span className="ml-2 font-mono text-blue-400">
                    {deploymentState.callbackContract?.address}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Reactive Contract (Kopli):</span>
                  <span className="ml-2 font-mono text-pink-400">
                    {deploymentState.reactiveContract?.address}
                  </span>
                </div>
                {deploymentState.approvalTx && (
                  <div>
                    <span className="text-gray-400">Token Approval:</span>
                    <span className="ml-2 font-mono text-green-400">
                      {deploymentState.approvalTx.amount} {deploymentState.approvalTx.symbol}
                    </span>
                  </div>
                )}
                <div className="mt-3 p-2 bg-gray-800 rounded">
                  <p className="text-xs text-gray-400">
                    Total ETH spent: 0.02 ETH (0.01 ETH per contract)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Protection will trigger when health factor drops below {formData.thresholdHealthFactor} and restore to {formData.targetHealthFactor}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiquidationProtectionDeployer;
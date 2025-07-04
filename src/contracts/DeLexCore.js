export const DeLex_CORE_ADDRESS = "0x27cc171d68B20BBE3E81B009F337b17b06196f82";

export const DeLex_CORE_ABI = [
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"internalType": "uint256",
				"name": "amountA",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "amountB",
				"type": "uint256"
			}
		],
		"name": "addLiquidity",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "shares",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
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
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "borrow",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "tokenA",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "tokenB",
				"type": "address"
			}
		],
		"name": "createPool",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			}
		],
		"stateMutability": "nonpayable",
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
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "depositCollateral",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "OwnableInvalidOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "OwnableUnauthorizedAccount",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			}
		],
		"name": "SafeERC20FailedOperation",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountA",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountB",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "shares",
				"type": "uint256"
			}
		],
		"name": "LiquidityAdded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountA",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountB",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "shares",
				"type": "uint256"
			}
		],
		"name": "LiquidityRemoved",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "tokenA",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "tokenB",
				"type": "address"
			}
		],
		"name": "PoolCreated",
		"type": "event"
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
				"name": "shares",
				"type": "uint256"
			}
		],
		"name": "removeLiquidity",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "amountA",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "amountB",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
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
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "repay",
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
			},
			{
				"internalType": "address",
				"name": "tokenIn",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amountIn",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "minAmountOut",
				"type": "uint256"
			}
		],
		"name": "swap",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "amountOut",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "TokensBorrowed",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "TokensRepaid",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "tokenIn",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountIn",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountOut",
				"type": "uint256"
			}
		],
		"name": "TokensSwapped",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
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
			},
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "withdrawCollateral",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "COLLATERAL_FACTOR",
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
		"name": "getAllPools",
		"outputs": [
			{
				"internalType": "bytes32[]",
				"name": "",
				"type": "bytes32[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "amountIn",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "reserveIn",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "reserveOut",
				"type": "uint256"
			}
		],
		"name": "getAmountOut",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "amountOut",
				"type": "uint256"
			}
		],
		"stateMutability": "pure",
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
		"name": "getBorrowValue",
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
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			}
		],
		"name": "getCollateralValue",
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
				"internalType": "bytes32",
				"name": "poolId",
				"type": "bytes32"
			}
		],
		"name": "getPoolInfo",
		"outputs": [
			{
				"components": [
					{
						"internalType": "address",
						"name": "tokenA",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "tokenB",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "reserveA",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "reserveB",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "totalLiquidity",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "totalBorrowedA",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "totalBorrowedB",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "interestRateA",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "interestRateB",
						"type": "uint256"
					},
					{
						"internalType": "bool",
						"name": "exists",
						"type": "bool"
					}
				],
				"internalType": "struct DeLexCore.Pool",
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
		"name": "getUserPosition",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "liquidityShares",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "borrowedA",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "borrowedB",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "collateralA",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "collateralB",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "lastUpdateTime",
						"type": "uint256"
					}
				],
				"internalType": "struct DeLexCore.UserPosition",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "MAX_INTEREST_RATE",
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
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
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
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "poolIds",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"name": "pools",
		"outputs": [
			{
				"internalType": "address",
				"name": "tokenA",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "tokenB",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "reserveA",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "reserveB",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalLiquidity",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalBorrowedA",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalBorrowedB",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "interestRateA",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "interestRateB",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "exists",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "PRECISION",
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
				"name": "",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"name": "userPositions",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "liquidityShares",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "borrowedA",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "borrowedB",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "collateralA",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "collateralB",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "lastUpdateTime",
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
				"name": "",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "userShares",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DeLexCore is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    struct Pool {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalLiquidity;
        uint256 totalBorrowedA;
        uint256 totalBorrowedB;
        uint256 interestRateA;
        uint256 interestRateB;
        bool exists;
    }
    
    struct UserPosition {
        uint256 liquidityShares;
        uint256 borrowedA;
        uint256 borrowedB;
        uint256 collateralA;
        uint256 collateralB;
        uint256 lastUpdateTime;
    }
    
    mapping(bytes32 => Pool) public pools;
    mapping(address => mapping(bytes32 => UserPosition)) public userPositions;
    mapping(bytes32 => mapping(address => uint256)) public userShares;
    
    bytes32[] public poolIds;
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant MAX_INTEREST_RATE = 100e18; // 100%
    uint256 public constant COLLATERAL_FACTOR = 75e16; // 75%
    
    event PoolCreated(bytes32 indexed poolId, address tokenA, address tokenB);
    event LiquidityAdded(bytes32 indexed poolId, address user, uint256 amountA, uint256 amountB, uint256 shares);
    event LiquidityRemoved(bytes32 indexed poolId, address user, uint256 amountA, uint256 amountB, uint256 shares);
    event TokensSwapped(bytes32 indexed poolId, address user, address tokenIn, uint256 amountIn, uint256 amountOut);
    event TokensBorrowed(bytes32 indexed poolId, address user, address token, uint256 amount);
    event TokensRepaid(bytes32 indexed poolId, address user, address token, uint256 amount);

    constructor() Ownable(msg.sender){}
    
    function createPool(address tokenA, address tokenB) external returns (bytes32 poolId) {
        require(tokenA != tokenB, "Identical tokens");
        require(tokenA != address(0) && tokenB != address(0), "Zero address");
        
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        poolId = keccak256(abi.encodePacked(token0, token1));
        
        require(!pools[poolId].exists, "Pool exists");
        
        pools[poolId] = Pool({
            tokenA: token0,
            tokenB: token1,
            reserveA: 0,
            reserveB: 0,
            totalLiquidity: 0,
            totalBorrowedA: 0,
            totalBorrowedB: 0,
            interestRateA: 10e18, // 10% APY
            interestRateB: 10e18, // 10% APY
            exists: true
        });
        
        poolIds.push(poolId);
        emit PoolCreated(poolId, token0, token1);
    }
    
    function addLiquidity(bytes32 poolId, uint256 amountA, uint256 amountB) 
        external nonReentrant returns (uint256 shares) {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool doesn't exist");
        
        IERC20(pool.tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(pool.tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        
        if (pool.totalLiquidity == 0) {
            shares = sqrt(amountA * amountB);
        } else {
            shares = min(
                (amountA * pool.totalLiquidity) / pool.reserveA,
                (amountB * pool.totalLiquidity) / pool.reserveB
            );
        }
        
        require(shares > 0, "Insufficient liquidity");
        
        pool.reserveA += amountA;
        pool.reserveB += amountB;
        pool.totalLiquidity += shares;
        userShares[poolId][msg.sender] += shares;
        
        emit LiquidityAdded(poolId, msg.sender, amountA, amountB, shares);
    }
    
    function removeLiquidity(bytes32 poolId, uint256 shares) 
        external nonReentrant returns (uint256 amountA, uint256 amountB) {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool doesn't exist");
        require(userShares[poolId][msg.sender] >= shares, "Insufficient shares");
        
        amountA = (shares * pool.reserveA) / pool.totalLiquidity;
        amountB = (shares * pool.reserveB) / pool.totalLiquidity;
        
        pool.reserveA -= amountA;
        pool.reserveB -= amountB;
        pool.totalLiquidity -= shares;
        userShares[poolId][msg.sender] -= shares;
        
        IERC20(pool.tokenA).safeTransfer(msg.sender, amountA);
        IERC20(pool.tokenB).safeTransfer(msg.sender, amountB);
        
        emit LiquidityRemoved(poolId, msg.sender, amountA, amountB, shares);
    }
    
    function swap(bytes32 poolId, address tokenIn, uint256 amountIn, uint256 minAmountOut) 
        external nonReentrant returns (uint256 amountOut) {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool doesn't exist");
        require(tokenIn == pool.tokenA || tokenIn == pool.tokenB, "Invalid token");
        
        bool isTokenA = tokenIn == pool.tokenA;
        (uint256 reserveIn, uint256 reserveOut) = isTokenA ? 
            (pool.reserveA, pool.reserveB) : (pool.reserveB, pool.reserveA);
            
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= minAmountOut, "Insufficient output");
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        if (isTokenA) {
            pool.reserveA += amountIn;
            pool.reserveB -= amountOut;
            IERC20(pool.tokenB).safeTransfer(msg.sender, amountOut);
        } else {
            pool.reserveB += amountIn;
            pool.reserveA -= amountOut;
            IERC20(pool.tokenA).safeTransfer(msg.sender, amountOut);
        }
        
        emit TokensSwapped(poolId, msg.sender, tokenIn, amountIn, amountOut);
    }
    
    function borrow(bytes32 poolId, address token, uint256 amount) external nonReentrant {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool doesn't exist");
        require(token == pool.tokenA || token == pool.tokenB, "Invalid token");
        
        UserPosition storage position = userPositions[msg.sender][poolId];
        updateInterest(msg.sender, poolId);
        
        uint256 collateralValue = getCollateralValue(msg.sender, poolId);
        uint256 borrowValue = getBorrowValue(msg.sender, poolId) + amount;
        
        require(borrowValue <= (collateralValue * COLLATERAL_FACTOR) / PRECISION, "Insufficient collateral");
        
        bool isTokenA = token == pool.tokenA;
        if (isTokenA) {
            require(pool.reserveA >= amount, "Insufficient liquidity");
            pool.reserveA -= amount;
            pool.totalBorrowedA += amount;
            position.borrowedA += amount;
        } else {
            require(pool.reserveB >= amount, "Insufficient liquidity");
            pool.reserveB -= amount;
            pool.totalBorrowedB += amount;
            position.borrowedB += amount;
        }
        
        IERC20(token).safeTransfer(msg.sender, amount);
        emit TokensBorrowed(poolId, msg.sender, token, amount);
    }
    
    function repay(bytes32 poolId, address token, uint256 amount) external nonReentrant {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool doesn't exist");
        require(token == pool.tokenA || token == pool.tokenB, "Invalid token");
        
        UserPosition storage position = userPositions[msg.sender][poolId];
        updateInterest(msg.sender, poolId);
        
        bool isTokenA = token == pool.tokenA;
        uint256 borrowed = isTokenA ? position.borrowedA : position.borrowedB;
        uint256 repayAmount = amount > borrowed ? borrowed : amount;
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), repayAmount);
        
        if (isTokenA) {
            pool.reserveA += repayAmount;
            pool.totalBorrowedA -= repayAmount;
            position.borrowedA -= repayAmount;
        } else {
            pool.reserveB += repayAmount;
            pool.totalBorrowedB -= repayAmount;
            position.borrowedB -= repayAmount;
        }
        
        emit TokensRepaid(poolId, msg.sender, token, repayAmount);
    }
    
    function depositCollateral(bytes32 poolId, address token, uint256 amount) external nonReentrant {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool doesn't exist");
        require(token == pool.tokenA || token == pool.tokenB, "Invalid token");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        UserPosition storage position = userPositions[msg.sender][poolId];
        if (token == pool.tokenA) {
            position.collateralA += amount;
        } else {
            position.collateralB += amount;
        }
    }
    
    function withdrawCollateral(bytes32 poolId, address token, uint256 amount) external nonReentrant {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool doesn't exist");
        require(token == pool.tokenA || token == pool.tokenB, "Invalid token");
        
        UserPosition storage position = userPositions[msg.sender][poolId];
        updateInterest(msg.sender, poolId);
        
        bool isTokenA = token == pool.tokenA;
        uint256 collateral = isTokenA ? position.collateralA : position.collateralB;
        require(collateral >= amount, "Insufficient collateral");
        
        if (isTokenA) {
            position.collateralA -= amount;
        } else {
            position.collateralB -= amount;
        }
        
        uint256 collateralValue = getCollateralValue(msg.sender, poolId);
        uint256 borrowValue = getBorrowValue(msg.sender, poolId);
        
        require(borrowValue <= (collateralValue * COLLATERAL_FACTOR) / PRECISION, "Would be undercollateralized");
        
        IERC20(token).safeTransfer(msg.sender, amount);
    }
    
    // View Functions
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) 
        public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    function getCollateralValue(address user, bytes32 poolId) public view returns (uint256) {
        UserPosition storage position = userPositions[user][poolId];
        // Simplified: assuming both tokens have equal value
        return position.collateralA + position.collateralB;
    }
    
    function getBorrowValue(address user, bytes32 poolId) public view returns (uint256) {
        UserPosition storage position = userPositions[user][poolId];
        // Simplified: assuming both tokens have equal value
        return position.borrowedA + position.borrowedB;
    }
    
    function updateInterest(address user, bytes32 poolId) internal {
        UserPosition storage position = userPositions[user][poolId];
        if (position.lastUpdateTime == 0) {
            position.lastUpdateTime = block.timestamp;
            return;
        }
        
        uint256 timeElapsed = block.timestamp - position.lastUpdateTime;
        Pool storage pool = pools[poolId];
        
        if (position.borrowedA > 0) {
            uint256 interest = (position.borrowedA * pool.interestRateA * timeElapsed) / (365 days * PRECISION);
            position.borrowedA += interest;
        }
        
        if (position.borrowedB > 0) {
            uint256 interest = (position.borrowedB * pool.interestRateB * timeElapsed) / (365 days * PRECISION);
            position.borrowedB += interest;
        }
        
        position.lastUpdateTime = block.timestamp;
    }
    
    function getAllPools() external view returns (bytes32[] memory) {
        return poolIds;
    }
    
    function getPoolInfo(bytes32 poolId) external view returns (Pool memory) {
        return pools[poolId];
    }
    
    function getUserPosition(address user, bytes32 poolId) external view returns (UserPosition memory) {
        return userPositions[user][poolId];
    }
    
    // Utility functions
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
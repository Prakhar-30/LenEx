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
    event CollateralDeposited(bytes32 indexed poolId, address user, address token, uint256 amount);
    event CollateralWithdrawn(bytes32 indexed poolId, address user, address token, uint256 amount);

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
    
    // FIXED: Cross-token borrowing logic - can only borrow the token you didn't deposit as collateral
    function borrow(bytes32 poolId, address token, uint256 amount) external nonReentrant {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool doesn't exist");
        require(token == pool.tokenA || token == pool.tokenB, "Invalid token");
        
        UserPosition storage position = userPositions[msg.sender][poolId];
        updateInterest(msg.sender, poolId);
        
        bool isTokenA = token == pool.tokenA;
        
        // FIXED: Cross-token borrowing validation
        if (isTokenA) {
            // Trying to borrow tokenA - must have tokenB as collateral
            require(position.collateralB > 0, "Must deposit tokenB as collateral to borrow tokenA");
            require(position.collateralA == 0, "Cannot borrow tokenA if you have tokenA as collateral");
        } else {
            // Trying to borrow tokenB - must have tokenA as collateral
            require(position.collateralA > 0, "Must deposit tokenA as collateral to borrow tokenB");
            require(position.collateralB == 0, "Cannot borrow tokenB if you have tokenB as collateral");
        }
        
        // Check collateral ratio
        uint256 collateralValue = getCollateralValue(msg.sender, poolId);
        uint256 borrowValue = getBorrowValue(msg.sender, poolId) + amount;
        
        require(borrowValue <= (collateralValue * COLLATERAL_FACTOR) / PRECISION, "Insufficient collateral");
        
        // Check pool liquidity
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
        
        require(repayAmount > 0, "No debt to repay");
        
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
        require(amount > 0, "Amount must be greater than 0");
        
        UserPosition storage position = userPositions[msg.sender][poolId];
        bool isTokenA = token == pool.tokenA;
        
        // FIXED: Prevent depositing both tokens as collateral in the same pool
        if (isTokenA) {
            require(position.collateralB == 0 && position.borrowedB == 0, "Cannot deposit tokenA as collateral if you have tokenB position");
        } else {
            require(position.collateralA == 0 && position.borrowedA == 0, "Cannot deposit tokenB as collateral if you have tokenA position");
        }
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        if (isTokenA) {
            position.collateralA += amount;
        } else {
            position.collateralB += amount;
        }
        
        // Initialize last update time if it's the first deposit
        if (position.lastUpdateTime == 0) {
            position.lastUpdateTime = block.timestamp;
        }
        
        emit CollateralDeposited(poolId, msg.sender, token, amount);
    }
    
    function withdrawCollateral(bytes32 poolId, address token, uint256 amount) external nonReentrant {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool doesn't exist");
        require(token == pool.tokenA || token == pool.tokenB, "Invalid token");
        require(amount > 0, "Amount must be greater than 0");
        
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
        emit CollateralWithdrawn(poolId, msg.sender, token, amount);
    }
    
    // FIXED: Better value calculation functions
    function getCollateralValue(address user, bytes32 poolId) public view returns (uint256) {
        UserPosition storage position = userPositions[user][poolId];
        // Using simplified 1:1 token value ratio for now
        // In production, this should use price oracles
        return position.collateralA + position.collateralB;
    }
    
    function getBorrowValue(address user, bytes32 poolId) public view returns (uint256) {
        UserPosition storage position = userPositions[user][poolId];
        uint256 timeElapsed = block.timestamp - position.lastUpdateTime;
        Pool storage pool = pools[poolId];
        
        // Calculate current borrowed amounts with accrued interest
        uint256 currentBorrowedA = position.borrowedA;
        uint256 currentBorrowedB = position.borrowedB;
        
        if (currentBorrowedA > 0 && timeElapsed > 0) {
            uint256 interestA = (currentBorrowedA * pool.interestRateA * timeElapsed) / (365 days * PRECISION);
            currentBorrowedA += interestA;
        }
        
        if (currentBorrowedB > 0 && timeElapsed > 0) {
            uint256 interestB = (currentBorrowedB * pool.interestRateB * timeElapsed) / (365 days * PRECISION);
            currentBorrowedB += interestB;
        }
        
        // Using simplified 1:1 token value ratio for now
        return currentBorrowedA + currentBorrowedB;
    }
    
    // NEW: Function to get available tokens to borrow based on collateral
    function getAvailableTokensToBorrow(address user, bytes32 poolId) external view returns (
        address availableToken,
        uint256 maxBorrowAmount,
        bool canBorrow
    ) {
        Pool storage pool = pools[poolId];
        UserPosition storage position = userPositions[user][poolId];
        
        if (position.collateralA > 0 && position.collateralB == 0) {
            // Has tokenA as collateral, can borrow tokenB
            availableToken = pool.tokenB;
            canBorrow = true;
        } else if (position.collateralB > 0 && position.collateralA == 0) {
            // Has tokenB as collateral, can borrow tokenA
            availableToken = pool.tokenA;
            canBorrow = true;
        } else {
            // No collateral or mixed collateral (shouldn't happen with new logic)
            canBorrow = false;
            return (address(0), 0, false);
        }
        
        // Calculate max borrow amount
        uint256 collateralValue = getCollateralValue(user, poolId);
        uint256 currentBorrowValue = getBorrowValue(user, poolId);
        uint256 maxBorrowCapacity = (collateralValue * COLLATERAL_FACTOR) / PRECISION;
        
        if (maxBorrowCapacity > currentBorrowValue) {
            maxBorrowAmount = maxBorrowCapacity - currentBorrowValue;
        } else {
            maxBorrowAmount = 0;
        }
    }
    
    // FIXED: Better health factor calculation
    function getHealthFactor(address user, bytes32 poolId) public view returns (uint256) {
        uint256 collateralValue = getCollateralValue(user, poolId);
        uint256 borrowValue = getBorrowValue(user, poolId);
        
        if (borrowValue == 0) {
            return type(uint256).max; // Infinite health factor when no debt
        }
        
        if (collateralValue == 0) {
            return 0; // Zero health factor when no collateral but has debt
        }
        
        // Health factor = (collateralValue * collateralFactor) / borrowValue
        uint256 maxBorrowCapacity = (collateralValue * COLLATERAL_FACTOR) / PRECISION;
        return (maxBorrowCapacity * PRECISION) / borrowValue;
    }
    
    // View function to get detailed position info including health factor
    function getDetailedUserPosition(address user, bytes32 poolId) external view returns (
        UserPosition memory position,
        uint256 collateralValue,
        uint256 borrowValue,
        uint256 healthFactor,
        uint256 maxBorrowCapacity,
        uint256 availableToBorrow
    ) {
        position = userPositions[user][poolId];
        collateralValue = getCollateralValue(user, poolId);
        borrowValue = getBorrowValue(user, poolId);
        healthFactor = getHealthFactor(user, poolId);
        maxBorrowCapacity = (collateralValue * COLLATERAL_FACTOR) / PRECISION;
        
        if (maxBorrowCapacity > borrowValue) {
            availableToBorrow = maxBorrowCapacity - borrowValue;
        } else {
            availableToBorrow = 0;
        }
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
            pool.totalBorrowedA += interest;
        }
        
        if (position.borrowedB > 0) {
            uint256 interest = (position.borrowedB * pool.interestRateB * timeElapsed) / (365 days * PRECISION);
            position.borrowedB += interest;
            pool.totalBorrowedB += interest;
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
    
    // Enhanced view function to get all user positions with health factors
    function getAllUserPositions(address user) external view returns (
        bytes32[] memory activePoolIds,
        UserPosition[] memory positions,
        uint256[] memory healthFactors,
        uint256 totalCollateralValue,
        uint256 totalBorrowValue
    ) {
        uint256 activeCount = 0;
        
        // First pass: count active positions
        for (uint256 i = 0; i < poolIds.length; i++) {
            UserPosition memory position = userPositions[user][poolIds[i]];
            if (position.collateralA > 0 || position.collateralB > 0 || 
                position.borrowedA > 0 || position.borrowedB > 0) {
                activeCount++;
            }
        }
        
        // Second pass: populate arrays
        activePoolIds = new bytes32[](activeCount);
        positions = new UserPosition[](activeCount);
        healthFactors = new uint256[](activeCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < poolIds.length; i++) {
            bytes32 poolId = poolIds[i];
            UserPosition memory position = userPositions[user][poolId];
            
            if (position.collateralA > 0 || position.collateralB > 0 || 
                position.borrowedA > 0 || position.borrowedB > 0) {
                activePoolIds[index] = poolId;
                positions[index] = position;
                healthFactors[index] = getHealthFactor(user, poolId);
                
                totalCollateralValue += getCollateralValue(user, poolId);
                totalBorrowValue += getBorrowValue(user, poolId);
                
                index++;
            }
        }
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
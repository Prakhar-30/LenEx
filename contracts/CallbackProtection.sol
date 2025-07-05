// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "reactive-lib/abstract-base/AbstractCallback.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
interface IDeLexCore {
    struct UserPosition {
        uint256 liquidityShares;
        uint256 borrowedA;
        uint256 borrowedB;
        uint256 collateralA;
        uint256 collateralB;
        uint256 lastUpdateTime;
    }
    
    function getUserPosition(address user, bytes32 poolId) external view returns (UserPosition memory);
    function getHealthFactor(address user, bytes32 poolId) external view returns (uint256);
    function getBorrowValue(address user, bytes32 poolId) external view returns (uint256);
    function getCollateralValue(address user, bytes32 poolId) external view returns (uint256);
    function depositCollateral(bytes32 poolId, address token, uint256 amount) external;
    function COLLATERAL_FACTOR() external view returns (uint256);
}

contract DeLexLiquidationProtectionCallback is AbstractCallback{
    
    event PositionProtected(
        address indexed user,
        bytes32 indexed poolId,
        uint256 newHealthFactor,
        uint256 collateralAdded,
        address collateralToken
    );
    
    event ProtectionFailed(
        address indexed user,
        bytes32 indexed poolId,
        string reason
    );
    
    event DebugLog(
        string message,
        uint256 value1,
        uint256 value2
    );
    
    IDeLexCore public immutable delexCore;
    
    // Protection settings for each user per pool
    struct ProtectionConfig {
        uint256 thresholdHealthFactor;  // When to trigger protection (e.g., 1.2e18)
        uint256 targetHealthFactor;     // Target HF after protection (e.g., 1.5e18)
        address collateralToken;        // Token to add as collateral
        bool isActive;                  // Whether protection is active
        uint256 maxCollateralAmount;    // Max amount user allows to be used
    }
    
    mapping(address => mapping(bytes32 => ProtectionConfig)) public protectionConfigs;
    
    modifier validHealthFactors(uint256 threshold, uint256 target) {
        require(threshold > 1e18, "Threshold must be > 1.0");
        require(target > threshold, "Target must be > threshold");
        require(target <= 3e18, "Target too high (max 3.0)");
        _;
    }
    
    constructor() AbstractCallback(0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA) payable{
        delexCore = IDeLexCore(0x0Be9c90Ea6C387b974888dE1C21c6a0F96bC50C6);
    }
    
    /**
     * @notice Set up protection for a specific pool
     * @param poolId The pool to protect
     * @param thresholdHealthFactor Health factor threshold to trigger protection
     * @param targetHealthFactor Target health factor after protection
     * @param collateralToken Token to use for additional collateral
     * @param maxCollateralAmount Maximum amount of collateral token to use
     */
    function setupProtection(
        bytes32 poolId,
        uint256 thresholdHealthFactor,
        uint256 targetHealthFactor,
        address collateralToken,
        uint256 maxCollateralAmount
    ) external validHealthFactors(thresholdHealthFactor, targetHealthFactor) {
        require(collateralToken != address(0), "Invalid collateral token");
        require(maxCollateralAmount > 0, "Max collateral must be > 0");
        
        protectionConfigs[msg.sender][poolId] = ProtectionConfig({
            thresholdHealthFactor: thresholdHealthFactor,
            targetHealthFactor: targetHealthFactor,
            collateralToken: collateralToken,
            isActive: true,
            maxCollateralAmount: maxCollateralAmount
        });
        
        emit DebugLog("Protection setup", thresholdHealthFactor, targetHealthFactor);
    }
    
    /**
     * @notice Deactivate protection for a pool
     */
    function deactivateProtection(bytes32 poolId) external {
        protectionConfigs[msg.sender][poolId].isActive = false;
    }
    
    /**
     * @notice Main protection function called by reactive contract
     */
    function protectPosition(
        address /* sender */,
        address user,
        bytes32 poolId
    ) external authorizedSenderOnly {
        ProtectionConfig memory config = protectionConfigs[user][poolId];
        
        if (!config.isActive) {
            emit ProtectionFailed(user, poolId, "Protection not active");
            return;
        }
        
        try this._executeProtection(user, poolId, config) returns (uint256 collateralAdded) {
            uint256 finalHealthFactor = delexCore.getHealthFactor(user, poolId);
            emit PositionProtected(user, poolId, finalHealthFactor, collateralAdded, config.collateralToken);
        } catch Error(string memory reason) {
            emit ProtectionFailed(user, poolId, reason);
        } catch {
            emit ProtectionFailed(user, poolId, "Unknown error during protection");
        }
    }
    
    /**
     * @notice Internal function to execute protection logic
     */
    function _executeProtection(
        address user,
        bytes32 poolId,
        ProtectionConfig memory config
    ) external returns (uint256) {
        require(msg.sender == address(this), "Internal function only");
        
        uint256 currentHealthFactor = delexCore.getHealthFactor(user, poolId);
        
        // Check if protection is needed
        if (currentHealthFactor >= config.thresholdHealthFactor) {
            emit DebugLog("No protection needed", currentHealthFactor, config.thresholdHealthFactor);
            return 0;
        }
        
        // Check if user has debt (no protection needed if no debt)
        uint256 borrowValue = delexCore.getBorrowValue(user, poolId);
        if (borrowValue == 0) {
            emit DebugLog("No debt to protect", 0, 0);
            return 0;
        }
        
        // Calculate required collateral
        uint256 collateralNeeded = calculateCollateralNeeded(
            user,
            poolId,
            config.targetHealthFactor,
            config.collateralToken
        );
        
        if (collateralNeeded == 0) {
            emit DebugLog("No collateral needed", 0, 0);
            return 0;
        }
        
        // Check limits
        if (collateralNeeded > config.maxCollateralAmount) {
            collateralNeeded = config.maxCollateralAmount;
            emit DebugLog("Capped to max amount", collateralNeeded, config.maxCollateralAmount);
        }
        
        // Check user's token balance and allowance
        IERC20 collateralTokenContract = IERC20(config.collateralToken);
        uint256 userBalance = collateralTokenContract.balanceOf(user);
        uint256 allowance = collateralTokenContract.allowance(user, address(this));
        
        require(userBalance >= collateralNeeded, "Insufficient user balance");
        require(allowance >= collateralNeeded, "Insufficient allowance");
        
        // Transfer collateral from user and deposit to DeLex
        collateralTokenContract.transferFrom(user, address(this), collateralNeeded);
        collateralTokenContract.approve(address(delexCore), collateralNeeded);
        delexCore.depositCollateral(poolId, config.collateralToken, collateralNeeded);
        
        emit DebugLog("Collateral added", collateralNeeded, 0);
        return collateralNeeded;
    }
    
    /**
     * @notice Calculate how much collateral is needed to reach target health factor
     */
    function calculateCollateralNeeded(
        address user,
        bytes32 poolId,
        uint256 targetHealthFactor,
        address collateralToken
    ) public view returns (uint256) {
        uint256 currentCollateralValue = delexCore.getCollateralValue(user, poolId);
        uint256 borrowValue = delexCore.getBorrowValue(user, poolId);
        uint256 collateralFactor = delexCore.COLLATERAL_FACTOR();
        
        if (borrowValue == 0) return 0;
        
        // Required collateral value: (borrowValue * targetHF * 1e18) / collateralFactor
        uint256 requiredCollateralValue = (borrowValue * targetHealthFactor) / collateralFactor;
        
        if (requiredCollateralValue <= currentCollateralValue) {
            return 0; // Already sufficient
        }
        
        uint256 additionalCollateralValue = requiredCollateralValue - currentCollateralValue;
        
        // Convert value to token amount (simplified 1:1 ratio like in DeLex)
        // In production, you'd use price oracles
        uint8 decimals = IERC20Metadata(collateralToken).decimals();
        uint256 collateralNeeded;
        
        if (decimals == 18) {
            collateralNeeded = additionalCollateralValue;
        } else if (decimals < 18) {
            collateralNeeded = additionalCollateralValue / (10 ** (18 - decimals));
        } else {
            collateralNeeded = additionalCollateralValue * (10 ** (decimals - 18));
        }
        
        return collateralNeeded;
    }
    
    /**
     * @notice Check if protection is needed for a user's position
     */
    function isProtectionNeeded(address user, bytes32 poolId) external view returns (bool) {
        ProtectionConfig memory config = protectionConfigs[user][poolId];
        
        if (!config.isActive) return false;
        
        uint256 currentHealthFactor = delexCore.getHealthFactor(user, poolId);
        uint256 borrowValue = delexCore.getBorrowValue(user, poolId);
        
        return borrowValue > 0 && currentHealthFactor < config.thresholdHealthFactor;
    }
    
    /**
     * @notice Get protection configuration for a user and pool
     */
    function getProtectionConfig(address user, bytes32 poolId) 
        external 
        view 
        returns (ProtectionConfig memory) 
    {
        return protectionConfigs[user][poolId];
    }
}
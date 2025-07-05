// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "reactive-lib/interfaces/IReactive.sol";
import "reactive-lib/abstract-base/AbstractPausableReactive.sol";

contract DeLexLiquidationProtectionReactive is IReactive, AbstractPausableReactive {
    
    event HealthFactorChecked(
        address indexed user, 
        bytes32 indexed poolId, 
        uint256 currentHealthFactor, 
        uint256 threshold
    );
    
    event ProtectionTriggered(
        address indexed user,
        bytes32 indexed poolId,
        uint256 healthFactor
    );
    
    event Done();
    
    uint256 private constant SEPOLIA_CHAIN_ID = 11155111;
    uint256 private constant POSITION_PROTECTED_TOPIC_0 = 0x7c35d88b632b81e36da99d43f78d9a1a4a1d00a84e9b0d3c2f5f7f6a8c9d0e1f; // Event signature hash
    uint64 private constant CALLBACK_GAS_LIMIT = 1000000;
    
    // State variables
    bool private triggered;
    address private callbackContract;
    address private protectedUser;
    bytes32 private protectedPoolId;
    uint256 private healthFactorThreshold;
    uint256 public cronTopic;
    
    constructor(
        address _callbackContract,
        address _protectedUser,
        bytes32 _protectedPoolId,
        uint256 _healthFactorThreshold
    ) payable {
        service = ISystemContract(payable(0x0000000000000000000000000000000000fffFfF));
        triggered = false;
        callbackContract = _callbackContract;
        protectedUser = _protectedUser;
        protectedPoolId = _protectedPoolId;
        healthFactorThreshold = _healthFactorThreshold;
        cronTopic = 0xf02d6ea5c22a71cffe930a4523fcb4f129be6c804db50e4202fb4e0b07ccb514;
        
        if (!vm) {
            // Subscribe to CRON events for periodic checks
            service.subscribe(
                block.chainid,
                address(service),
                cronTopic,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );
            
            // Subscribe to PositionProtected events from callback contract
            service.subscribe(
                SEPOLIA_CHAIN_ID,
                callbackContract,
                POSITION_PROTECTED_TOPIC_0,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );
        }
    }
    
    function getPausableSubscriptions() internal view override returns (Subscription[] memory) {
        Subscription[] memory result = new Subscription[](1);
        result[0] = Subscription(
            block.chainid,
            address(service),
            cronTopic,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE
        );
        return result;
    }
    
    /**
     * @notice Main reactive function that responds to events
     */
    function react(LogRecord calldata log) external vmOnly {
        if (log.topic_0 == cronTopic) {
            // CRON event - check if protection is needed
            if (triggered) {
                return; // Already triggered, wait for completion
            }
            
            // Prepare callback payload to check and protect position
            bytes memory payload = abi.encodeWithSignature(
                "protectPosition(address,address,bytes32)",
                address(0), // sender (unused in callback)
                protectedUser,
                protectedPoolId
            );
            
            triggered = true;
            
            emit ProtectionTriggered(protectedUser, protectedPoolId, 0);
            
            // Send callback to Sepolia
            emit Callback(
                SEPOLIA_CHAIN_ID,
                callbackContract,
                CALLBACK_GAS_LIMIT,
                payload
            );
            
        } else if (log._contract == callbackContract && log.topic_0 == POSITION_PROTECTED_TOPIC_0) {
            // Position was protected, reset trigger flag
            triggered = false;
            emit Done();
        }
    }
    
    /**
     * @notice Update protection parameters
     */
    function updateProtectionParams(
        address _newUser,
        bytes32 _newPoolId,
        uint256 _newThreshold
    ) external {
        require(msg.sender == protectedUser || msg.sender == address(service), "Unauthorized");
        
        protectedUser = _newUser;
        protectedPoolId = _newPoolId;
        healthFactorThreshold = _newThreshold;
    }
    
    /**
     * @notice Get current protection parameters
     */
    function getProtectionParams() external view returns (
        address user,
        bytes32 poolId,
        uint256 threshold,
        bool isTriggered
    ) {
        return (protectedUser, protectedPoolId, healthFactorThreshold, triggered);
    }
    
    /**
     * @notice Manual trigger for testing (only for the protected user)
     */
    function manualTrigger() external {
        require(msg.sender == protectedUser, "Only protected user can manually trigger");
        require(!triggered, "Already triggered");
        
        bytes memory payload = abi.encodeWithSignature(
            "protectPosition(address,address,bytes32)",
            address(0),
            protectedUser,
            protectedPoolId
        );
        
        triggered = true;
        
        emit ProtectionTriggered(protectedUser, protectedPoolId, 0);
        
        emit Callback(
            SEPOLIA_CHAIN_ID,
            callbackContract,
            CALLBACK_GAS_LIMIT,
            payload
        );
    }
}
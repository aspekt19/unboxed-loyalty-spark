// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/AggregatorV3Interface.sol";
import "./interfaces/IInvestmentStrategy.sol";

/**
 * @title RoundUpVault
 * @notice Main contract for Round-Up investing
 * @dev Simplified MVP version for Base Sepolia testnet
 */
contract RoundUpVault {
    // Chainlink Price Feed for ETH/USD on Base Sepolia
    AggregatorV3Interface public constant PRICE_FEED = 
        AggregatorV3Interface(0x1e6a7102e3A7A661D79E78028f8f2C86F76D0a94);
    
    // Strategy types
    enum Strategy {
        CONSERVATIVE  // Only Aave for MVP
    }
    
    // User settings
    struct UserSettings {
        uint256 multiplier;      // 100 = 1x, 200 = 2x, etc.
        uint256 dailyLimitUSD;   // Max daily round-up in USD (8 decimals)
        bool autoInvest;         // Auto-invest pending balance
        Strategy strategy;       // Investment strategy
        bool isActive;           // Is round-up active
    }
    
    // User balance tracking
    struct UserBalance {
        uint256 pendingRoundUp;     // Pending ETH not yet invested
        uint256 investedAmount;     // Total invested in USD (6 decimals)
        uint256 lastRoundUpTime;    // Last round-up timestamp
        uint256 dailyRoundUpTotal;  // Total round-up today in USD (8 decimals)
    }
    
    // State
    address public owner;
    IInvestmentStrategy public strategy;
    
    mapping(address => UserSettings) public userSettings;
    mapping(address => UserBalance) public userBalances;
    
    // Constants
    uint256 public constant ONE_DOLLAR = 10**8;  // USD with 8 decimals (Chainlink)
    uint256 public constant DAY = 86400;         // 1 day in seconds
    uint256 public constant DEFAULT_MULTIPLIER = 100;  // 1x
    uint256 public constant DEFAULT_DAILY_LIMIT = 10 * ONE_DOLLAR; // $10
    
    // Events
    event RoundUpExecuted(address indexed user, uint256 ethAmount, uint256 usdValue);
    event AutoInvested(address indexed user, uint256 amount, uint256 usdValue);
    event ManualInvestment(address indexed user, uint256 amount, uint256 usdValue);
    event Withdrawn(address indexed user, uint256 amount);
    event SettingsUpdated(address indexed user, UserSettings settings);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor(address _strategyAddress) {
        owner = msg.sender;
        strategy = IInvestmentStrategy(_strategyAddress);
    }
    
    /**
     * @notice Initialize user settings (called on first use)
     */
    function initializeSettings() external {
        require(!userSettings[msg.sender].isActive, "Already initialized");
        
        userSettings[msg.sender] = UserSettings({
            multiplier: DEFAULT_MULTIPLIER,
            dailyLimitUSD: DEFAULT_DAILY_LIMIT,
            autoInvest: true,
            strategy: Strategy.CONSERVATIVE,
            isActive: true
        });
        
        emit SettingsUpdated(msg.sender, userSettings[msg.sender]);
    }
    
    /**
     * @notice Update user settings
     */
    function updateSettings(
        uint256 _multiplier,
        uint256 _dailyLimitUSD,
        bool _autoInvest,
        Strategy _strategy
    ) external {
        require(userSettings[msg.sender].isActive, "Not initialized");
        require(_multiplier >= 100 && _multiplier <= 1000, "Multiplier must be 1x-10x");
        require(_dailyLimitUSD >= ONE_DOLLAR, "Daily limit must be >= $1");
        
        userSettings[msg.sender].multiplier = _multiplier;
        userSettings[msg.sender].dailyLimitUSD = _dailyLimitUSD;
        userSettings[msg.sender].autoInvest = _autoInvest;
        userSettings[msg.sender].strategy = _strategy;
        
        emit SettingsUpdated(msg.sender, userSettings[msg.sender]);
    }
    
    /**
     * @notice Get current ETH price in USD (8 decimals)
     */
    function getEthPrice() public view returns (uint256) {
        (, int256 price, , , ) = PRICE_FEED.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price);
    }
    
    /**
     * @notice Calculate round-up amount for a purchase
     * @param _purchaseValueUSD Purchase value in USD (8 decimals)
     * @return roundUpUSD Round-up amount in USD (8 decimals)
     */
    function calculateRoundUp(uint256 _purchaseValueUSD) public pure returns (uint256 roundUpUSD) {
        // Round up to nearest dollar
        uint256 remainder = _purchaseValueUSD % ONE_DOLLAR;
        if (remainder > 0) {
            return ONE_DOLLAR - remainder;
        }
        return 0;
    }
    
    /**
     * @notice Execute round-up transaction
     * @param _purchaseValueUSD The primary purchase value in USD (8 decimals)
     */
    function roundUp(uint256 _purchaseValueUSD) external payable {
        require(userSettings[msg.sender].isActive, "Round-up not active");
        require(msg.value > 0, "No ETH sent");
        
        UserSettings memory settings = userSettings[msg.sender];
        UserBalance storage balance = userBalances[msg.sender];
        
        // Reset daily counter if new day
        if (block.timestamp - balance.lastRoundUpTime >= DAY) {
            balance.dailyRoundUpTotal = 0;
        }
        
        // Calculate expected round-up in USD
        uint256 baseRoundUpUSD = calculateRoundUp(_purchaseValueUSD);
        uint256 roundUpUSD = (baseRoundUpUSD * settings.multiplier) / 100;
        
        // Check daily limit
        require(
            balance.dailyRoundUpTotal + roundUpUSD <= settings.dailyLimitUSD,
            "Daily limit exceeded"
        );
        
        // Get ETH price and verify sent amount is reasonable
        uint256 ethPrice = getEthPrice();
        uint256 ethValueUSD = (msg.value * ethPrice) / 1 ether;
        
        // Allow 20% tolerance for price fluctuations between client and contract
        require(
            ethValueUSD >= (roundUpUSD * 80) / 100 && ethValueUSD <= (roundUpUSD * 120) / 100,
            "ETH amount mismatch"
        );
        
        // Update balances
        balance.pendingRoundUp += msg.value;
        balance.lastRoundUpTime = block.timestamp;
        balance.dailyRoundUpTotal += roundUpUSD;
        
        emit RoundUpExecuted(msg.sender, msg.value, roundUpUSD);
        
        // Auto-invest if enabled
        if (settings.autoInvest) {
            _invest(msg.sender, msg.value);
        }
    }
    
    /**
     * @notice Manually invest pending balance
     */
    function invest() external {
        require(userSettings[msg.sender].isActive, "Not active");
        uint256 pending = userBalances[msg.sender].pendingRoundUp;
        require(pending > 0, "No pending balance");
        
        _invest(msg.sender, pending);
    }
    
    /**
     * @notice Internal investment logic
     */
    function _invest(address _user, uint256 _amount) internal {
        require(_amount > 0, "Amount must be > 0");
        
        // Call strategy contract to invest
        uint256 usdValue = strategy.deposit{value: _amount}(_user);
        
        // Update user balance
        userBalances[_user].investedAmount += usdValue;
        userBalances[_user].pendingRoundUp -= _amount;
        
        emit AutoInvested(_user, _amount, usdValue);
    }
    
    /**
     * @notice Withdraw investment
     * @param _amountUSD Amount to withdraw in USD (6 decimals)
     */
    function withdraw(uint256 _amountUSD) external {
        require(_amountUSD > 0, "Amount must be > 0");
        require(userBalances[msg.sender].investedAmount >= _amountUSD, "Insufficient balance");
        
        // Call strategy to withdraw
        uint256 ethReturned = strategy.withdraw(msg.sender, _amountUSD);
        
        // Update balance
        userBalances[msg.sender].investedAmount -= _amountUSD;
        
        // Send ETH to user
        (bool success, ) = msg.sender.call{value: ethReturned}("");
        require(success, "ETH transfer failed");
        
        emit Withdrawn(msg.sender, ethReturned);
    }
    
    /**
     * @notice Get user's current investment value
     */
    function getUserInvestmentValue(address _user) external view returns (uint256) {
        return strategy.getUserValue(_user);
    }
    
    /**
     * @notice Emergency withdraw for owner
     */
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @notice Update strategy contract
     */
    function updateStrategy(address _newStrategy) external onlyOwner {
        strategy = IInvestmentStrategy(_newStrategy);
    }
    
    // Receive ETH from strategy withdrawals
    receive() external payable {}
}

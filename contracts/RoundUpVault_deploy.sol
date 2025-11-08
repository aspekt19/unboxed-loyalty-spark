// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AggregatorV3Interface
 * @notice Interface for Chainlink Price Feeds
 */
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/**
 * @title IInvestmentStrategy
 * @notice Interface for investment strategy contracts
 */
interface IInvestmentStrategy {
    function deposit(address _user) external payable returns (uint256 amountInvested);
    function withdraw(address _user, uint256 _amount) external returns (uint256 ethReturned);
    function getUserValue(address _user) external view returns (uint256 currentValue);
}

/**
 * @title RoundUpVault
 * @notice Main contract for Round-Up investment system
 * @dev MVP version for Base Sepolia
 */
contract RoundUpVault {
    // Constants
    uint256 public constant USD_DECIMALS = 8;
    uint256 public constant MIN_ROUND_UP = 0.0001 ether; // ~$0.34 at $3400/ETH
    uint256 public constant MAX_DAILY_ROUND_UP = 1 ether;
    uint256 public constant ONE_DAY = 1 days;
    
    address public owner;
    IInvestmentStrategy public strategy;
    AggregatorV3Interface public priceFeed;
    
    enum Strategy {
        AAVE_CONSERVATIVE
    }
    
    struct UserSettings {
        bool autoInvest;
        uint256 roundUpMultiplier;
        uint256 dailyLimit;
        uint256 lastResetTime;
        uint256 dailySpent;
    }
    
    struct UserBalance {
        uint256 pendingRoundUp;
        uint256 invested;
    }
    
    mapping(address => UserSettings) public userSettings;
    mapping(address => UserBalance) public userBalances;
    
    event SettingsUpdated(address indexed user, bool autoInvest, uint256 roundUpMultiplier, uint256 dailyLimit);
    event RoundUpCollected(address indexed user, uint256 roundUpAmount, uint256 primaryTxValue);
    event Invested(address indexed user, uint256 amount, uint256 investedValue);
    event Withdrawn(address indexed user, uint256 amount, uint256 ethReturned);
    event StrategyUpdated(address indexed newStrategy);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _priceFeed, address _strategy) {
        owner = msg.sender;
        priceFeed = AggregatorV3Interface(_priceFeed);
        strategy = IInvestmentStrategy(_strategy);
    }
    
    function initializeSettings() external {
        require(userSettings[msg.sender].dailyLimit == 0, "Already initialized");
        
        userSettings[msg.sender] = UserSettings({
            autoInvest: true,
            roundUpMultiplier: 1,
            dailyLimit: MAX_DAILY_ROUND_UP,
            lastResetTime: block.timestamp,
            dailySpent: 0
        });
        
        emit SettingsUpdated(msg.sender, true, 1, MAX_DAILY_ROUND_UP);
    }
    
    function updateSettings(
        bool _autoInvest,
        uint256 _roundUpMultiplier,
        uint256 _dailyLimit
    ) external {
        require(_roundUpMultiplier > 0 && _roundUpMultiplier <= 10, "Invalid multiplier");
        require(_dailyLimit >= MIN_ROUND_UP && _dailyLimit <= MAX_DAILY_ROUND_UP, "Invalid limit");
        
        UserSettings storage settings = userSettings[msg.sender];
        settings.autoInvest = _autoInvest;
        settings.roundUpMultiplier = _roundUpMultiplier;
        settings.dailyLimit = _dailyLimit;
        
        emit SettingsUpdated(msg.sender, _autoInvest, _roundUpMultiplier, _dailyLimit);
    }
    
    function getEthPrice() public view returns (uint256) {
        (, int256 price, , ,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price);
    }
    
    function calculateRoundUp(uint256 _ethAmount) public view returns (uint256) {
        uint256 ethPrice = getEthPrice();
        uint256 purchaseValueUSD = (_ethAmount * ethPrice) / (10 ** 18);
        uint256 nextDollar = ((purchaseValueUSD / (10 ** USD_DECIMALS)) + 1) * (10 ** USD_DECIMALS);
        uint256 roundUpUSD = nextDollar - purchaseValueUSD;
        uint256 roundUpETH = (roundUpUSD * (10 ** 18)) / ethPrice;
        
        return roundUpETH;
    }
    
    function roundUp(uint256 _primaryTxValueUSD) external payable {
        require(msg.value >= MIN_ROUND_UP, "Round-up too small");
        
        UserSettings storage settings = userSettings[msg.sender];
        
        if (block.timestamp >= settings.lastResetTime + ONE_DAY) {
            settings.dailySpent = 0;
            settings.lastResetTime = block.timestamp;
        }
        
        uint256 effectiveRoundUp = msg.value * settings.roundUpMultiplier;
        require(settings.dailySpent + effectiveRoundUp <= settings.dailyLimit, "Daily limit exceeded");
        
        settings.dailySpent += effectiveRoundUp;
        userBalances[msg.sender].pendingRoundUp += msg.value;
        
        emit RoundUpCollected(msg.sender, msg.value, _primaryTxValueUSD);
        
        if (settings.autoInvest && userBalances[msg.sender].pendingRoundUp >= MIN_ROUND_UP) {
            _invest(msg.sender);
        }
    }
    
    function invest() external {
        require(userBalances[msg.sender].pendingRoundUp > 0, "No pending round-up");
        _invest(msg.sender);
    }
    
    function _invest(address _user) internal {
        uint256 amount = userBalances[_user].pendingRoundUp;
        require(amount > 0, "Nothing to invest");
        
        userBalances[_user].pendingRoundUp = 0;
        
        uint256 investedValue = strategy.deposit{value: amount}(_user);
        userBalances[_user].invested += investedValue;
        
        emit Invested(_user, amount, investedValue);
    }
    
    function withdraw(uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        require(userBalances[msg.sender].invested >= _amount, "Insufficient invested balance");
        
        userBalances[msg.sender].invested -= _amount;
        
        uint256 ethReturned = strategy.withdraw(msg.sender, _amount);
        
        (bool success, ) = msg.sender.call{value: ethReturned}("");
        require(success, "ETH transfer failed");
        
        emit Withdrawn(msg.sender, _amount, ethReturned);
    }
    
    function getUserInvestmentValue(address _user) external view returns (uint256) {
        return strategy.getUserValue(_user);
    }
    
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    function updateStrategy(address _newStrategy) external onlyOwner {
        strategy = IInvestmentStrategy(_newStrategy);
        emit StrategyUpdated(_newStrategy);
    }
    
    receive() external payable {}
}

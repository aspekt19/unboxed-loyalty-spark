// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LendingPlusStrategy
 * @notice Medium-risk investment strategy using Compound V3 on Base Mainnet
 * @dev Deposits ETH into Compound V3 cWETHv3 market for higher yields
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Deploy this contract (no constructor parameters)
 * 2. Deploy RoundUpVault with this strategy address (or deploy vault with Aave first)
 * 3. Call setVault(vaultAddress) on this contract
 */

// ============================
// BASE MAINNET ADDRESSES
// ============================
address constant WETH = 0x4200000000000000000000000000000000000006;
address constant C_WETH_V3 = 0x46e6b214b524310239732D51387075E0e70970bf; // Compound V3 cWETHv3

// ============================
// INTERFACES
// ============================

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IComet {
    function supply(address asset, uint256 amount) external;
    function withdraw(address asset, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface IInvestmentStrategy {
    function deposit(address _user) external payable returns (uint256 amountInvested);
    function withdraw(address _user, uint256 _amount) external returns (uint256 ethReturned);
    function getUserValue(address _user) external view returns (uint256 currentValue);
}

// ============================
// MAIN CONTRACT
// ============================

contract LendingPlusStrategy is IInvestmentStrategy {
    // Immutable protocol addresses
    IComet public immutable comet = IComet(C_WETH_V3);
    IERC20 public immutable weth = IERC20(WETH);

    // State variables
    address public vault;
    address public owner;
    
    // User accounting
    mapping(address => uint256) public userShares;
    uint256 public totalShares;
    
    // Events
    event VaultSet(address indexed vault);
    event Deposited(address indexed user, uint256 ethAmount, uint256 shares);
    event Withdrawn(address indexed user, uint256 shares, uint256 ethAmount);

    // ============================
    // CONSTRUCTOR
    // ============================
    
    constructor() {
        owner = msg.sender;
    }

    // ============================
    // MODIFIERS
    // ============================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }

    // ============================
    // SETUP FUNCTIONS
    // ============================
    
    /**
     * @notice Set the vault address and approve tokens
     * @dev Can only be called once by owner after RoundUpVault is deployed
     * @param _vault Address of the RoundUpVault contract
     */
    function setVault(address _vault) external onlyOwner {
        require(vault == address(0), "Vault already set");
        require(_vault != address(0), "Invalid vault");
        vault = _vault;
        
        // Approve WETH to Compound V3 Comet
        weth.approve(address(comet), type(uint256).max);
        
        emit VaultSet(_vault);
    }

    // Receive ETH
    receive() external payable {}

    // ============================
    // STRATEGY FUNCTIONS
    // ============================
    
    /**
     * @notice Deposit ETH into Compound V3
     * @dev Called by RoundUpVault when user invests
     * @param _user Address of the user
     * @return amountInvested Amount of ETH invested
     */
    function deposit(address _user) external payable onlyVault override returns (uint256) {
        require(msg.value > 0, "Amount must be > 0");
        
        uint256 ethAmount = msg.value;
        
        // 1. Wrap ETH to WETH
        (bool success, ) = WETH.call{value: ethAmount}("");
        require(success, "WETH wrap failed");
        
        // 2. Supply WETH to Compound V3 Comet
        comet.supply(WETH, ethAmount);
        
        // 3. Track user shares
        userShares[_user] += ethAmount;
        totalShares += ethAmount;
        
        emit Deposited(_user, ethAmount, ethAmount);
        return ethAmount;
    }

    /**
     * @notice Withdraw ETH from Compound V3
     * @dev Called by RoundUpVault when user withdraws
     * @param _user Address of the user
     * @param _amount Amount of shares to withdraw
     * @return ethReturned Amount of ETH returned to vault
     */
    function withdraw(address _user, uint256 _amount) external onlyVault override returns (uint256) {
        require(userShares[_user] >= _amount, "Insufficient balance");
        
        // Calculate actual amount with accrued interest
        uint256 totalValue = comet.balanceOf(address(this));
        uint256 actualAmount = totalShares > 0 
            ? (_amount * totalValue) / totalShares 
            : _amount;
        
        // 1. Withdraw WETH from Compound V3 Comet
        comet.withdraw(WETH, actualAmount);
        
        // 2. Unwrap WETH to ETH
        (bool success, ) = WETH.call(abi.encodeWithSignature("withdraw(uint256)", actualAmount));
        require(success, "WETH unwrap failed");
        
        // 3. Update shares
        userShares[_user] -= _amount;
        totalShares -= _amount;
        
        // 4. Send ETH to vault (vault will forward to user)
        (bool sent, ) = vault.call{value: actualAmount}("");
        require(sent, "ETH transfer failed");

        emit Withdrawn(_user, _amount, actualAmount);
        return actualAmount;
    }

    /**
     * @notice Get current value of user's investment
     * @dev Calculates value including accrued interest from Compound
     * @param _user Address of the user
     * @return currentValue Current value in ETH (includes accrued interest)
     */
    function getUserValue(address _user) external view override returns (uint256) {
        if (totalShares == 0) return 0;
        
        // Get current balance of contract in Compound (with interest)
        uint256 totalValue = comet.balanceOf(address(this));
        
        // Calculate user's share of total value
        return (userShares[_user] * totalValue) / totalShares;
    }

    // ============================
    // EMERGENCY FUNCTIONS
    // ============================
    
    /**
     * @notice Emergency withdraw all ETH to owner
     * @dev Only callable by owner in case of emergency
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner.call{value: balance}("");
            require(success, "Transfer failed");
        }
    }
}

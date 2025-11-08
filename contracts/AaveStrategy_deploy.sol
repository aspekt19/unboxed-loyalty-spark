// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IInvestmentStrategy
 * @notice Interface for investment strategy contracts
 */
interface IInvestmentStrategy {
    function deposit(address _user) external payable returns (uint256 amountInvested);
    function withdraw(address _user, uint256 _amount) external returns (uint256 ethReturned);
    function getUserValue(address _user) external view returns (uint256 currentValue);
}

// External Interfaces
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

/**
 * @title AaveStrategy
 * @notice Conservative strategy - deposits into Aave V3 USDC
 * @dev Simplified MVP version for Base Sepolia
 */
contract AaveStrategy is IInvestmentStrategy {
    // Base Sepolia addresses
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address public constant AAVE_POOL = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;
    address public constant DEX_ROUTER = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602;
    
    address public immutable vault;
    
    mapping(address => uint256) public userDeposits;
    
    event Deposited(address indexed user, uint256 ethAmount, uint256 usdcAmount);
    event Withdrawn(address indexed user, uint256 usdcAmount, uint256 ethAmount);
    
    modifier onlyVault() {
        require(msg.sender == vault, "Only vault can call");
        _;
    }
    
    constructor(address _vault) {
        vault = _vault;
        IERC20(WETH).approve(DEX_ROUTER, type(uint256).max);
        IERC20(USDC).approve(AAVE_POOL, type(uint256).max);
    }
    
    function deposit(address _user) external payable onlyVault returns (uint256 amountInvested) {
        require(msg.value > 0, "No ETH sent");
        
        IWETH(WETH).deposit{value: msg.value}();
        uint256 wethAmount = msg.value;
        
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = USDC;
        
        uint256[] memory amountsOut = IUniswapV2Router(DEX_ROUTER).getAmountsOut(wethAmount, path);
        uint256 minUsdcOut = (amountsOut[1] * 98) / 100;
        
        uint256[] memory amounts = IUniswapV2Router(DEX_ROUTER).swapExactTokensForTokens(
            wethAmount,
            minUsdcOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        uint256 usdcReceived = amounts[1];
        require(usdcReceived > 0, "Swap failed");
        
        IAavePool(AAVE_POOL).supply(USDC, usdcReceived, address(this), 0);
        userDeposits[_user] += usdcReceived;
        
        emit Deposited(_user, msg.value, usdcReceived);
        return usdcReceived;
    }
    
    function withdraw(address _user, uint256 _amount) external onlyVault returns (uint256 ethReturned) {
        require(_amount > 0, "Amount must be > 0");
        require(userDeposits[_user] >= _amount, "Insufficient balance");
        
        uint256 usdcWithdrawn = IAavePool(AAVE_POOL).withdraw(USDC, _amount, address(this));
        
        address[] memory path = new address[](2);
        path[0] = USDC;
        path[1] = WETH;
        
        IERC20(USDC).approve(DEX_ROUTER, usdcWithdrawn);
        
        uint256[] memory amountsOut = IUniswapV2Router(DEX_ROUTER).getAmountsOut(usdcWithdrawn, path);
        uint256 minWethOut = (amountsOut[1] * 98) / 100;
        
        uint256[] memory amounts = IUniswapV2Router(DEX_ROUTER).swapExactTokensForTokens(
            usdcWithdrawn,
            minWethOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        uint256 wethReceived = amounts[1];
        
        IWETH(WETH).withdraw(wethReceived);
        
        (bool success, ) = vault.call{value: wethReceived}("");
        require(success, "ETH transfer failed");
        
        userDeposits[_user] -= _amount;
        
        emit Withdrawn(_user, _amount, wethReceived);
        return wethReceived;
    }
    
    function getUserValue(address _user) external view returns (uint256 currentValue) {
        return userDeposits[_user];
    }
    
    receive() external payable {}
}

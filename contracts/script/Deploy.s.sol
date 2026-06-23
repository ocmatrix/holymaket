// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract DeployScript is Script {
    struct DeployConfig {
        bool broadcast;
        uint256 privateKey;
        address deployer;
        address resolver;
        address feeRouter;
        address treasury;
        address collateral;
        address multisigAdmin;
        bool deployStandaloneMarket;
        uint256 initialCollateral;
        uint16 initialPriceYesBps;
        uint256 minTradeAmount;
        uint256 maxTradeAmount;
        uint16 maxSlippageBps;
        uint16 feeBps;
        uint16 systemMaxFeeBps;
        uint16 systemMaxSlippageBps;
        uint16 tradeCapBps;
        uint256 minInitialCollateral;
        uint16 minInitialPriceYesBps;
        uint16 maxInitialPriceYesBps;
        uint64 startTime;
        uint64 endTime;
        string question;
        string metadataURI;
    }

    function run() external {
        DeployConfig memory c = _loadConfig();

        if (c.broadcast) {
            require(c.privateKey != 0, "missing PRIVATE_KEY");
            require(c.multisigAdmin != address(0), "missing MULTISIG_ADMIN");
            vm.startBroadcast(c.privateKey);
        }

        CPMMEngine engine = new CPMMEngine();

        IERC20 collateralToken;
        if (c.collateral == address(0)) {
            MockUSDT usdt = new MockUSDT();
            collateralToken = IERC20(address(usdt));
            address mintTo = c.broadcast ? vm.addr(c.privateKey) : msg.sender;
            usdt.mint(mintTo, c.initialCollateral * 10);
        } else {
            collateralToken = IERC20(c.collateral);
        }

        MarketFactory factory = new MarketFactory(
            c.systemMaxFeeBps,
            c.systemMaxSlippageBps,
            c.tradeCapBps,
            c.minInitialCollateral,
            c.minInitialPriceYesBps,
            c.maxInitialPriceYesBps,
            c.resolver,
            c.feeRouter,
            c.treasury
        );

        factory.setAmmEngine(address(engine));
        factory.setCollateralAllowed(address(collateralToken), true);
        _transferFactoryAdmin(factory, c.multisigAdmin, c.deployer);

        if (c.deployStandaloneMarket) {
            BinaryPredictionMarket market = new BinaryPredictionMarket(
                c.question,
                c.metadataURI,
                address(collateralToken),
                c.startTime,
                c.endTime,
                c.initialCollateral,
                c.initialPriceYesBps,
                c.minTradeAmount,
                c.maxTradeAmount,
                c.maxSlippageBps,
                c.feeBps,
                c.resolver,
                c.feeRouter,
                c.treasury
            );

            market.setAmmEngine(address(engine));
            market.setMarketId(0);

            if (c.collateral == address(0)) {
                if (!c.broadcast) {
                    vm.prank(msg.sender);
                }
                require(collateralToken.transfer(address(market), c.initialCollateral), "fund market failed");
                market.initializeLiquidity(c.initialCollateral, c.initialPriceYesBps);
            }
            _transferMarketAdmin(market, c.multisigAdmin, c.deployer);
        }

        if (c.broadcast) {
            vm.stopBroadcast();
        }
    }

    function _loadConfig() internal view returns (DeployConfig memory c) {
        c.broadcast = vm.envOr("BROADCAST", false);
        c.privateKey = vm.envOr("PRIVATE_KEY", uint256(0));

        address deployer = c.privateKey == 0 ? msg.sender : vm.addr(c.privateKey);
        c.deployer = deployer;
        c.resolver = vm.envOr("RESOLVER", deployer);
        c.feeRouter = vm.envOr("FEE_ROUTER", deployer);
        c.treasury = vm.envOr("TREASURY", deployer);
        c.collateral = vm.envOr("COLLATERAL", address(0));
        c.multisigAdmin = vm.envOr("MULTISIG_ADMIN", address(0));

        c.deployStandaloneMarket = vm.envOr("DEPLOY_STANDALONE_MARKET", true);

        c.initialCollateral = vm.envOr("INITIAL_COLLATERAL", uint256(1_000_000));
        c.initialPriceYesBps = uint16(vm.envOr("INITIAL_PRICE_YES_BPS", uint256(5000)));
        c.minTradeAmount = vm.envOr("MIN_TRADE_AMOUNT", uint256(1));
        c.maxTradeAmount = vm.envOr("MAX_TRADE_AMOUNT", uint256(100_000));
        c.maxSlippageBps = uint16(vm.envOr("MAX_SLIPPAGE_BPS", uint256(500)));
        c.feeBps = uint16(vm.envOr("FEE_BPS", uint256(50)));

        c.systemMaxFeeBps = uint16(vm.envOr("SYSTEM_MAX_FEE_BPS", uint256(500)));
        c.systemMaxSlippageBps = uint16(vm.envOr("SYSTEM_MAX_SLIPPAGE_BPS", uint256(1000)));
        c.tradeCapBps = uint16(vm.envOr("TRADE_CAP_BPS", uint256(1000)));
        c.minInitialCollateral = vm.envOr("MIN_INITIAL_COLLATERAL", uint256(1_000_000));
        c.minInitialPriceYesBps = uint16(vm.envOr("MIN_INITIAL_PRICE_YES_BPS", uint256(3000)));
        c.maxInitialPriceYesBps = uint16(vm.envOr("MAX_INITIAL_PRICE_YES_BPS", uint256(7000)));

        c.startTime = uint64(vm.envOr("START_TIME", uint256(block.timestamp)));
        c.endTime = uint64(vm.envOr("END_TIME", uint256(block.timestamp + 7 days)));
        string memory defaultQuestion = "LOCAL: BTC>100k?";
        string memory defaultMetadataURI = "ipfs://local";
        c.question = vm.envOr("QUESTION", defaultQuestion);
        c.metadataURI = vm.envOr("METADATA_URI", defaultMetadataURI);
    }

    function _transferFactoryAdmin(MarketFactory factory, address multisigAdmin, address deployer) internal {
        if (multisigAdmin == address(0)) {
            return;
        }
        factory.grantRole(factory.DEFAULT_ADMIN_ROLE(), multisigAdmin);
        factory.grantRole(factory.MARKET_CREATOR_ROLE(), multisigAdmin);
        factory.grantRole(factory.PAUSER_ROLE(), multisigAdmin);
        factory.revokeRole(factory.MARKET_CREATOR_ROLE(), deployer);
        factory.revokeRole(factory.PAUSER_ROLE(), deployer);
        factory.revokeRole(factory.DEFAULT_ADMIN_ROLE(), deployer);
    }

    function _transferMarketAdmin(BinaryPredictionMarket market, address multisigAdmin, address deployer) internal {
        if (multisigAdmin == address(0)) {
            return;
        }
        market.grantRole(market.DEFAULT_ADMIN_ROLE(), multisigAdmin);
        market.grantRole(market.ADMIN_ROLE(), multisigAdmin);
        market.revokeRole(market.ADMIN_ROLE(), deployer);
        market.revokeRole(market.DEFAULT_ADMIN_ROLE(), deployer);
    }
}

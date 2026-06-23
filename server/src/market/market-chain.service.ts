import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

const DEFAULT_FACTORY_ADDRESS = '0x45ab369f65c0ef44c1325323f283e6acc92b8bd0';
const DEFAULT_COLLATERAL_ADDRESS = '0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB';
const DEFAULT_COLLATERAL_DECIMALS = 6;

const marketFactoryAbi = [
    'function createMarket((string question,string metadataURI,address collateral,uint64 startTime,uint64 endTime,uint256 initialCollateral,uint16 initialPriceYesBps,uint256 minTradeAmount,uint256 maxTradeAmount,uint16 maxSlippageBps,uint16 feeBps)) returns (uint256 marketId,address marketAddress)',
    'event MarketCreated(uint256 indexed marketId,address indexed marketAddress,address indexed creator,string question,address collateral,uint64 startTime,uint64 endTime,uint256 initialCollateral,uint16 initialPriceYesBps)'
];

const erc20Abi = [
    'function approve(address spender,uint256 amount) returns (bool)'
];

const binaryPredictionMarketAbi = [
    'function resolveByAdmin(uint8 outcome,string evidenceURI) external'
];

export type ChainResolutionOutcome = 'YES' | 'NO';

export interface CreateChainMarketInput {
    title: string;
    durationMinutes: number;
    metadataURI?: string;
}

@Injectable()
export class MarketChainService {
    private readonly logger = new Logger(MarketChainService.name);

    isConfigured(): boolean {
        return Boolean(process.env.XMARKET_ADMIN_RPC_URL && process.env.XMARKET_ADMIN_PRIVATE_KEY);
    }

    ensureConfigured(): void {
        if (!this.isConfigured()) {
            throw new BadRequestException('Missing XMARKET_ADMIN_RPC_URL or XMARKET_ADMIN_PRIVATE_KEY');
        }
    }

    async createMarket(input: CreateChainMarketInput) {
        this.ensureConfigured();

        const signer = this.getSigner();
        const factoryAddress = this.getFactoryAddress();
        const collateralAddress = this.getCollateralAddress();
        const factory = new ethers.Contract(factoryAddress, marketFactoryAbi, signer);
        const collateral = new ethers.Contract(collateralAddress, erc20Abi, signer);

        const now = Math.floor(Date.now() / 1000);
        const endTime = now + input.durationMinutes * 60;
        const initialCollateral = this.getUintEnv('XMARKET_DEFAULT_INITIAL_COLLATERAL', '1000000');
        const initialPriceYesBps = this.getNumberEnv('XMARKET_DEFAULT_INITIAL_PRICE_YES_BPS', 5000);
        const minTradeAmount = this.getUintEnv('XMARKET_DEFAULT_MIN_TRADE_AMOUNT', '1');
        const maxTradeAmount = this.getUintEnv('XMARKET_DEFAULT_MAX_TRADE_AMOUNT', '100000');
        const maxSlippageBps = this.getNumberEnv('XMARKET_DEFAULT_MAX_SLIPPAGE_BPS', 500);
        const feeBps = this.getNumberEnv('XMARKET_DEFAULT_FEE_BPS', 50);

        await this.waitForTx(await collateral.approve(factoryAddress, initialCollateral));

        const tx = await factory.createMarket({
            question: input.title,
            metadataURI: input.metadataURI || `ipfs://xmarket/admin/${Date.now()}`,
            collateral: collateralAddress,
            startTime: now,
            endTime,
            initialCollateral,
            initialPriceYesBps,
            minTradeAmount,
            maxTradeAmount,
            maxSlippageBps,
            feeBps,
        });
        const receipt = await this.waitForTx(tx);

        const parsedLog = receipt.logs
            .map((log) => {
                try {
                    return factory.interface.parseLog(log);
                }
                catch {
                    return null;
                }
            })
            .find((log) => log?.name === 'MarketCreated');

        if (!parsedLog) {
            throw new BadRequestException('MarketCreated event not found in transaction receipt');
        }

        const chainMarketId = parsedLog.args.marketId.toString();
        const chainMarketAddress = String(parsedLog.args.marketAddress);

        this.logger.log(`Created on-chain market ${chainMarketId} at ${chainMarketAddress}`);

        return {
            chainMarketId,
            chainMarketAddress,
            collateralAddress,
            collateralDecimals: this.getNumberEnv('XMARKET_COLLATERAL_DECIMALS', DEFAULT_COLLATERAL_DECIMALS),
            initialCollateral: initialCollateral.toString(),
            initialPriceYesBps,
            txHash: receipt.hash,
            startTime: now,
            endTime,
        };
    }

    async resolveMarket(marketAddress: string, outcome: ChainResolutionOutcome, evidenceURI: string) {
        this.ensureConfigured();

        const signer = this.getSigner();
        const market = new ethers.Contract(marketAddress, binaryPredictionMarketAbi, signer);
        const outcomeValue = outcome === 'YES' ? 1 : 2;
        const receipt = await this.waitForTx(await market.resolveByAdmin(outcomeValue, evidenceURI));

        this.logger.log(`Resolved on-chain market ${marketAddress} with outcome ${outcome}`);

        return {
            txHash: receipt.hash,
            outcome,
            evidenceURI,
        };
    }

    private getSigner() {
        const provider = new ethers.JsonRpcProvider(process.env.XMARKET_ADMIN_RPC_URL);
        return new ethers.Wallet(process.env.XMARKET_ADMIN_PRIVATE_KEY as string, provider);
    }

    private getFactoryAddress(): string {
        return process.env.XMARKET_MARKET_FACTORY_ADDRESS || DEFAULT_FACTORY_ADDRESS;
    }

    private getCollateralAddress(): string {
        return process.env.XMARKET_COLLATERAL_ADDRESS || DEFAULT_COLLATERAL_ADDRESS;
    }

    private getNumberEnv(name: string, fallback: number): number {
        const value = process.env[name];
        return value ? Number.parseInt(value, 10) : fallback;
    }

    private getUintEnv(name: string, fallback: string): bigint {
        return BigInt(process.env[name] || fallback);
    }

    private async waitForTx(tx: ethers.ContractTransactionResponse) {
        const receipt = await tx.wait();
        if (!receipt) {
            throw new BadRequestException(`Transaction ${tx.hash} failed to produce a receipt`);
        }
        return receipt;
    }
}

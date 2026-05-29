import type { Abi } from 'viem';
import marketFactoryAbiJson from '../../packages/abi/MarketFactory.json';
import binaryPredictionMarketAbiJson from '../../packages/abi/BinaryPredictionMarket.json';
import cpmmEngineAbiJson from '../../packages/abi/CPMMEngine.json';

export const marketFactoryAbi = marketFactoryAbiJson as Abi;
export const binaryPredictionMarketAbi = binaryPredictionMarketAbiJson as Abi;
export const cpmmEngineAbi = cpmmEngineAbiJson as Abi;

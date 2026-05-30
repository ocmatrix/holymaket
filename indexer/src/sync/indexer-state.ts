import type { Prisma, PrismaClient } from "@prisma/client";

export async function getNextIndexedBlock(params: {
  prisma: PrismaClient;
  chainId: number;
  scope: string;
  contractAddress: string;
  startBlock: bigint;
}): Promise<bigint> {
  const { prisma, chainId, scope, contractAddress, startBlock } = params;

  const state = await prisma.indexerState.findUnique({
    where: {
      chainId_scope_contractAddress: {
        chainId,
        scope,
        contractAddress,
      },
    },
  });

  return state ? state.lastIndexedBlock + 1n : startBlock;
}

export async function updateIndexedState(params: {
  tx: Prisma.TransactionClient;
  chainId: number;
  scope: string;
  contractAddress: string;
  lastIndexedBlock: bigint;
}): Promise<void> {
  const { tx, chainId, scope, contractAddress, lastIndexedBlock } = params;

  await tx.indexerState.upsert({
    where: {
      chainId_scope_contractAddress: {
        chainId,
        scope,
        contractAddress,
      },
    },
    create: {
      chainId,
      scope,
      contractAddress,
      lastIndexedBlock,
    },
    update: {
      lastIndexedBlock,
    },
  });
}

export async function getNextFactoryBlock(params: {
  prisma: PrismaClient;
  chainId: number;
  scope: string;
  contractAddress: string;
  startBlock: bigint;
}): Promise<bigint> {
  return getNextIndexedBlock(params);
}

export async function updateFactoryState(params: {
  tx: Prisma.TransactionClient;
  chainId: number;
  scope: string;
  contractAddress: string;
  lastIndexedBlock: bigint;
}): Promise<void> {
  await updateIndexedState(params);
}

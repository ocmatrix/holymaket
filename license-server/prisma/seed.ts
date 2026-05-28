import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding license database...');

  // 创建一个示例授权（可选）
  const demoLicense = await prisma.license.upsert({
    where: { key: 'AIXL-DEMO-0000-0000' },
    update: {},
    create: {
      key: 'AIXL-DEMO-0000-0000',
      customerId: 'demo-customer',
      customerName: 'Demo Customer',
      projectName: 'AixL Demo',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
      maxServers: 1,
      features: {
        trading: true,
        esports: true,
        football: true,
        ai_playground: true,
      },
      fingerprints: [],
      isActive: true,
    },
  });

  console.log(`✅ Demo license created: ${demoLicense.key}`);
  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('root', 12);

  await prisma.user.upsert({
    where: { email: 'root@admin.com' },
    update: {},
    create: {
      email: 'root@admin.com',
      passwordHash,
      fullName: 'Admin',
      role: 'ADMIN',
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

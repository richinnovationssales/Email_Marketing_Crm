// scripts/createSuperAdmin.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'joshjoychan@smartsolutionsme.com';
  const password = 'Root@123'; // Change this!

  // Check if any SUPER_ADMIN already exists
  const existingSuperAdmin = await prisma.admin.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (existingSuperAdmin) {
    console.log('Super Admin already exists:', existingSuperAdmin.email);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.admin.create({
    data: {
      email,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Super Admin created:', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

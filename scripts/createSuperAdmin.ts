import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'superadmin@example.com';
  const password = 'supersecretpassword'; // Change this!

  const hashedPassword = await bcrypt.hash(password, 10);

  const superAdmin = await prisma.superAdmin.create({
    data: {
      email: email,
      password: hashedPassword,
    },
  });

  console.log('Super Admin created:', superAdmin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
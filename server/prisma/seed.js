const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const username = 'Controlador';
  const plainPassword = 'Latam...1*nai';
  
  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });
    console.log(`Created admin user with id: ${user.id}`);
  } else {
    console.log('Admin user already exists.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

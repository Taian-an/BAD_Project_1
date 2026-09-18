// Seeds the local dev database with a realistic batch of Users, Categories,
// Products, Orders, and OrderItems. Wipes existing rows first (dev-only —
// never run against a shared/production DATABASE_URL) so re-running this
// script always produces the same clean dataset instead of duplicates.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Apparel', description: 'Hoodies, tees, jackets' },
  { name: 'Stationery', description: 'Notebooks, pens, planners' },
  { name: 'Electronics', description: 'Chargers, earbuds, accessories' },
  { name: 'Drinkware', description: 'Mugs, tumblers, water bottles' },
];

const USERS = [
  { email: 'admin@uni.edu', displayName: 'Alice Admin', role: 'ADMIN', department: null },
  { email: 'staff.apparel@uni.edu', displayName: 'Sam Staff', role: 'STAFF', department: 'Retail Ops' },
  { email: 'staff.electronics@uni.edu', displayName: 'Erin Staff', role: 'STAFF', department: 'Retail Ops' },
  { email: 'student1@uni.edu', displayName: 'Wei Chen', role: 'STUDENT', department: 'CS' },
  { email: 'student2@uni.edu', displayName: 'Mika Tan', role: 'STUDENT', department: 'Business' },
  { email: 'student3@uni.edu', displayName: 'Jordan Lee', role: 'STUDENT', department: 'Design' },
  { email: 'student4@uni.edu', displayName: 'Priya Nair', role: 'STUDENT', department: 'CS' },
  { email: 'student5@uni.edu', displayName: 'Noah Park', role: 'STUDENT', department: 'Engineering' },
  { email: 'student6@uni.edu', displayName: 'Yuki Sato', role: 'STUDENT', department: 'Business' },
];

// categoryName + createdByEmail are resolved to real ids after insert.
const PRODUCTS = [
  { name: 'University Hoodie', category: 'Apparel', createdBy: 'staff.apparel@uni.edu', basePrice: 39.99, stockQty: 120, description: 'Warm cotton-blend hoodie with campus crest' },
  { name: 'Campus Tee', category: 'Apparel', createdBy: 'staff.apparel@uni.edu', basePrice: 19.99, stockQty: 200, description: 'Soft cotton tee with university logo' },
  { name: 'Varsity Jacket', category: 'Apparel', createdBy: 'staff.apparel@uni.edu', basePrice: 79.99, stockQty: 40, description: 'Wool-blend varsity jacket, leather sleeves' },
  { name: 'Ruled Notebook', category: 'Stationery', createdBy: 'staff.apparel@uni.edu', basePrice: 5.5, stockQty: 300, description: '80-page ruled notebook with university crest cover' },
  { name: 'Gel Pen 4-Pack', category: 'Stationery', createdBy: 'staff.apparel@uni.edu', basePrice: 6.0, stockQty: 250, description: 'Smooth gel pens in university colors' },
  { name: 'Academic Planner', category: 'Stationery', createdBy: 'staff.apparel@uni.edu', basePrice: 14.99, stockQty: 90, description: 'Semester planner with campus map insert' },
  { name: 'USB-C Charging Cable', category: 'Electronics', createdBy: 'staff.electronics@uni.edu', basePrice: 12.99, stockQty: 150, description: 'Braided 2m USB-C cable' },
  { name: 'Wireless Earbuds', category: 'Electronics', createdBy: 'staff.electronics@uni.edu', basePrice: 49.99, stockQty: 60, description: 'Bluetooth earbuds with charging case' },
  { name: 'Insulated Tumbler', category: 'Drinkware', createdBy: 'staff.electronics@uni.edu', basePrice: 22.0, stockQty: 100, description: '20oz stainless steel tumbler, keeps drinks cold 24h' },
  { name: 'Campus Water Bottle', category: 'Drinkware', createdBy: 'staff.electronics@uni.edu', basePrice: 15.0, stockQty: 180, description: 'BPA-free 750ml bottle with university logo' },
];

function aiDescriptionFor({ name, description }) {
  return `${name} — a must-have pick for campus life. ${description} Durable, practical, and ready to ship from the CampusStore catalog.`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

async function main() {
  console.log('Clearing existing data...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding categories...');
  const categoryByName = {};
  for (const c of CATEGORIES) {
    categoryByName[c.name] = await prisma.category.create({ data: c });
  }

  console.log('Seeding users...');
  const userByEmail = {};
  for (const u of USERS) {
    // Must match the "mock-<email>" scheme POST /auth/dev-login uses (see
    // src/routes/auth.js), otherwise logging in as a seeded email creates a
    // second User row with a different adObjectId and collides with the
    // unique constraint on email (P2002) instead of updating the existing row.
    userByEmail[u.email] = await prisma.user.create({
      data: { adObjectId: `mock-${u.email}`, ...u },
    });
  }

  console.log('Seeding products...');
  const products = [];
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        basePrice: p.basePrice,
        stockQty: p.stockQty,
        description: p.description,
        aiDescription: aiDescriptionFor(p),
        categoryId: categoryByName[p.category].id,
        createdById: userByEmail[p.createdBy].id,
      },
    });
    products.push(product);
  }

  console.log('Seeding orders + order items...');
  const students = USERS.filter((u) => u.role === 'STUDENT').map((u) => userByEmail[u.email]);
  const statuses = ['PENDING', 'PAID', 'FULFILLED'];
  let orderCount = 0;
  let orderItemCount = 0;

  for (const student of students) {
    const numOrders = randomInt(1, 2);
    for (let i = 0; i < numOrders; i++) {
      const itemCount = randomInt(1, 3);
      const chosenProducts = new Set();
      while (chosenProducts.size < itemCount) chosenProducts.add(pick(products));

      const items = [...chosenProducts].map((product) => ({
        productId: product.id,
        quantity: randomInt(1, 3),
        unitPrice: product.basePrice,
      }));

      const discountApplied = Math.random() < 0.3;
      const rawTotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
      const totalAmount = discountApplied ? rawTotal * 0.9 : rawTotal;

      await prisma.order.create({
        data: {
          userId: student.id,
          status: pick(statuses),
          totalAmount,
          discountApplied,
          items: { create: items },
        },
      });
      orderCount += 1;
      orderItemCount += items.length;
    }
  }

  console.log(
    `Done: ${CATEGORIES.length} categories, ${USERS.length} users, ${products.length} products, ${orderCount} orders, ${orderItemCount} order items.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

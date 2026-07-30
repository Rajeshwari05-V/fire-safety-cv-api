// Quick seed script — populates the Equipment table with sample fire safety items
// Run with: node seed.js  (from inside the quotation-service folder)
 
require("dotenv/config");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
 
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
 
async function main() {
  const equipment = [
    { name: "Fire Extinguisher (ABC Type)", type: "Extinguisher", price: 1500, quantity: 1 },
    { name: "Smoke Detector", type: "Detector", price: 800, quantity: 1 },
    { name: "Fire Alarm Panel", type: "Alarm", price: 12000, quantity: 1 },
    { name: "Sprinkler Head", type: "Sprinkler", price: 450, quantity: 1 },
    { name: "Hose Reel Cabinet", type: "Hose Cabinet", price: 6500, quantity: 1 },
    { name: "Emergency Exit Sign", type: "Signage", price: 350, quantity: 1 },
    { name: "Fire Hydrant Valve", type: "Hydrant", price: 3200, quantity: 1 },
  ];
 
  for (const item of equipment) {
    await prisma.equipment.create({ data: item });
  }
 
  console.log(`Seeded ${equipment.length} equipment records.`);
}
 
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

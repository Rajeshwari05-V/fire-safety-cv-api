const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

function buildConnectionString() {
  const connectionString = process.env.DATABASE_URL || "";

  if (!connectionString) {
    return connectionString;
  }

  if (connectionString.includes("sslmode=")) {
    return connectionString;
  }

  const separator = connectionString.includes("?") ? "&" : "?";
  return `${connectionString}${separator}sslmode=require`;
}

const adapter = new PrismaPg({
  connectionString: buildConnectionString(),
});

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;

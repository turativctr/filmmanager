-- CreateEnum
CREATE TYPE "AccountGroupType" AS ENUM ('ATL', 'BTL_PRODUCAO', 'BTL_POS', 'OUTROS');

-- CreateEnum
CREATE TYPE "FringeType" AS ENUM ('INSS', 'FGTS', 'ISS', 'OUTRO');

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "moedaBase" TEXT NOT NULL DEFAULT 'BRL',
    "versao" TEXT NOT NULL DEFAULT '1.0',
    "contingenciaPercentual" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_groups" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "AccountGroupType" NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "account_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_accounts" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "budget_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_items" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "unidade" TEXT NOT NULL,
    "periodo" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "taxa" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "taxaCambio" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    "total" DECIMAL(14,2) NOT NULL,
    "isFrengeable" BOOLEAN NOT NULL DEFAULT false,
    "globalRef" TEXT,
    "notas" TEXT,
    "ordem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "globals" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "descricao" TEXT,
    "afetaLinhas" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "globals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fringes" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "teto" DECIMAL(12,2),
    "aplicaEm" TEXT[],
    "tipo" "FringeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fringes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fringe_line_items" (
    "id" TEXT NOT NULL,
    "fringeId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "accountId" TEXT,
    "base" DECIMAL(14,2) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "fringe_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_scenarios" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,

    CONSTRAINT "budget_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_projectId_key" ON "budgets"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "account_groups_budgetId_codigo_key" ON "account_groups"("budgetId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "budget_accounts_budgetId_codigo_key" ON "budget_accounts"("budgetId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "globals_budgetId_chave_key" ON "globals"("budgetId", "chave");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "account_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "budget_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "budget_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "globals" ADD CONSTRAINT "globals_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fringes" ADD CONSTRAINT "fringes_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fringe_line_items" ADD CONSTRAINT "fringe_line_items_fringeId_fkey" FOREIGN KEY ("fringeId") REFERENCES "fringes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fringe_line_items" ADD CONSTRAINT "fringe_line_items_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fringe_line_items" ADD CONSTRAINT "fringe_line_items_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "budget_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_scenarios" ADD CONSTRAINT "budget_scenarios_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

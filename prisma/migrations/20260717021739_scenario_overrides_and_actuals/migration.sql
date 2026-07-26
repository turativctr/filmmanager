-- CreateTable
CREATE TABLE "scenario_global_overrides" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "scenario_global_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actuals" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actuals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scenario_global_overrides_scenarioId_chave_key" ON "scenario_global_overrides"("scenarioId", "chave");

-- AddForeignKey
ALTER TABLE "scenario_global_overrides" ADD CONSTRAINT "scenario_global_overrides_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "budget_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuals" ADD CONSTRAINT "actuals_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuals" ADD CONSTRAINT "actuals_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "budget_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

import { InfoBanner } from "@/components/shared/info-banner";
import { TermTooltip } from "@/components/shared/term-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { FringeRow } from "./fringe-row";
import { GlobalRow } from "./global-row";
import { NewFringeDialog } from "./new-fringe-dialog";
import { NewGlobalDialog } from "./new-global-dialog";
import { SyncSchedulingBanner } from "./sync-scheduling-banner";
import type { BudgetData } from "./types";

export function GlobalsFringesTab({ projectId, budget }: { projectId: string; budget: BudgetData }) {
  return (
    <div className="space-y-4">
      <InfoBanner
        storageKey="budget-globals-fringes"
        title="Globals e Fringes"
        description="Globals são variáveis reutilizáveis que atualizam automaticamente todas as linhas vinculadas. Ex: mudar G_DIAS_SET de 5 para 7 recalcula diárias, aluguéis e alimentação de uma vez. Fringes são encargos trabalhistas (INSS, FGTS) calculados automaticamente sobre mão de obra."
      />
      <SyncSchedulingBanner projectId={projectId} globals={budget.globals} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-1.5 text-base">
            Globals
            <TermTooltip content="Variáveis do orçamento que atualizam múltiplas linhas ao mesmo tempo quando seu valor muda." />
          </CardTitle>
          <NewGlobalDialog projectId={projectId} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chave</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Linhas afetadas</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budget.globals.map((global) => (
                <GlobalRow key={global.id} projectId={projectId} global={global} />
              ))}
              {budget.globals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum global ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-1.5 text-base">
            Fringes
            <TermTooltip content="Encargos trabalhistas calculados automaticamente sobre os custos de mão de obra (INSS, FGTS, ISS)." />
          </CardTitle>
          <NewFringeDialog projectId={projectId} accountGroups={budget.accountGroups} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Percentual</TableHead>
                <TableHead>Teto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Aplicado em</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budget.fringes.map((fringe) => (
                <FringeRow
                  key={fringe.id}
                  projectId={projectId}
                  fringe={fringe}
                  accountGroups={budget.accountGroups}
                  moedaBase={budget.moedaBase}
                />
              ))}
              {budget.fringes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum fringe ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

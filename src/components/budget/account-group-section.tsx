"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, sumTotals } from "@/lib/budget-calc";

import { AddLineItemButton } from "./add-line-item-button";
import { LineItemRow } from "./line-item-row";
import { NewAccountDialog } from "./new-account-dialog";
import { ACCOUNT_GROUP_TYPE_LABEL } from "./types";
import type { AccountGroupData, GlobalData } from "./types";

export function AccountGroupSection({
  projectId,
  group,
  globals,
  moedaBase,
}: {
  projectId: string;
  group: AccountGroupData;
  globals: GlobalData[];
  moedaBase: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const groupTotal = sumTotals(group.accounts.flatMap((a) => a.lineItems));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <button
          type="button"
          className="flex items-center gap-1.5 text-base font-semibold"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {group.codigo} — {group.nome}
          <span className="text-xs font-normal text-muted-foreground">
            ({ACCOUNT_GROUP_TYPE_LABEL[group.tipo]})
          </span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">
            Total {group.nome}: {formatCurrency(groupTotal, moedaBase)}
          </span>
          <NewAccountDialog projectId={projectId} groupId={group.id} />
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Moeda</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.accounts.map((account) => {
                const accountTotal = sumTotals(account.lineItems);
                return (
                  <Fragment key={account.id}>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={6} className="font-medium">
                        {account.codigo} — {account.nome}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(accountTotal, moedaBase)}
                      </TableCell>
                      <TableCell>
                        <AddLineItemButton projectId={projectId} accountId={account.id} />
                      </TableCell>
                    </TableRow>
                    {account.lineItems.map((item) => (
                      <LineItemRow key={item.id} projectId={projectId} item={item} globals={globals} />
                    ))}
                    {account.lineItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-2 text-xs text-muted-foreground">
                          Nenhum item ainda.
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

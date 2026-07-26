import ExcelJS from "exceljs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getCharacterId } from "@/lib/character-id";
import { DOOD_STATUS_LABEL, type DoodStatus } from "@/lib/dood";
import { getProjectDoodData } from "@/lib/dood-data";
import { gerarNomeArquivo } from "@/lib/filename";
import { findOwnedProject } from "@/lib/project-access";

const STATUS_FILL: Record<DoodStatus, string | null> = {
  SW: "FFDCE9FB",
  WF: "FFDCE9FB",
  SW_WF: "FFDCE9FB",
  W: "FFDCFCE0",
  H: "FFFCE9CC",
  "—": null,
};

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const { shootDays, characterRows, extraRows, totalsByDay } = await getProjectDoodData(params.id);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("DOOD");

  sheet.mergeCells(1, 1, 1, 2 + shootDays.length + 3);
  sheet.getCell(1, 1).value = `DOOD — ${project.titulo}`;
  sheet.getCell(1, 1).font = { bold: true, size: 14 };

  sheet.mergeCells(2, 1, 2, 2 + shootDays.length + 3);
  sheet.getCell(2, 1).value = `Gerado em ${new Date().toLocaleDateString("pt-BR")}`;
  sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF666666" } };

  const headerRowIndex = 4;
  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.getCell(1).value = "Elemento";
  shootDays.forEach((day, index) => {
    const cell = headerRow.getCell(2 + index);
    cell.value = `${new Date(day.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · Dia ${day.numeroDia}`;
  });
  headerRow.getCell(2 + shootDays.length).value = "W";
  headerRow.getCell(3 + shootDays.length).value = "H";
  headerRow.getCell(4 + shootDays.length).value = "Contratado";
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = { bottom: { style: "thin" } };
  });

  let rowIndex = headerRowIndex + 1;

  function writeStatusRow(label: string, cells: DoodStatus[], extraCols: (number | string)[] = []) {
    const row = sheet.getRow(rowIndex);
    row.getCell(1).value = label;
    cells.forEach((status, index) => {
      const cell = row.getCell(2 + index);
      cell.value = DOOD_STATUS_LABEL[status];
      cell.alignment = { horizontal: "center" };
      const fill = STATUS_FILL[status];
      if (fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      }
    });
    extraCols.forEach((value, index) => {
      row.getCell(2 + cells.length + index).value = value;
    });
    rowIndex += 1;
  }

  for (const character of characterRows) {
    writeStatusRow(`${getCharacterId(character, project)} ${character.personagem}`, character.cells, [
      character.totalW,
      character.totalH,
      character.totalContracted,
    ]);
  }

  for (const extra of extraRows) {
    writeStatusRow(`${extra.personagem} (${extra.quantidade})`, extra.cells);
  }

  rowIndex += 1;
  const totalElencoRow = sheet.getRow(rowIndex);
  totalElencoRow.getCell(1).value = "Total elenco";
  totalElencoRow.font = { bold: true };
  totalsByDay.forEach((t, index) => {
    totalElencoRow.getCell(2 + index).value = t.totalElenco;
    totalElencoRow.getCell(2 + index).alignment = { horizontal: "center" };
  });
  rowIndex += 1;

  const totalFiguracaoRow = sheet.getRow(rowIndex);
  totalFiguracaoRow.getCell(1).value = "Total figuração";
  totalFiguracaoRow.font = { bold: true };
  totalsByDay.forEach((t, index) => {
    totalFiguracaoRow.getCell(2 + index).value = t.totalFiguracao;
    totalFiguracaoRow.getCell(2 + index).alignment = { horizontal: "center" };
  });

  sheet.getColumn(1).width = 28;
  for (let i = 0; i < shootDays.length; i++) {
    sheet.getColumn(2 + i).width = 16;
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "DOOD", ext: "xlsx" })}"`,
    },
  });
}

import ExcelJS from "exceljs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { gerarNomeArquivo } from "@/lib/filename";
import { naturalCompare } from "@/lib/natural-sort";
import { formatPaginas } from "@/lib/paginas";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scenes = await prisma.scene.findMany({
    where: { projectId: params.id },
    include: {
      cast: { include: { character: { select: { idCurto: true } } } },
      shootDays: { include: { shootDay: { select: { numeroDia: true, data: true } } } },
    },
  });

  const scheduled = scenes.filter((s) => s.shootDays.length > 0);
  const unscheduled = scenes.filter((s) => s.shootDays.length === 0);

  scheduled.sort((a, b) => {
    const ea = a.shootDays[0];
    const eb = b.shootDays[0];
    if (ea.shootDay.numeroDia !== eb.shootDay.numeroDia) return ea.shootDay.numeroDia - eb.shootDay.numeroDia;
    if (ea.bloco !== eb.bloco) return ea.bloco === "MANHA" ? -1 : 1;
    return ea.ordem - eb.ordem;
  });
  unscheduled.sort((a, b) => naturalCompare(a.numero, b.numero));

  const orderedScenes = [...scheduled, ...unscheduled];

  const columns = [
    "Dia de Set",
    "Data",
    "Bloco",
    "Ordem",
    "Cena",
    "INT/EXT",
    "D/N",
    "Local",
    "Set",
    "Sinopse",
    "Elenco",
    "Páginas",
    "Dia Narrativo",
    "Est. min",
  ];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cronograma Resumido");

  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell(1, 1).value = `Cronograma Resumido — ${project.titulo}`;
  sheet.getCell(1, 1).font = { bold: true, size: 14 };

  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell(2, 1).value = `Gerado em ${new Date().toLocaleDateString("pt-BR")}`;
  sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF666666" } };

  const headerRowIndex = 4;
  const headerRow = sheet.getRow(headerRowIndex);
  columns.forEach((label, index) => {
    headerRow.getCell(1 + index).value = label;
  });
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = { bottom: { style: "thin" } };
  });

  let rowIndex = headerRowIndex + 1;
  for (const scene of orderedScenes) {
    const entry = scene.shootDays[0];
    const row = sheet.getRow(rowIndex);
    row.getCell(1).value = entry ? `Dia ${entry.shootDay.numeroDia}` : "Boneyard";
    row.getCell(2).value = entry ? entry.shootDay.data.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "";
    row.getCell(3).value = entry ? (entry.bloco === "MANHA" ? "Manhã" : "Tarde") : "";
    row.getCell(4).value = entry ? entry.ordem : "";
    row.getCell(5).value = scene.numero;
    row.getCell(6).value = scene.tipo;
    row.getCell(7).value = scene.periodo;
    row.getCell(8).value = scene.locacao ?? "";
    row.getCell(9).value = scene.set ?? "";
    row.getCell(10).value = scene.sinopse ?? "";
    row.getCell(11).value = scene.cast.map((c) => c.character.idCurto).join(", ");
    row.getCell(12).value = formatPaginas(scene.paginas);
    row.getCell(13).value = scene.diaNarrativo ?? "";
    row.getCell(14).value = scene.tempoEstimadoMin ?? "";
    rowIndex += 1;
  }

  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 9;
  sheet.getColumn(4).width = 8;
  sheet.getColumn(5).width = 8;
  sheet.getColumn(6).width = 9;
  sheet.getColumn(7).width = 7;
  sheet.getColumn(8).width = 18;
  sheet.getColumn(9).width = 16;
  sheet.getColumn(10).width = 40;
  sheet.getColumn(11).width = 16;
  sheet.getColumn(12).width = 9;
  sheet.getColumn(13).width = 12;
  sheet.getColumn(14).width = 9;

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "OneLineSchedule", ext: "xlsx" })}"`,
    },
  });
}

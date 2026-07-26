import { PrismaClient, type Shot } from "@prisma/client";
import bcrypt from "bcryptjs";

import { parsePaginas } from "../src/lib/paginas";
import { CREW_CALL_DEPARTMENTS } from "../src/lib/report-constants";
import { recalcFringeLineItems, saveLineItemWithCalc } from "../src/lib/budget-server";
import { populateBudgetTemplate } from "../src/lib/budget-templates";
import { revisionColorForDraftNumero } from "../src/lib/revision-colors";
import { generateHoraAHoraEvents } from "../src/lib/hora-a-hora";
import { getShootDayReportData } from "../src/lib/report-data";
import { recalculateDaySchedule, recalculateScene } from "../src/lib/shots";
import { computeTempoTotal } from "../src/lib/shots-shared";

const prisma = new PrismaClient();

function toDecimalScenes(scenes: SceneSeed[]) {
  return scenes.map((scene) => ({ ...scene, paginas: parsePaginas(scene.paginas)!.toString() }));
}

const DEMO_EMAIL = "demo@filmmanager.local";
const DEMO_PASSWORD = "demo12345";

type SceneSeed = {
  numero: string;
  tipo: "INT" | "EXT";
  periodo: "DIA" | "NOITE" | "ENTARDECER";
  set: string;
  locacao: string;
  sinopse: string;
  paginas: string;
  diaNarrativo: number;
  tempoEstimadoMin: number;
  notasAD?: string;
};

const RESSACA_SCENES: SceneSeed[] = [
  {
    numero: "5",
    tipo: "INT",
    periodo: "DIA",
    set: "Restaurante Bananeira",
    locacao: "Restaurante Bananeira",
    sinopse: "Chef prepara o prato do dia enquanto o salão ainda está vazio.",
    paginas: "2/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 30,
  },
  {
    numero: "8",
    tipo: "INT",
    periodo: "DIA",
    set: "Restaurante Bananeira",
    locacao: "Restaurante Bananeira",
    sinopse: "Primeiros clientes chegam; Chef observa da cozinha.",
    paginas: "4/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 30,
  },
  {
    numero: "8PL",
    tipo: "INT",
    periodo: "DIA",
    set: "Restaurante Bananeira",
    locacao: "Restaurante Bananeira",
    sinopse: "Plano de apoio: mãos de Chef finalizando a moqueca.",
    paginas: "1/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 15,
  },
  {
    numero: "9",
    tipo: "INT",
    periodo: "DIA",
    set: "Restaurante Bananeira",
    locacao: "Restaurante Bananeira",
    sinopse: "Sous-chef entrega o prato para a mesa 3.",
    paginas: "3/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 45,
    notasAD: "Cena com quebra de prato — cacos de porcelana no chão do set, cuidado redobrado com elenco/equipe descalços ou de sapato aberto.",
  },
  {
    numero: "10",
    tipo: "INT",
    periodo: "DIA",
    set: "Restaurante Bananeira",
    locacao: "Restaurante Bananeira",
    sinopse: "Cliente elogia o prato; Chef observa pela portinhola da cozinha.",
    paginas: "1 2/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 45,
  },
  {
    numero: "11",
    tipo: "INT",
    periodo: "DIA",
    set: "Restaurante Bananeira",
    locacao: "Restaurante Bananeira",
    sinopse: "Chef sai da cozinha para cumprimentar a mesa.",
    paginas: "5/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 35,
  },
  {
    numero: "14A",
    tipo: "INT",
    periodo: "DIA",
    set: "Restaurante Bananeira",
    locacao: "Restaurante Bananeira",
    sinopse: "Salão cheio; Chef percebe que o restaurante finalmente decolou.",
    paginas: "3/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 90,
    notasAD: "Set mais cheio do dia (6 figurantes + elenco principal) — reforçar sinalização de silêncio, salão é pequeno.",
  },
  {
    numero: "16",
    tipo: "INT",
    periodo: "DIA",
    set: "Restaurante Bananeira",
    locacao: "Restaurante Bananeira",
    sinopse: "Cena final: Chef brinda sozinho na cozinha vazia, ao fim do expediente.",
    paginas: "4/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 70,
    notasAD: "Cliente Especial sai direto para casa após esta cena, não retorna ao set — confirmar transporte dela antes da chamada.",
  },
];

const VIAGEIRO_SCENES: SceneSeed[] = [
  {
    numero: "1",
    tipo: "EXT",
    periodo: "DIA",
    set: "Represa",
    locacao: "Represa",
    sinopse: "Viajante chega à beira da represa com sua mochila.",
    paginas: "3/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 1,
  },
  {
    numero: "2",
    tipo: "EXT",
    periodo: "DIA",
    set: "Represa",
    locacao: "Represa",
    sinopse: "Viajante monta acampamento à margem da água.",
    paginas: "5/8",
    diaNarrativo: 1,
    tempoEstimadoMin: 1,
  },
  {
    numero: "18",
    tipo: "EXT",
    periodo: "DIA",
    set: "Represa",
    locacao: "Represa",
    sinopse: "Pescador aparece ao longe; Viajante acena.",
    paginas: "2/8",
    diaNarrativo: 2,
    tempoEstimadoMin: 1,
  },
  {
    numero: "19",
    tipo: "EXT",
    periodo: "ENTARDECER",
    set: "Represa",
    locacao: "Represa",
    sinopse: "Viajante e Pescador conversam enquanto o sol se põe sobre a represa.",
    paginas: "1 2/8",
    diaNarrativo: 2,
    tempoEstimadoMin: 2,
  },
  {
    numero: "33",
    tipo: "EXT",
    periodo: "ENTARDECER",
    set: "Represa",
    locacao: "Represa",
    sinopse: "Cena final: Viajante retoma a estrada, represa ao fundo.",
    paginas: "4/8",
    diaNarrativo: 3,
    tempoEstimadoMin: 1,
  },
];

type ShotSeed = {
  ordem: number;
  numero: string;
  descricao: string;
  tamanho: string;
  lente: string;
  angulo: string;
  movimento: string;
  takesPrevistos: number;
  duracaoTakeMin: number;
  tempoSetupMin: number;
  notasContinuidade?: string;
};

// Decupagem de exemplo do Viageiro — cena 1 (Represa, embarque) e cena 2 (Represa, acampamento).
// tipoReset/tempoResetMin NÃO são hardcoded aqui: ficam PENDENTE/NENHUM na criação e são
// recalculados por recalculateScene() logo abaixo, o mesmo caminho usado pelas rotas de API —
// garante que o seed nunca fique dessincronizado do algoritmo real de classifyReset().
const VIAGEIRO_SCENE1_SHOTS: ShotSeed[] = [
  {
    ordem: 1,
    numero: "1",
    descricao: "Médio Frontal — Viajante contempla o rio antes de embarcar",
    tamanho: "Médio",
    lente: "24mm",
    angulo: "Frontal",
    movimento: "Estático",
    takesPrevistos: 3,
    duracaoTakeMin: 5,
    tempoSetupMin: 8,
  },
  {
    ordem: 2,
    numero: "2",
    descricao: "Close OTS — Viajante amarra a corda do barco",
    tamanho: "Close",
    lente: "50mm",
    angulo: "OTS",
    movimento: "Estático",
    takesPrevistos: 4,
    duracaoTakeMin: 3,
    tempoSetupMin: 0,
  },
  {
    ordem: 3,
    numero: "3",
    descricao: "Close Travelling — acompanha as mãos soltando o barco",
    tamanho: "Close",
    lente: "50mm",
    angulo: "OTS",
    movimento: "Travelling",
    takesPrevistos: 3,
    duracaoTakeMin: 4,
    tempoSetupMin: 5,
  },
  {
    ordem: 4,
    numero: "5",
    descricao: "Close 45° — reação do Viajante ao barco se afastar",
    tamanho: "Close",
    lente: "50mm",
    angulo: "45°",
    movimento: "Travelling",
    takesPrevistos: 5,
    duracaoTakeMin: 2,
    tempoSetupMin: 0,
  },
  {
    ordem: 5,
    numero: "4",
    descricao: "Médio Frontal — plano de saída, Viajante observa a margem",
    tamanho: "Médio",
    lente: "35mm",
    angulo: "Frontal",
    movimento: "Travelling",
    takesPrevistos: 3,
    duracaoTakeMin: 4,
    tempoSetupMin: 0,
  },
];

const VIAGEIRO_SCENE2_SHOTS: ShotSeed[] = [
  {
    ordem: 1,
    numero: "1",
    descricao: "Aberto — Viajante avista a beira do rio ao longe",
    tamanho: "Aberto",
    lente: "24mm",
    angulo: "Frontal",
    movimento: "Estático",
    takesPrevistos: 3,
    duracaoTakeMin: 5,
    tempoSetupMin: 10,
  },
  {
    ordem: 2,
    numero: "3",
    descricao: "Médio — Viajante se aproxima da margem",
    tamanho: "Médio",
    lente: "35mm",
    angulo: "Frontal",
    movimento: "Estático",
    takesPrevistos: 4,
    duracaoTakeMin: 4,
    tempoSetupMin: 0,
  },
  {
    ordem: 3,
    numero: "4",
    descricao: "Geral — Viajante monta acampamento à margem",
    tamanho: "Geral",
    lente: "24mm",
    angulo: "Frontal",
    movimento: "Estático",
    takesPrevistos: 3,
    duracaoTakeMin: 4,
    tempoSetupMin: 0,
  },
  {
    ordem: 4,
    numero: "2",
    descricao: "Detalhe — mochila apoiada contra uma pedra",
    tamanho: "Detalhe",
    lente: "50mm",
    angulo: "Contra-Plongée",
    movimento: "Estático",
    takesPrevistos: 5,
    duracaoTakeMin: 2,
    tempoSetupMin: 0,
    notasContinuidade: "Mochila deve estar na mesma posição em todos os takes",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo", passwordHash },
  });

  // Reseed limpo: remove projetos anteriores do usuário demo (cascata cuida do resto).
  await prisma.project.deleteMany({ where: { ownerId: user.id } });

  const ressaca = await prisma.project.create({
    data: {
      titulo: "Ressaca",
      diretor: "Laura Prado",
      producao: "Pump Midia",
      ownerId: user.id,
      equipeTecnica: 8,
      scenes: { create: toDecimalScenes(RESSACA_SCENES) },
    },
    include: { scenes: true },
  });

  const viageiro = await prisma.project.create({
    data: {
      titulo: "Viageiro",
      diretor: "Rafael Costa",
      producao: "Pump Midia",
      ownerId: user.id,
      sistemaIdElenco: "NUMERACAO",
      scenes: { create: toDecimalScenes(VIAGEIRO_SCENES) },
    },
    include: { scenes: true },
  });

  const sceneByNumero = (scenes: typeof ressaca.scenes, numero: string) =>
    scenes.find((s) => s.numero === numero)!;

  const chef = await prisma.character.create({
    data: {
      projectId: ressaca.id,
      idCurto: "PRO",
      numeroElenco: 1,
      categoria: "PRINCIPAL",
      personagem: "Chef",
      ator: "Bruna Tovian",
      idadePersonagem: 34,
      scenes: {
        create: ["16", "5", "8", "8PL", "10", "9", "11"].map((numero) => ({
          sceneId: sceneByNumero(ressaca.scenes, numero).id,
        })),
      },
    },
  });

  const sousChef = await prisma.character.create({
    data: {
      projectId: ressaca.id,
      idCurto: "CHEF",
      numeroElenco: 2,
      categoria: "COADJUVANTE",
      personagem: "Sous-chef",
      ator: "Claudio Marinho",
      idadePersonagem: 29,
      scenes: {
        create: RESSACA_SCENES.map((s) => ({
          sceneId: sceneByNumero(ressaca.scenes, s.numero).id,
        })),
      },
    },
  });

  const ben = await prisma.character.create({
    data: {
      projectId: ressaca.id,
      idCurto: "BEN",
      numeroElenco: 3,
      categoria: "COADJUVANTE",
      personagem: "Garçom",
      ator: "Vinicius Cattani",
      idadePersonagem: 26,
      scenes: {
        create: ["14A", "16", "8", "10", "9"].map((numero) => ({
          sceneId: sceneByNumero(ressaca.scenes, numero).id,
        })),
      },
    },
  });

  const pre = await prisma.character.create({
    data: {
      projectId: ressaca.id,
      idCurto: "PRE",
      numeroElenco: 4,
      categoria: "COADJUVANTE",
      personagem: "Cliente Crítico",
      ator: "Vinicius Aguiar",
      idadePersonagem: 52,
      scenes: {
        create: ["14A", "16"].map((numero) => ({
          sceneId: sceneByNumero(ressaca.scenes, numero).id,
        })),
      },
    },
  });

  const esp = await prisma.character.create({
    data: {
      projectId: ressaca.id,
      idCurto: "ESP",
      numeroElenco: 5,
      categoria: "PARTICIPACAO_ESPECIAL",
      personagem: "Cliente Especial",
      ator: "Letticia Moraes",
      idadePersonagem: 45,
      scenes: {
        create: ["14A", "16"].map((numero) => ({
          sceneId: sceneByNumero(ressaca.scenes, numero).id,
        })),
      },
    },
  });

  const cla = await prisma.character.create({
    data: {
      projectId: ressaca.id,
      idCurto: "CLA",
      numeroElenco: 6,
      categoria: "FIGURACAO",
      personagem: "Cliente Regular",
      ator: "Emira Sophia",
      idadePersonagem: 31,
      scenes: {
        create: ["8", "10", "9", "11"].map((numero) => ({
          sceneId: sceneByNumero(ressaca.scenes, numero).id,
        })),
      },
    },
  });

  await prisma.character.create({
    data: {
      projectId: viageiro.id,
      idCurto: "PRO1",
      numeroElenco: 1,
      categoria: "PRINCIPAL",
      personagem: "Viajante",
      ator: "Bruno Lima",
      idadePersonagem: 40,
      scenes: {
        create: VIAGEIRO_SCENES.map((s) => ({
          sceneId: sceneByNumero(viageiro.scenes, s.numero).id,
        })),
      },
    },
  });

  await prisma.character.create({
    data: {
      projectId: viageiro.id,
      idCurto: "CHEF1",
      numeroElenco: 2,
      categoria: "COADJUVANTE",
      personagem: "Pescador",
      ator: "Edson Matos",
      idadePersonagem: 55,
      scenes: {
        create: ["18", "19", "33"].map((numero) => ({
          sceneId: sceneByNumero(viageiro.scenes, numero).id,
        })),
      },
    },
  });

  const scene8pl = sceneByNumero(ressaca.scenes, "8PL");
  await prisma.breakdownSheet.create({
    data: {
      sceneId: scene8pl.id,
      figurino: ["Chef_R2 uniforme"],
      make: ["Chef suor leve"],
      arteDressing: "Bancada de cozinha com panelas de cobre e ervas frescas.",
      objetos: ["Cozinha_panela", "Cozinha_faca", "Salão_mesa"],
      comidaCena: ["Moqueca de camarão"],
      microfones: ["Chef"],
      trilha: ["Tema do restaurante — versão intimista"],
      habilidades: ["Chef_Assobiar"],
      arteGrafica: ["Cardápio impresso"],
      posProducao: ["Câmera lenta no close da faca"],
      notasArte: "Manter iluminação quente, tons de âmbar.",
      notasFoto: "Close extremo nas mãos do Chef.",
      notasContinuidade: "Avental deve ter a mesma mancha de molho em todas as tomadas.",
      notasProducao: "Confirmar liberação do restaurante para uso da bancada real.",
    },
  });

  // Breakdowns das demais cenas da Diária 3 — cobrem os cenários de teste da Ordem do Dia
  // automatizada: troca de figurino rápida (Garçom, 14A→16, gap de 0min), efeito especial
  // de make (Cliente Especial, cena 16), comida de cena (cena 16), habilidades (cena 9, 16).
  await prisma.breakdownSheet.create({
    data: {
      sceneId: sceneByNumero(ressaca.scenes, "14A").id,
      figurino: ["Garçom_Uniforme limpo"],
      make: ["Cliente Especial_Bob grisalho (peruca)"],
    },
  });

  await prisma.breakdownSheet.create({
    data: {
      sceneId: sceneByNumero(ressaca.scenes, "16").id,
      figurino: ["Garçom_Uniforme sujo de vinho", "Chef_Dedeira"],
      habilidades: ["Sous-chef_Assobiar"],
      make: [
        "Cliente Especial_Bob grisalho (peruca)",
        "Cliente Especial_Pele vermelha e irritada (efeito especial de maquiagem)",
      ],
      comidaCena: ["Pratos de peixe-branco montados (múltiplos takes)"],
      objetos: ["[CRÍTICO] Pratos extras de peixe-branco para múltiplos takes"],
    },
  });

  await prisma.breakdownSheet.create({
    data: {
      sceneId: sceneByNumero(ressaca.scenes, "5").id,
      figurino: ["Chef_R4"],
      trilha: ["Chef_Forró triste no fone de ouvido"],
    },
  });

  await prisma.breakdownSheet.create({
    data: {
      sceneId: sceneByNumero(ressaca.scenes, "8").id,
      figurino: ["Chef_R5 uniforme"],
      posProducao: ["Transição em slide"],
    },
  });

  await prisma.breakdownSheet.create({
    data: {
      sceneId: sceneByNumero(ressaca.scenes, "9").id,
      habilidades: ["Chef_Estalar os dedos"],
      objetos: ["[CRÍTICO] Pratos de porcelana branca extras para quebra em cena (preparar 3 idênticos)"],
      notasArte: "Prato quebra em cena — 3 takes previstos, preparar 3 pratos idênticos de porcelana branca.",
      notasFoto: "Estética TV de tubo, vinheta, luzes coloridas.",
      notasContinuidade: "Copia os movimentos de mise-en-scène da cena 5.",
      posProducao: ["Flashbacks intercalados", "Câmera lenta"],
    },
  });

  await prisma.breakdownSheet.create({
    data: {
      sceneId: sceneByNumero(ressaca.scenes, "10").id,
      figurino: ["Chef_R5 uniforme"],
      trilha: ["Chef_Celular toca (ringtone)"],
    },
  });

  await prisma.breakdownSheet.create({
    data: {
      sceneId: sceneByNumero(ressaca.scenes, "11").id,
      figurino: ["Chef_R5 uniforme"],
      notasFoto: "Estética TV de tubo, vinheta, luzes coloridas.",
      posProducao: ["Toque de fim de ligação"],
      trilha: ["Toque de fim de ligação"],
    },
  });

  const clientes = await prisma.extra.create({
    data: {
      projectId: ressaca.id,
      personagem: "Clientes do restaurante",
      quantidade: 6,
      chamada: new Date("1970-01-01T07:00:00.000Z"),
      saida: new Date("1970-01-01T18:00:00.000Z"),
      cenas: {
        create: ["8", "9", "10", "11", "14A"].map((numero) => ({
          sceneId: sceneByNumero(ressaca.scenes, numero).id,
        })),
      },
    },
  });

  await prisma.extra.create({
    data: {
      projectId: viageiro.id,
      personagem: "Pescadores ao fundo",
      quantidade: 3,
      chamada: new Date("1970-01-01T16:00:00.000Z"),
      saida: new Date("1970-01-01T19:30:00.000Z"),
      cenas: {
        create: ["18", "19"].map((numero) => ({
          sceneId: sceneByNumero(viageiro.scenes, numero).id,
        })),
      },
    },
  });

  const dia3 = await prisma.shootDay.create({
    data: {
      projectId: ressaca.id,
      numeroDia: 3,
      data: new Date("2025-09-01"),
      chamadaGeral: "07:00",
      blocoManhaInicio: "08:45",
      almocoInicio: "13:10",
      almocoFim: "14:10",
      blocoTardeInicio: "14:25",
      desprodInicio: "18:00",

      transporteHorario: "06:30",
      transporteEndereco:
        "Estação Vila Sônia (Linha Amarela do Metrô) · R. Dr. Ulpiano da Costa Manso, 06 - Jardim Peri Peri, São Paulo - SP",
      locacaoNome: "Restaurante Bananeira",
      locacaoEndereco: "Rua Mal. Hastimphilo de Moura, 419 - Morumbi",
      baseInfo:
        "Sala dos fundos do próprio restaurante (cedida pela produção do local) — camarim compartilhado, alimentação servida no salão fechado ao público durante o intervalo.",
      estacionamento: "Estacionamento do restaurante (12 vagas) + rua Mal. Hastimphilo de Moura (vagas adicionais)",
      hospitalNome: "Hospital Family | Hapvida NotreDame Intermédica",
      hospitalEndereco: "Rua João Santucci, 270 - Vila Santa Luzia, Taboão da Serra - SP",
      hospitalTelefone: "(11) não informado",
      meteoNascer: "06:21",
      meteoPor: "17:58",
      meteoMin: 15,
      meteoMax: 24,
      meteoChuva: "0.25mm 20%",
      meteoDescricao: "Sol com algumas nuvens, noite com mais nuvens",
      chamadaEquipe: Object.fromEntries(
        CREW_CALL_DEPARTMENTS.map((dept) => [dept, dept === "Catering" || dept === "Produção" ? "06:00" : "07:00"])
      ),
      observacoesGerais:
        "qualquer tipo de discriminação, assédio ou retaliação não será tolerado. Violência e abuso contra mulher, racismo e LGBTFobia são crimes. É proibido gravar, fotografar e/ou postar qualquer momento de set ou bastidores que revele material do filme ou elenco. Não trazer pessoas fora da equipe para o SET sem autorização prévia da produção. Fumar somente nas áreas indicadas pela produção.",
      observacaoCronogramaElenco:
        "ESP (Cliente Especial) tem chamada antecipada para preparo do efeito de maquiagem da cena 16 — já ajustado no horário individual abaixo, mas fiquem de olho no atraso em cadeia se o preparo passar do previsto.",
      observacaoPlanoSimples:
        "Pessoal, hoje é o último dia no Restaurante Bananeira! Local fecha pro público às 18h, então vamos com tudo até lá. Quem não tem cena na parte da manhã pode chegar depois do almoço, mas avisa a produção antes.",
    },
  });

  // Diárias 1 e 2 já filmadas antes da Diária 3 — sem cenas modeladas neste seed de referência
  // (o foco de dados detalhados é a Diária 3), mas precisam existir para o total de diárias do
  // projeto ficar correto nos documentos gerados (ex.: "Diária de Filmagem #3 de 3").
  await prisma.shootDay.createMany({
    data: [
      { projectId: ressaca.id, numeroDia: 1, data: new Date("2025-08-28") },
      { projectId: ressaca.id, numeroDia: 2, data: new Date("2025-08-30") },
    ],
  });

  const DIA3_MANHA = [
    { numero: "14A", prepMin: 90, rodMin: 90 },
    { numero: "16", prepMin: 0, rodMin: 70 },
    { numero: "5", prepMin: 30, rodMin: 40 },
    { numero: "8", prepMin: 15, rodMin: 30 },
  ];
  const DIA3_TARDE = [
    { numero: "8PL", prepMin: 15, rodMin: 15 },
    { numero: "10", prepMin: 0, rodMin: 45 },
    { numero: "9", prepMin: 45, rodMin: 60 },
    { numero: "11", prepMin: 15, rodMin: 35 },
  ];

  await prisma.sceneShootDay.createMany({
    data: [
      ...DIA3_MANHA.map((s, index) => ({
        sceneId: sceneByNumero(ressaca.scenes, s.numero).id,
        shootDayId: dia3.id,
        bloco: "MANHA" as const,
        ordem: index,
        prepMin: s.prepMin,
        rodMin: s.rodMin,
      })),
      ...DIA3_TARDE.map((s, index) => ({
        sceneId: sceneByNumero(ressaca.scenes, s.numero).id,
        shootDayId: dia3.id,
        bloco: "TARDE" as const,
        ordem: DIA3_MANHA.length + index,
        prepMin: s.prepMin,
        rodMin: s.rodMin,
      })),
    ],
  });

  await prisma.sceneShootDay.update({
    where: { shootDayId_sceneId: { shootDayId: dia3.id, sceneId: sceneByNumero(ressaca.scenes, "14A").id } },
    data: { status: "CONCLUIDA", horaInicioReal: "08:50", horaFimReal: "11:40" },
  });
  await prisma.sceneShootDay.update({
    where: { shootDayId_sceneId: { shootDayId: dia3.id, sceneId: sceneByNumero(ressaca.scenes, "16").id } },
    data: { status: "CONCLUIDA", horaInicioReal: "11:45", horaFimReal: "12:50" },
  });
  await prisma.sceneShootDay.update({
    where: { shootDayId_sceneId: { shootDayId: dia3.id, sceneId: sceneByNumero(ressaca.scenes, "5").id } },
    data: { status: "EM_ANDAMENTO", horaInicioReal: "12:55" },
  });

  await prisma.calendarEvent.createMany({
    data: [
      {
        projectId: ressaca.id,
        data: new Date("2025-08-29"),
        tipo: "ENSAIO",
        nome: "Ensaio de elenco — cenas de salão",
        elementosAfetados: [chef.id, ben.id],
      },
      {
        projectId: ressaca.id,
        data: new Date("2025-08-31"),
        tipo: "FOLGA",
        nome: "Folga da equipe",
        elementosAfetados: [],
      },
      {
        projectId: ressaca.id,
        data: new Date("2025-09-07"),
        tipo: "FERIADO",
        nome: "Independência do Brasil",
        elementosAfetados: [],
      },
    ],
  });

  await prisma.characterCallTime.createMany({
    data: [
      { characterId: chef.id, shootDayId: dia3.id, chamada: "07:00", camarim: "07:15", set: "08:30", saida: "18:20" },
      {
        characterId: sousChef.id,
        shootDayId: dia3.id,
        chamada: "07:00",
        camarim: "07:15",
        set: "08:30",
        saida: "18:20",
      },
      { characterId: ben.id, shootDayId: dia3.id, chamada: "09:15", camarim: "09:30", set: "10:00", saida: "17:10" },
      { characterId: pre.id, shootDayId: dia3.id, chamada: "09:45", camarim: "09:45", set: "10:00", saida: "11:15" },
      // ESP tem efeito especial de make (Breakdown da cena 16) — chamada/camarim mais cedo pra dar tempo de preparo.
      { characterId: esp.id, shootDayId: dia3.id, chamada: "08:30", camarim: "08:30", set: "10:00", saida: "11:15" },
      { characterId: cla.id, shootDayId: dia3.id, chamada: "13:10", camarim: "13:10", set: "13:50", saida: "18:15" },
    ],
  });

  // Hora a Hora da Diária 3 — gerado a partir dos mesmos dados de Stripboard/logística já
  // seedados acima, com a mesma função usada pela UI e pela rota de PDF (evita divergência
  // entre o que o seed grava e o que a "Regenerar automáticos" produziria).
  const dia3ReportData = await getShootDayReportData(ressaca.id, dia3.id);
  if (dia3ReportData) {
    const horaAHoraGerado = generateHoraAHoraEvents({
      chamadaGeral: dia3ReportData.shootDay.chamadaGeral,
      almocoInicio: dia3ReportData.shootDay.almocoInicio,
      almocoFim: dia3ReportData.shootDay.almocoFim,
      desprodInicio: dia3ReportData.shootDay.desprodInicio,
      scenes: dia3ReportData.scenes,
      castPresente: dia3ReportData.castPresente,
      project: dia3ReportData.project,
    });
    await prisma.horaAHoraEvent.createMany({
      data: horaAHoraGerado.map((evento, index) => ({
        shootDayId: dia3.id,
        horaInicio: evento.horaInicio,
        horaFim: evento.horaFim,
        descricao: evento.descricao,
        tipo: evento.tipo,
        geradoAutomaticamente: true,
        ordem: index,
      })),
    });
  }

  // ---------------------------------------------------------------------------
  // Módulo Budgeting — orçamento de exemplo do Ressaca
  // ---------------------------------------------------------------------------

  const budget = await prisma.budget.create({ data: { projectId: ressaca.id } });
  await populateBudgetTemplate(prisma, budget.id);

  await prisma.global.create({
    data: {
      budgetId: budget.id,
      chave: "G_DIAS_SET",
      valor: 3,
      descricao: "Número de dias de set",
      afetaLinhas: [],
    },
  });
  await prisma.global.create({
    data: {
      budgetId: budget.id,
      chave: "G_SEMANAS",
      valor: 1,
      descricao: "Número de semanas de set (dias de set ÷ 5, arredondado para cima)",
      afetaLinhas: [],
    },
  });

  const contaDirecao = await prisma.budgetAccount.findFirstOrThrow({
    where: { budgetId: budget.id, codigo: "1100" },
  });
  const contaCamera = await prisma.budgetAccount.findFirstOrThrow({
    where: { budgetId: budget.id, codigo: "2100" },
  });
  const contaLocacao = await prisma.budgetAccount.findFirstOrThrow({
    where: { budgetId: budget.id, codigo: "2700" },
  });
  const contaAlimentacao = await prisma.budgetAccount.findFirstOrThrow({
    where: { budgetId: budget.id, codigo: "2900" },
  });
  const contaMontagem = await prisma.budgetAccount.findFirstOrThrow({
    where: { budgetId: budget.id, codigo: "3000" },
  });

  const BUDGET_LINE_ITEMS = [
    {
      accountId: contaDirecao.id,
      descricao: "Fernanda Utuari (Diretora)",
      quantidade: 1,
      unidade: "pessoa",
      taxa: 600,
      isFrengeable: true,
      globalRef: "G_DIAS_SET",
    },
    {
      accountId: contaDirecao.id,
      descricao: "Victor Garcia (Co-diretor)",
      quantidade: 1,
      unidade: "pessoa",
      taxa: 600,
      isFrengeable: true,
      globalRef: "G_DIAS_SET",
    },
    {
      accountId: contaCamera.id,
      descricao: "Diretor de Fotografia",
      quantidade: 1,
      unidade: "pessoa",
      taxa: 700,
      isFrengeable: true,
      globalRef: "G_DIAS_SET",
    },
    {
      accountId: contaCamera.id,
      descricao: "1º Assistente de Câmera",
      quantidade: 1,
      unidade: "pessoa",
      taxa: 350,
      isFrengeable: true,
      globalRef: "G_DIAS_SET",
    },
    {
      accountId: contaCamera.id,
      descricao: "Aluguel câmera body",
      quantidade: 1,
      unidade: "câmera",
      taxa: 900,
      isFrengeable: false,
      globalRef: "G_SEMANAS",
    },
    {
      accountId: contaCamera.id,
      descricao: "Kit lentes",
      quantidade: 1,
      unidade: "kit",
      taxa: 400,
      isFrengeable: false,
      globalRef: "G_DIAS_SET",
    },
    {
      accountId: contaCamera.id,
      descricao: "Monitor + acessórios",
      quantidade: 1,
      unidade: "kit",
      taxa: 150,
      isFrengeable: false,
      globalRef: "G_DIAS_SET",
    },
    {
      accountId: contaLocacao.id,
      descricao: "Restaurante Bananeira",
      quantidade: 1,
      unidade: "locação",
      taxa: 1200,
      isFrengeable: false,
      globalRef: "G_DIAS_SET",
    },
    {
      accountId: contaAlimentacao.id,
      descricao: "Catering (20 pessoas)",
      quantidade: 20,
      unidade: "pessoa",
      taxa: 45,
      isFrengeable: false,
      globalRef: "G_DIAS_SET",
    },
    {
      accountId: contaMontagem.id,
      descricao: "Editor",
      quantidade: 1,
      unidade: "semana",
      periodo: 3,
      taxa: 2000,
      isFrengeable: true,
      globalRef: null as string | null,
    },
  ];

  const ordemPorConta = new Map<string, number>();
  for (const li of BUDGET_LINE_ITEMS) {
    const ordem = ordemPorConta.get(li.accountId) ?? 0;
    ordemPorConta.set(li.accountId, ordem + 1);
    await saveLineItemWithCalc(prisma, budget.id, null, {
      accountId: li.accountId,
      descricao: li.descricao,
      quantidade: li.quantidade,
      unidade: li.unidade,
      periodo: li.periodo ?? 1,
      taxa: li.taxa,
      moeda: "BRL",
      taxaCambio: 1,
      isFrengeable: li.isFrengeable,
      globalRef: li.globalRef,
      notas: null,
      ordem,
    });
  }

  const fringesAplicaEm = [contaDirecao.id, contaCamera.id, contaMontagem.id];

  const fringeInss = await prisma.fringe.create({
    data: { budgetId: budget.id, nome: "INSS", percentual: 20, teto: 7786, tipo: "INSS", aplicaEm: fringesAplicaEm },
  });
  await recalcFringeLineItems(prisma, budget.id, fringeInss);

  const fringeFgts = await prisma.fringe.create({
    data: { budgetId: budget.id, nome: "FGTS", percentual: 8, tipo: "FGTS", aplicaEm: fringesAplicaEm },
  });
  await recalcFringeLineItems(prisma, budget.id, fringeFgts);

  const fringeIss = await prisma.fringe.create({
    data: { budgetId: budget.id, nome: "ISS", percentual: 2, tipo: "ISS", aplicaEm: fringesAplicaEm },
  });
  await recalcFringeLineItems(prisma, budget.id, fringeIss);

  await prisma.budgetScenario.create({
    data: {
      budgetId: budget.id,
      nome: "Cenário A",
      notas: "Plano original (3 dias)",
      isBase: true,
    },
  });
  await prisma.budgetScenario.create({
    data: {
      budgetId: budget.id,
      nome: "Cenário B",
      notas: "Ampliado (5 dias)",
      overrides: {
        create: [
          { chave: "G_DIAS_SET", valor: 5 },
          { chave: "G_SEMANAS", valor: 1 },
        ],
      },
    },
  });
  await prisma.budgetScenario.create({
    data: {
      budgetId: budget.id,
      nome: "Cenário C",
      notas: "Extensão máxima (7 dias)",
      overrides: {
        create: [
          { chave: "G_DIAS_SET", valor: 7 },
          { chave: "G_SEMANAS", valor: 2 },
        ],
      },
    },
  });

  await prisma.actual.create({
    data: {
      budgetId: budget.id,
      accountId: contaCamera.id,
      descricao: "Aluguel câmera e lentes D1-D3",
      valor: 3800,
      data: new Date("2025-09-01"),
    },
  });
  await prisma.actual.create({
    data: {
      budgetId: budget.id,
      accountId: contaLocacao.id,
      descricao: "Restaurante Bananeira 3 dias",
      valor: 3600,
      data: new Date("2025-09-01"),
    },
  });
  await prisma.actual.create({
    data: {
      budgetId: budget.id,
      accountId: contaAlimentacao.id,
      descricao: "Catering 3 dias",
      valor: 2950,
      data: new Date("2025-09-01"),
    },
  });
  await prisma.actual.create({
    data: {
      budgetId: budget.id,
      accountId: contaMontagem.id,
      descricao: "Editor semana 1",
      valor: 4000,
      data: new Date("2025-09-08"),
    },
  });

  // Histórico de drafts: Ressaca teve uma pequena revisão de texto na cena 5 (sem mexer em
  // tipo/período/set/páginas/elenco, pra não desalinhar o resto dos dados de referência já
  // seedados — Prep/Rod da Diária 3, orçamento, breakdown etc. estão todos calibrados pro
  // conteúdo atual das 8 cenas). Viageiro fica só com o draft original, sem revisão.
  const cena5Original = "Chef prepara o prato do dia enquanto o salão ainda está vazio.";
  const cena5Revisada = "Chef prepara o prato do dia com cuidado excessivo, enquanto o salão ainda está vazio.";

  await prisma.scriptDraft.create({
    data: {
      projectId: ressaca.id,
      numero: 1,
      corRevisao: revisionColorForDraftNumero(1),
      numeroDraft: "1st Draft",
      dataDraft: "15 de agosto de 2025",
      arquivoNome: "ressaca-v1.fdx",
    },
  });
  const ressacaDraft2 = await prisma.scriptDraft.create({
    data: {
      projectId: ressaca.id,
      numero: 2,
      corRevisao: revisionColorForDraftNumero(2),
      numeroDraft: "2nd Draft",
      dataDraft: "25 de agosto de 2025",
      arquivoNome: "ressaca-v2.fdx",
    },
  });
  await prisma.sceneDiff.create({
    data: {
      scriptDraftId: ressacaDraft2.id,
      sceneNumero: "5",
      tipo: "MODIFICADA",
      camposAlterados: { sinopse: { antes: cena5Original, depois: cena5Revisada } },
    },
  });
  await prisma.scene.update({
    where: { projectId_numero: { projectId: ressaca.id, numero: "5" } },
    data: { sinopse: cena5Revisada },
  });

  await prisma.scriptDraft.create({
    data: {
      projectId: viageiro.id,
      numero: 1,
      corRevisao: revisionColorForDraftNumero(1),
      numeroDraft: "1st Draft",
      dataDraft: "10 de agosto de 2025",
      arquivoNome: "viageiro-v1.fdx",
    },
  });

  // Documentos do AD: prestação de contas (só o protagonista e um coadjuvante têm cachê
  // fechado ainda — os demais ficam "—" no relatório, cenário realista de produção em andamento).
  await prisma.character.update({
    where: { id: chef.id },
    data: { cacheeDiario: "1200.00", percentualHold: "50" },
  });
  await prisma.character.update({
    where: { id: ben.id },
    data: { cacheeDiario: "400.00", percentualHold: "30" },
  });

  await prisma.crewMember.createMany({
    data: [
      { projectId: ressaca.id, nome: "Laura Prado", funcao: "Diretora", departamento: "Direção", telefone: "(11) 98888-0001", email: "laura@pumpmidia.com" },
      { projectId: ressaca.id, nome: "Rafael Costa", funcao: "1º Assistente de Direção", departamento: "Direção", telefone: "(11) 98888-0002", email: "rafael.ad@pumpmidia.com" },
      { projectId: ressaca.id, nome: "Beatriz Nunes", funcao: "Diretora de Fotografia", departamento: "Câmera e fotografia", telefone: "(11) 98888-0003", email: "bia.dop@pumpmidia.com" },
      { projectId: ressaca.id, nome: "Diego Alves", funcao: "Operador de câmera", departamento: "Câmera e fotografia", telefone: "(11) 98888-0004", email: null },
      { projectId: ressaca.id, nome: "Marina Reis", funcao: "Diretora de Arte", departamento: "Arte e cenografia", telefone: "(11) 98888-0005", email: "marina.arte@pumpmidia.com" },
      { projectId: ressaca.id, nome: "Felipe Santos", funcao: "Técnico de som direto", departamento: "Som direto", telefone: "(11) 98888-0006", email: null },
    ],
  });

  const scene16 = sceneByNumero(ressaca.scenes, "16");
  const scene9 = sceneByNumero(ressaca.scenes, "9");
  await prisma.continuityNote.createMany({
    data: [
      { sceneId: scene16.id, shootDayId: dia3.id, texto: "Chef segura a taça de vinho com a mão direita durante todo o brinde — manter em todas as tomadas." },
      { sceneId: scene16.id, shootDayId: dia3.id, texto: "Avental sujo de vinho: a mancha deve ficar do lado esquerdo, mesma posição da cena 8PL." },
      { sceneId: scene9.id, shootDayId: dia3.id, texto: "Prato quebrado: reiniciar contagem de cacos a cada take, usar sempre os pratos reserva numerados." },
    ],
  });

  await prisma.dailyProgressReport.create({
    data: {
      shootDayId: dia3.id,
      cenasConcluidas: ["14A", "16", "5", "8", "8PL", "10", "9"],
      cenasNaoConcluidas: ["11"],
      paginasFilmadas: "3.625",
      horaInicioReal: "07:15",
      horaTerminoReal: "19:40",
      atrasoMin: 15,
      motivoAtraso: "Chuva atrasou a montagem do primeiro setup em 15 minutos.",
      observacoes: "Cena 11 remanejada para diária seguinte por falta de luz natural no fim do dia.",
    },
  });

  // ---------------------------------------------------------------------------
  // Módulo Shots (plano de filmagem) — exemplo de decupagem do Viageiro, cenas 1 e 2, com uma
  // diária de exemplo pra ficar acessível pelo Stripboard/Ordem do Dia (Viageiro não tinha
  // nenhuma diária até aqui).
  // ---------------------------------------------------------------------------

  const viageiroScene1 = sceneByNumero(viageiro.scenes, "1");
  const viageiroScene2 = sceneByNumero(viageiro.scenes, "2");

  const viageiroDia1 = await prisma.shootDay.create({
    data: {
      projectId: viageiro.id,
      numeroDia: 1,
      data: new Date("2025-09-15"),
      chamadaGeral: "06:30",
      blocoManhaInicio: "07:30",
      almocoInicio: "12:00",
      almocoFim: "13:00",
      blocoTardeInicio: "13:15",
      desprodInicio: "17:30",
      locacaoNome: "Beira do Rio",
      locacaoEndereco: "Represa do Guarapiranga, margem sul - São Paulo - SP",
    },
  });

  await prisma.sceneShootDay.createMany({
    data: [
      { sceneId: viageiroScene1.id, shootDayId: viageiroDia1.id, bloco: "MANHA", ordem: 0, prepMin: null, rodMin: null },
      { sceneId: viageiroScene2.id, shootDayId: viageiroDia1.id, bloco: "TARDE", ordem: 1, prepMin: null, rodMin: null },
    ],
  });

  for (const shot of VIAGEIRO_SCENE1_SHOTS) {
    await prisma.shot.create({
      data: {
        sceneId: viageiroScene1.id,
        projectId: viageiro.id,
        ordem: shot.ordem,
        numero: shot.numero,
        descricao: shot.descricao,
        tamanho: shot.tamanho,
        lente: shot.lente,
        angulo: shot.angulo,
        movimento: shot.movimento,
        takesPrevistos: shot.takesPrevistos,
        duracaoTakeMin: shot.duracaoTakeMin,
        tempoSetupMin: shot.tempoSetupMin,
        tempoTotalMin: computeTempoTotal(shot.takesPrevistos, shot.duracaoTakeMin, shot.tempoSetupMin),
        notasContinuidade: shot.notasContinuidade,
      },
    });
  }
  for (const shot of VIAGEIRO_SCENE2_SHOTS) {
    await prisma.shot.create({
      data: {
        sceneId: viageiroScene2.id,
        projectId: viageiro.id,
        ordem: shot.ordem,
        numero: shot.numero,
        descricao: shot.descricao,
        tamanho: shot.tamanho,
        lente: shot.lente,
        angulo: shot.angulo,
        movimento: shot.movimento,
        takesPrevistos: shot.takesPrevistos,
        duracaoTakeMin: shot.duracaoTakeMin,
        tempoSetupMin: shot.tempoSetupMin,
        tempoTotalMin: computeTempoTotal(shot.takesPrevistos, shot.duracaoTakeMin, shot.tempoSetupMin),
        notasContinuidade: shot.notasContinuidade,
      },
    });
  }

  // tipoReset/tempoResetMin (e SceneShootDay.rodMin) são derivados aqui pelo mesmo caminho das
  // rotas de API reais — nunca hardcoded no seed.
  const viageiroScene1Shots = await recalculateScene(viageiroScene1.id);
  const viageiroScene2Shots = await recalculateScene(viageiroScene2.id);

  // ShotSchedule de exemplo — o AD reorganiza os planos das cenas 1 e 2 numa ordem só do dia,
  // cruzando cenas e empurrando os planos "Detalhe" pro fim (Shot.sceneId nunca muda; `ordem`
  // aqui é a posição global no dia). Mapeamento por Shot.ordem (posição interna na cena), não
  // pelo campo `numero`. tipoReset/tempoResetMin são recalculados por recalculateDaySchedule(),
  // nunca hardcoded no seed.
  const viageiroScene1ShotByNumero = (numero: string) =>
    viageiroScene1Shots.find((shot) => shot.numero === numero)!;
  const viageiroScene2ShotByNumero = (numero: string) =>
    viageiroScene2Shots.find((shot) => shot.numero === numero)!;

  const VIAGEIRO_SHOT_SCHEDULE: { ordem: number; shot: Shot }[] = [
    { ordem: 1, shot: viageiroScene2ShotByNumero("1") }, // cena 2, numero 1, Aberto
    { ordem: 2, shot: viageiroScene2ShotByNumero("3") }, // cena 2, numero 3, Médio
    { ordem: 3, shot: viageiroScene1ShotByNumero("1") }, // cena 1, numero 1, Médio
    { ordem: 4, shot: viageiroScene2ShotByNumero("4") }, // cena 2, numero 4, Geral
    { ordem: 5, shot: viageiroScene1ShotByNumero("2") }, // cena 1, numero 2, Close
    { ordem: 6, shot: viageiroScene1ShotByNumero("5") }, // cena 1, numero 5, Close
    { ordem: 7, shot: viageiroScene2ShotByNumero("2") }, // cena 2, numero 2, Detalhe
    { ordem: 8, shot: viageiroScene1ShotByNumero("4") }, // cena 1, numero 4, Médio
  ];

  for (const { ordem, shot } of VIAGEIRO_SHOT_SCHEDULE) {
    await prisma.shotSchedule.create({
      data: {
        shotId: shot.id,
        shootDayId: viageiroDia1.id,
        projectId: viageiro.id,
        ordem,
      },
    });
  }

  const viageiroShotSchedule = await recalculateDaySchedule(viageiroDia1.id);

  console.log("Seed concluído.");
  console.log(`Login demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Projeto Ressaca: ${ressaca.id} (${ressaca.scenes.length} cenas, personagem ${chef.personagem})`);
  console.log(`Projeto Viageiro: ${viageiro.id} (${viageiro.scenes.length} cenas)`);
  console.log(`Figuração de exemplo: ${clientes.personagem}`);
  console.log(`Diárias do Ressaca: 3 no total (1 e 2 sem cenas modeladas; Diária ${dia3.numeroDia} detalhada, 8 cenas)`);
  console.log("Elenco do Ressaca: PRO, CHEF, BEN, PRE, ESP, CLA (chamada/camarim/set/saída completos na Diária 3)");
  console.log("Eventos de calendário: ensaio, folga e feriado em agosto/setembro de 2025");
  console.log(`Orçamento de exemplo: ${budget.id} (Ressaca) — ${BUDGET_LINE_ITEMS.length} line items, 3 fringes`);
  console.log("Cenários: A (base, 3 dias), B (5 dias), C (7 dias/2 semanas)");
  console.log("Lançamentos reais (Acompanhamento): Câmera, Locação, Alimentação, Montagem");
  console.log("Drafts: Ressaca com 2 (Branco, Azul — cena 5 revisada); Viageiro com 1 (Branco)");
  console.log("Documentos do AD: cachê de PRO/BEN, 6 crew members, 3 notas de continuidade, 1 daily progress report (Diária 3)");
  console.log(
    `Sistema de ID de elenco: Ressaca em ID_CURTO (PRO=1...CLA=6); Viageiro em NUMERACAO (PRO1=1, CHEF1=2)`
  );
  console.log(`Hora a Hora: ${dia3ReportData ? "gerado" : "não gerado"} para a Diária 3 (${dia3.numeroDia})`);
  console.log("Novos campos de AD: notasAD (cenas 9, 14A, 16), observacaoCronogramaElenco e observacaoPlanoSimples (Diária 3)");
  console.log(
    `Diária do Viageiro: ${viageiroDia1.numeroDia} (${viageiroDia1.locacaoNome}) — cenas 1 (MANHA) e 2 (TARDE)`
  );
  console.log(
    `Planos (Shots) do Viageiro: cena 1 com ${viageiroScene1Shots.length} planos, cena 2 com ${viageiroScene2Shots.length} planos (tipoReset/tempoResetMin recalculados via classifyReset)`
  );
  console.log(
    `ShotSchedule do Viageiro: ${viageiroShotSchedule.length} planos reorganizados na Diária ${viageiroDia1.numeroDia}, cruzando cenas 1 e 2 (tipoReset/tempoResetMin recalculados via recalculateDaySchedule)`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

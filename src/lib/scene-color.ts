// Paleta fixa de cores pra colorir a borda esquerda de cada plano pela cena de origem na visão
// "Por plano" do Stripboard — como cenas não têm cor própria em nenhum outro lugar do app (a
// PERIODO_BG do strip-card.tsx é por dia/noite/entardecer, não por cena), a cor é derivada
// deterministicamente do sceneId (hash simples) pra ficar estável entre renders/reloads.
const SCENE_COLOR_PALETTE = [
  "#3b82f6", // azul
  "#ef4444", // vermelho
  "#10b981", // verde
  "#f59e0b", // âmbar
  "#8b5cf6", // roxo
  "#ec4899", // rosa
  "#14b8a6", // teal
  "#6366f1", // índigo
];

export function getSceneColor(sceneId: string): string {
  let hash = 0;
  for (let i = 0; i < sceneId.length; i++) {
    hash = (hash * 31 + sceneId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % SCENE_COLOR_PALETTE.length;
  return SCENE_COLOR_PALETTE[index];
}

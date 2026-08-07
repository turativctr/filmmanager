// Estrutura de dados que separa a extração de texto do PDF (feita no navegador — ver
// pdf-script-extract-browser.ts) da interpretação geométrica do roteiro (feita no servidor — ver
// pdf-script-parser.ts). Compartilhado pelos dois lados: é exatamente o payload JSON que trafega
// entre cliente e servidor.
export type RawItem = { text: string; x0: number; x1: number };
export type Line = { page: number; y: number; items: RawItem[]; text: string };
export type ExtractedPage = { lines: Line[]; pageWidth: number; pageHeight: number };

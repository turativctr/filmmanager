/** Artigos/preposições ignorados ao contar "palavras relevantes" de um título — decide qual dos 3
 *  modos de sigla usar (palavra única / CamelCase / iniciais), mas não é removido do texto em si:
 *  o modo CamelCase e o modo iniciais operam sobre TODAS as palavras do título. */
const IGNORED_WORDS = new Set([
  "de",
  "do",
  "da",
  "dos",
  "das",
  "no",
  "na",
  "nos",
  "nas",
  "o",
  "a",
  "os",
  "as",
  "e",
  "em",
]);

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function splitWords(titulo: string): string[] {
  return titulo.trim().split(/\s+/).filter(Boolean);
}

function relevantWords(words: string[]): string[] {
  return words.filter((w) => !IGNORED_WORDS.has(stripAccents(w).toLowerCase()));
}

function alnumOnly(value: string): string {
  return stripAccents(value).replace(/[^a-zA-Z0-9]/g, "");
}

function toCamelCase(words: string[]): string {
  return words
    .map((w) => {
      const clean = alnumOnly(w);
      return clean ? clean[0].toUpperCase() + clean.slice(1).toLowerCase() : "";
    })
    .join("");
}

/** Calcula a sigla automaticamente a partir do título:
 *  - 1 palavra relevante → a própria palavra (sem espaços/acentos)
 *  - 2 palavras relevantes → CamelCase de todas as palavras do título
 *  - 3+ palavras relevantes → iniciais de todas as palavras do título; se o resultado tiver menos
 *    de 3 letras, cai para CamelCase */
export function computeSiglaFromTitulo(titulo: string): string {
  const words = splitWords(titulo);
  const relevant = relevantWords(words);

  if (relevant.length <= 1) {
    const word = relevant[0] ?? words[0] ?? "";
    return alnumOnly(word);
  }

  if (relevant.length === 2) {
    return toCamelCase(words);
  }

  const initials = words
    .map((w) => alnumOnly(w).charAt(0).toUpperCase())
    .filter(Boolean)
    .join("");

  return initials.length >= 3 ? initials : toCamelCase(words);
}

/** Sigla usada no nome dos arquivos gerados: a definida manualmente no projeto, ou calculada
 *  automaticamente a partir do título quando ausente. */
export function getSigla(projeto: { titulo: string; sigla?: string | null }): string {
  const manual = projeto.sigla?.trim();
  if (manual) return manual;
  return computeSiglaFromTitulo(projeto.titulo);
}

function formatDateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Remove caracteres inválidos em nomes de arquivo em qualquer SO: / \ : * ? " < > | e espaço. */
function sanitizeFilename(value: string): string {
  return value.replace(/[/\\:*?"<>| ]+/g, "");
}

/** Monta o nome padrão de um arquivo gerado para download: [Sigla]_[Tipo]_[Variante]_[AAAAMMDD].[ext]
 *  (Variante é omitida quando não informada.) */
export function gerarNomeArquivo({
  projeto,
  tipo,
  variante,
  ext,
  data = new Date(),
}: {
  projeto: { titulo: string; sigla?: string | null };
  tipo: string;
  variante?: string | null;
  ext: "pdf" | "xlsx";
  data?: Date;
}): string {
  const sigla = getSigla(projeto);
  const parts = [sigla, tipo, variante, formatDateStamp(data)].filter(
    (p): p is string => Boolean(p && p.trim())
  );
  return sanitizeFilename(`${parts.join("_")}.${ext}`);
}

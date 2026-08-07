// Copia os assets estáticos do pdfjs-dist (worker + cmaps + fontes padrão) de node_modules pra
// public/pdfjs, onde a extração client-side (src/lib/pdf-script-extract-browser.ts) espera
// encontrá-los em runtime via URL relativa (/pdfjs/...). Roda no postinstall — assim a cópia
// sempre acompanha a versão de pdfjs-dist instalada (inclusive na Vercel, cujo build roda
// `npm install` antes de `next build`), sem depender de manter esses arquivos versionados no git.
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pdfjsRoot = path.join(root, "node_modules", "pdfjs-dist");
const outDir = path.join(root, "public", "pdfjs");

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await cp(path.join(pdfjsRoot, "legacy", "build", "pdf.worker.min.mjs"), path.join(outDir, "pdf.worker.min.mjs"));
  await cp(path.join(pdfjsRoot, "cmaps"), path.join(outDir, "cmaps"), { recursive: true });
  await cp(path.join(pdfjsRoot, "standard_fonts"), path.join(outDir, "standard_fonts"), { recursive: true });

  console.log("[copy-pdfjs-assets] assets copiados para public/pdfjs");
}

main().catch((err) => {
  console.error("[copy-pdfjs-assets] falha ao copiar assets do pdfjs-dist:", err);
  process.exit(1);
});

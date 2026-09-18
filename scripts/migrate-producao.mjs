/**
 * Aplica as migrations pendentes no deploy da Vercel — e SÓ no deploy de produção.
 *
 * Por que existe em vez de `prisma migrate deploy && next build` direto no script de build:
 * um build de preview roda o mesmo comando, e se a variável DATABASE_URL do preview apontar
 * pro mesmo banco de produção (o padrão da Vercel é a variável valer pros três ambientes),
 * o preview passaria a migrar produção antes do código estar no ar. VERCEL_ENV existe só na
 * Vercel e vale "production" apenas no deploy de produção — fora dela (build local) não
 * aplica nada.
 *
 * Migration por conexão direta: o pooler do Neon (host com "-pooler") é PgBouncer em modo
 * transação, onde o lock de migration do Prisma pode falhar. Se DIRECT_URL existir, é ela
 * que vale aqui; o app em runtime continua usando DATABASE_URL (o pooler) normalmente.
 */
import { spawnSync } from "node:child_process";

const ambiente = process.env.VERCEL_ENV;

if (ambiente !== "production") {
  console.log(`[migrate] pulado — VERCEL_ENV=${ambiente ?? "(ausente)"}. Só o deploy de produção aplica migration.`);
  process.exit(0);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL não está definida no ambiente de build. Build interrompido antes do next build.");
  process.exit(1);
}

console.log(`[migrate] aplicando migrations em produção${process.env.DIRECT_URL ? " (via DIRECT_URL)" : ""}...`);
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(r.status ?? 1);

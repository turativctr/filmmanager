import withPWAInit from "@ducanh2912/next-pwa";

// Service worker desligado em dev (padrão da lib) — evita cache "grudado" durante desenvolvimento
// com Fast Refresh. Cache de páginas dinâmicas autenticadas (offline de verdade) fica pra uma
// próxima rodada — por ora só instalabilidade (manifest + SW registrado) e cache padrão de assets
// estáticos via Workbox.
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist resolve seu worker (pdf.worker.mjs) via require/import dinâmico relativo a si mesmo
  // em tempo de execução — deixar o webpack reescrever esses módulos quebra essa resolução dentro
  // da função serverless. Externalizar preserva a resolução nativa do Node em node_modules.
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
  },
};

export default withPWA(nextConfig);

-- CreateEnum
CREATE TYPE "SceneEnvironment" AS ENUM ('INT', 'EXT');

-- CreateEnum
CREATE TYPE "SceneShift" AS ENUM ('DIA', 'NOITE', 'ENTARDECER');

-- CreateEnum
CREATE TYPE "CharacterKind" AS ENUM ('PRO', 'CHEF');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "diretor" TEXT,
    "producao" TEXT,
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "SceneEnvironment" NOT NULL,
    "periodo" "SceneShift" NOT NULL,
    "set" TEXT,
    "locacao" TEXT,
    "sinopse" TEXT,
    "paginas" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "diaNarrativo" INTEGER,
    "tempoEstimadoMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "idCurto" TEXT NOT NULL,
    "tipo" "CharacterKind" NOT NULL,
    "personagem" TEXT NOT NULL,
    "ator" TEXT,
    "idadePersonagem" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_cast" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "scene_cast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shoot_days" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "numeroDia" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "chamadaGeral" TIME,
    "rodando" TIME,
    "almoco" TIME,
    "posAlmoco" TIME,
    "desproducao" TIME,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shoot_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_shoot_days" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "prepMin" INTEGER,
    "rodMin" INTEGER,

    CONSTRAINT "scene_shoot_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extras" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "personagem" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "chamada" TIME,
    "saida" TIME,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_scenes" (
    "id" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,

    CONSTRAINT "extra_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breakdown_sheets" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "figurino" TEXT[],
    "make" TEXT[],
    "arteDressing" TEXT,
    "objetos" TEXT[],
    "comidaCena" TEXT[],
    "microfones" TEXT[],
    "trilha" TEXT[],
    "habilidades" TEXT[],
    "arteGrafica" TEXT[],
    "posProducao" TEXT[],
    "notasArte" TEXT,
    "notasFoto" TEXT,
    "notasSom" TEXT,
    "notasContinuidade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breakdown_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_projectId_numero_key" ON "scenes"("projectId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "characters_projectId_idCurto_key" ON "characters"("projectId", "idCurto");

-- CreateIndex
CREATE UNIQUE INDEX "scene_cast_sceneId_characterId_key" ON "scene_cast"("sceneId", "characterId");

-- CreateIndex
CREATE UNIQUE INDEX "shoot_days_projectId_numeroDia_key" ON "shoot_days"("projectId", "numeroDia");

-- CreateIndex
CREATE UNIQUE INDEX "scene_shoot_days_shootDayId_sceneId_key" ON "scene_shoot_days"("shootDayId", "sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "scene_shoot_days_shootDayId_ordem_key" ON "scene_shoot_days"("shootDayId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "extra_scenes_extraId_sceneId_key" ON "extra_scenes"("extraId", "sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "breakdown_sheets_sceneId_key" ON "breakdown_sheets"("sceneId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_cast" ADD CONSTRAINT "scene_cast_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_cast" ADD CONSTRAINT "scene_cast_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shoot_days" ADD CONSTRAINT "shoot_days_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_shoot_days" ADD CONSTRAINT "scene_shoot_days_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_shoot_days" ADD CONSTRAINT "scene_shoot_days_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "shoot_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extras" ADD CONSTRAINT "extras_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_scenes" ADD CONSTRAINT "extra_scenes_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "extras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_scenes" ADD CONSTRAINT "extra_scenes_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_sheets" ADD CONSTRAINT "breakdown_sheets_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

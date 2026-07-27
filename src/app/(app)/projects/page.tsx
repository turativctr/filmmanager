import { Film, Plus } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { ProjectCard } from "@/components/projects/project-card";
import { ArchivedProjectsSection } from "@/components/projects/archived-projects-section";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session!.user.role === "ADMIN";

  // ADMIN enxerga todo projeto, inclusive órfãos (ownerId null) — USER continua restrito aos
  // próprios. O dono é sempre buscado (join barato) mas só vira ownerLabel pra ADMIN — usuários
  // comuns nunca recebem esse dado no payload.
  const projectsRaw = await prisma.project.findMany({
    where: isAdmin ? {} : { ownerId: session!.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { scenes: true, shootDays: true } },
      owner: { select: { email: true } },
    },
  });

  const projects = projectsRaw.map(({ owner, ...p }) => ({
    ...p,
    ownerLabel: isAdmin ? `Dono: ${owner?.email ?? "Sem dono"}` : undefined,
  }));

  const activeProjects = projects.filter((p) => !p.arquivado);
  const archivedProjects = projects.filter((p) => p.arquivado);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground">
            Selecione um projeto ou crie um novo para começar.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo projeto
          </Link>
        </Button>
      </div>

      {activeProjects.length === 0 ? (
        <EmptyState
          icon={Film}
          title="Nenhum projeto ainda"
          description="Crie o primeiro para começar a planejar."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {archivedProjects.length > 0 && <ArchivedProjectsSection projects={archivedProjects} />}
    </div>
  );
}

import { Film, Plus } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { ProjectCard } from "@/components/projects/project-card";
import { ArchivedProjectsSection } from "@/components/projects/archived-projects-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const projects = await prisma.project.findMany({
    where: { ownerId: session!.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scenes: true, shootDays: true } } },
  });

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
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Film className="h-8 w-8" />
            <p>Nenhum projeto ainda. Crie o primeiro para começar a planejar.</p>
          </CardContent>
        </Card>
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

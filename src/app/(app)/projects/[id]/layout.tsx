import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { ProjectLifecycleMenu } from "@/components/projects/project-lifecycle-menu";
import { ProjectStatusBadges } from "@/components/projects/project-status-badge";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const project = await prisma.project.findFirst({
    where: { id: params.id, ownerId: session!.user.id },
  });

  if (!project) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.titulo}</h1>
            <ProjectStatusBadges status={project.status} arquivado={project.arquivado} />
          </div>
          <p className="text-sm text-muted-foreground">
            {[project.diretor && `Direção: ${project.diretor}`, project.producao]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectLifecycleMenu projectId={project.id} status={project.status} arquivado={project.arquivado} />
          <EditProjectDialog
            project={{
              id: project.id,
              titulo: project.titulo,
              diretor: project.diretor,
              producao: project.producao,
              dataInicio: project.dataInicio?.toISOString() ?? null,
              dataFim: project.dataFim?.toISOString() ?? null,
              equipeTecnica: project.equipeTecnica,
              logoUrl: project.logoUrl,
              sistemaIdElenco: project.sistemaIdElenco,
              sigla: project.sigla,
              continuismoResponsavel: project.continuismoResponsavel,
              continuismoUsarLogo: project.continuismoUsarLogo,
              continuismoLinhasPorFolha: project.continuismoLinhasPorFolha,
            }}
          />
          <DeleteProjectButton projectId={project.id} projectTitulo={project.titulo} redirectTo="/projects" />
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

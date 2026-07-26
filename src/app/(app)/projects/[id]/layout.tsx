import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { ProjectLifecycleMenu } from "@/components/projects/project-lifecycle-menu";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Nome do projeto + créditos + badges de status NÃO aparecem mais aqui — o breadcrumb do Header
// global já mostra o nome, e cada página passou a ter seu próprio H1 de seção (ver PageHeader).
// Exceção: a Visão Geral (page.tsx deste mesmo diretório) mostra esses dados de volta, por ser a
// única página onde eles são o assunto. Só as ações de projeto (⋮ e ⚙️) continuam globais aqui.
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
      <div className="flex justify-end gap-2">
        <ProjectLifecycleMenu
          projectId={project.id}
          status={project.status}
          arquivado={project.arquivado}
          projectTitulo={project.titulo}
          deleteRedirectTo="/projects"
        />
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
      </div>
      <div>{children}</div>
    </div>
  );
}

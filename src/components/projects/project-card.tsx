"use client";

import type { ProjectStatus } from "@prisma/client";
import Link from "next/link";

import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectLifecycleMenu } from "@/components/projects/project-lifecycle-menu";
import { ProjectStatusBadges } from "@/components/projects/project-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pluralize } from "@/lib/pluralize";

export type ProjectCardData = {
  id: string;
  titulo: string;
  diretor: string | null;
  producao: string | null;
  status: ProjectStatus;
  arquivado: boolean;
  _count: { scenes: number; shootDays: number };
};

export function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <div className="relative">
      {/* O menu/excluir ficam fora do <Link>, como irmãos no DOM — um <button> dentro de <a> seria
          HTML inválido, e por serem posicionados absolutamente eles capturam o clique normalmente
          sem precisar de stopPropagation. */}
      <Link href={`/projects/${project.id}`} className="block h-full">
        <Card className="h-full rounded-2xl border-white/50 bg-white/70 backdrop-blur-md transition-colors hover:border-foreground/30">
          <CardHeader>
            <CardTitle className="pr-16 text-base">{project.titulo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {project.diretor && <p>Direção: {project.diretor}</p>}
            {project.producao && <p>Produção: {project.producao}</p>}
            <p>
              {pluralize(project._count.scenes, "cena")} · {pluralize(project._count.shootDays, "diária", "diárias")}
            </p>
            <ProjectStatusBadges status={project.status} arquivado={project.arquivado} className="pt-1" />
          </CardContent>
        </Card>
      </Link>
      <div className="absolute right-2 top-2 flex gap-1">
        <ProjectLifecycleMenu projectId={project.id} status={project.status} arquivado={project.arquivado} />
        <DeleteProjectButton projectId={project.id} projectTitulo={project.titulo} />
      </div>
    </div>
  );
}

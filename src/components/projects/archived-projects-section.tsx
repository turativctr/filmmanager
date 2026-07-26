"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { ProjectCardData } from "@/components/projects/project-card";
import { ProjectCard } from "@/components/projects/project-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function ArchivedProjectsSection({ projects }: { projects: ProjectCardData[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-4">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        Projetos arquivados ({projects.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 grid grid-cols-1 gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

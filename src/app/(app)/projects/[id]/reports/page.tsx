import { redirect } from "next/navigation";

export default function ReportsPage({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}/documentos`);
}

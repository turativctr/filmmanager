import { redirect } from "next/navigation";

export default function AdDocumentsPage({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}/documentos`);
}

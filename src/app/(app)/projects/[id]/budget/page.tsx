import { redirect } from "next/navigation";

export default function BudgetPage({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}/budget/topsheet`);
}

import { FormEditor } from "@/components/form-screen";

export default async function Page({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return <FormEditor id={formId} />;
}

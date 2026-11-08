import { ReviewScreen } from "@/components/admin-screens";

export default async function Page({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return <ReviewScreen id={itemId} />;
}

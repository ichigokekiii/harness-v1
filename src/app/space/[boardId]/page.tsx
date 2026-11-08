import { SpaceBoard } from "@/components/space-screen";

export default async function Page({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <SpaceBoard id={boardId} />;
}

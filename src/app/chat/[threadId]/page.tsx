import { ChatThread } from "@/components/chat-screen";

export default async function Page({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <ChatThread id={threadId} />;
}

import { handle } from "@/server/handlers";

async function run(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return handle(request.method, path, request);
}

export const GET = run;
export const POST = run;
export const PUT = run;

import { prisma } from "@/lib/clients/prisma";

export const runtime = "nodejs";

export async function POST() {
  if (!process.env.DATABASE_URL?.trim()) {
    return Response.json({ error: "No database configured" }, { status: 500 });
  }

  const deleted = await prisma.workflowCache.deleteMany({});
  return Response.json({ deletedCount: deleted.count });
}
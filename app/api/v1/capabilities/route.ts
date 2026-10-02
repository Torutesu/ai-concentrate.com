import { handle, service } from "../../../../lib/server/http";
import { aiConfigured } from "../../../../lib/server/ai";
export async function GET(r: Request) {
  return handle(async () => {
    await service(r);
    return {
      apiVersion: "v1",
      capabilities: {
        storage: true,
        ai: aiConfigured(),
        markdown: true,
        urlFetch: false,
        repositorySync: false,
        publishing: false,
        rendering: false,
        analytics: false,
        mcp: false,
      },
    };
  });
}

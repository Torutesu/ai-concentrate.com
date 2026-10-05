import { aiConfig, run } from "../../../../lib/server/http";
import { mcpAvailable } from "@/lib/platform/runtime";
/** Reports only what actually works in this deployment. */
export async function GET(r: Request) {
  return run(r, false, async () => {
    const providers = Object.keys(aiConfig().providers);
    return {
      apiVersion: "v1",
      capabilities: {
        storage: true,
        ai: providers.length > 0,
        markdown: true,
        urlFetch: false,
        repositorySync: false,
        publishing: false,
        rendering: false,
        analytics: false,
        mcp: mcpAvailable(),
      },
      aiProviders: providers,
    };
  });
}

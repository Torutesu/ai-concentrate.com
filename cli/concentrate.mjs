#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const [operation, inputFile] = process.argv.slice(2);
if (!operation || operation === "--help") {
  console.log(
    "Usage: node cli/concentrate.mjs <operation|tools> [input.json|-]\nSet CONCENTRATE_URL and CONCENTRATE_ACCESS_TOKEN (OAuth bearer).\nInput defaults to stdin. Results are JSON; errors use stderr.",
  );
  process.exit(0);
}
try {
  const url = new URL(
    process.env.CONCENTRATE_URL ??
      "https://ai-concentrate-studio.selectdev.chatgpt.site",
  );
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw Error("HTTPS is required.");
  const token = process.env.CONCENTRATE_ACCESS_TOKEN;
  if (!token)
    throw Error(
      "Set CONCENTRATE_ACCESS_TOKEN to an authorized OAuth access token. No token is stored by this CLI.",
    );
  let raw = "";
  if (operation !== "tools") {
    if (inputFile && inputFile !== "-") raw = await readFile(inputFile, "utf8");
    else {
      for await (const chunk of process.stdin) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 300000) throw Error("Input too large.");
      }
    }
  }
  if (Buffer.byteLength(raw) > 300000) throw Error("Input too large.");
  const message = {
    jsonrpc: "2.0",
    id: 1,
    method: operation === "tools" ? "tools/list" : "tools/call",
    params:
      operation === "tools"
        ? {}
        : { name: operation, arguments: JSON.parse(raw || "{}") },
  };
  const r = await fetch(new URL("/mcp", url), {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok)
    throw Error(`HTTP ${r.status}. Check authentication and workspace access.`);
  const data = await r.json();
  if (data.error || data.result?.isError)
    throw Error(
      data.error?.message ??
        data.result.content?.[0]?.text ??
        "Operation failed",
    );
  console.log(JSON.stringify(data.result));
} catch (e) {
  console.error(JSON.stringify({ error: e.message }));
  process.exitCode = 1;
}

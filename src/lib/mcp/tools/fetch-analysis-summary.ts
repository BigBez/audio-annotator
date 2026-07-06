import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "fetch_analysis_summary",
  title: "Fetch analysis summary",
  description:
    "Fetch an Audio Annotator analysis JSON from a public URL and return a compact summary: duration, section count, section labels with timings, and detected VCU groups.",
  inputSchema: {
    analysisUrl: z
      .string()
      .url()
      .describe("Public HTTPS URL to an analysis JSON file."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ analysisUrl }) => {
    try {
      const res = await fetch(analysisUrl);
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `Failed to fetch: HTTP ${res.status}` }],
          isError: true,
        };
      }
      const data: any = await res.json();
      const sections = Array.isArray(data?.sections) ? data.sections : [];
      const vcus = Array.isArray(data?.vcus) ? data.vcus : [];
      const summary = {
        version: data?.version ?? null,
        duration: data?.duration ?? null,
        sectionCount: sections.length,
        sections: sections.map((s: any) => ({
          id: s.id,
          label: s.label ?? "",
          start: s.start,
          end: s.end,
          bars: s.bars ?? null,
        })),
        vcuCount: vcus.length,
        vcus: vcus.map((v: any) => ({
          label: v.label ?? "",
          sectionIds: v.sectionIds ?? [],
        })),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        structuredContent: summary,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
});

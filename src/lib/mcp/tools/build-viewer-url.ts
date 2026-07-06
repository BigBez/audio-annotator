import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const APP_URL = "https://audio-annotation.lovable.app";

export default defineTool({
  name: "build_viewer_url",
  title: "Build read-only viewer URL",
  description:
    "Build a shareable read-only Audio Annotator URL that opens an audio file with a prebuilt analysis JSON. The generated URL opens the app in read-only mode.",
  inputSchema: {
    audioUrl: z
      .string()
      .url()
      .describe("Public HTTPS URL to an audio file (mp3, wav, etc.)."),
    analysisUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional public HTTPS URL to an analysis JSON file."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ audioUrl, analysisUrl }) => {
    const params = new URLSearchParams();
    params.set("audio", audioUrl);
    if (analysisUrl) params.set("analysis", analysisUrl);
    const url = `${APP_URL}/?${params.toString()}`;
    return {
      content: [{ type: "text", text: url }],
      structuredContent: { url },
    };
  },
});

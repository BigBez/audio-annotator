import { defineTool } from "@lovable.dev/mcp-js";

const DEMO_AUDIO =
  "https://raw.githubusercontent.com/BigBez/audio-annotator/main/public/Analyses/beautiful-mistakes.mp3";
const DEMO_ANALYSIS =
  "https://raw.githubusercontent.com/BigBez/audio-annotator/main/public/Analyses/beautiful-mistakes.json";

export default defineTool({
  name: "get_demo",
  title: "Get demo analysis links",
  description:
    "Return the built-in demo audio URL, demo analysis JSON URL, and a ready-to-open read-only viewer URL for the bundled 'Beautiful Mistakes' example.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const viewerUrl = `https://audio-annotation.lovable.app/?audio=${encodeURIComponent(
      DEMO_AUDIO,
    )}&analysis=${encodeURIComponent(DEMO_ANALYSIS)}`;
    const payload = {
      audioUrl: DEMO_AUDIO,
      analysisUrl: DEMO_ANALYSIS,
      viewerUrl,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

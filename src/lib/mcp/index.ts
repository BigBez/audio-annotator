import { defineMcp } from "@lovable.dev/mcp-js";
import buildViewerUrl from "./tools/build-viewer-url";
import fetchAnalysisSummary from "./tools/fetch-analysis-summary";
import getDemo from "./tools/get-demo";

export default defineMcp({
  name: "audio-annotator-mcp",
  title: "Audio Annotator",
  version: "0.1.0",
  instructions:
    "Tools for the Audio Annotator app — a formal music-analysis viewer. Use `get_demo` for a built-in example, `build_viewer_url` to construct a shareable read-only viewer link from an audio URL (and optional analysis JSON URL), and `fetch_analysis_summary` to inspect an analysis JSON's sections and VCU groups.",
  tools: [getDemo, buildViewerUrl, fetchAnalysisSummary],
});

import { createSessionArchive } from "@/agent/session/archive";
import { createTool } from "@/agent/tools/registry";

export function createSearchSessionArchiveTool(file) {
  return createTool(
    "search_session_archive",
    "Search archived conversation messages when older exact context is needed. Use this after reading the summary if exact wording, previous decisions, or old tool output matters.",
    {
      type: "object",
      required: ["query"],
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        maxResults: { type: "number" },
      },
    },
    function(args) {
      let archive = createSessionArchive(file);
      return {
        archiveDatabase: file,
        query: args.query,
        results: archive.search({
          query: args.query,
          maxResults: args.maxResults || 8,
        }),
      };
    }
  );
}

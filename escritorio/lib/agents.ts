import fs from "fs";
import path from "path";

export interface AgentConfig {
  id: string;
  model: string;
  models?: Record<string, string>;
  promptFile?: string;
}

const AGENTS: AgentConfig[] = [
  {
    id: "margarita",
    model: "claude-haiku-4-5-20251001",
    promptFile: "data/margarita/prompts/margarita.md",
    models: {
      content: "claude-sonnet-4-6",
      strategy: "claude-sonnet-4-6",
      crm: "claude-sonnet-4-6",
    },
  },
  {
    id: "jordan",
    model: "claude-haiku-4-5-20251001",
    promptFile: "data/jordan/prompts/jordan.md",
  },
  {
    id: "manu-dev",
    model: "claude-sonnet-4-6",
    promptFile: "data/manu-dev/prompts/manu-dev.md",
    models: {
      content: "claude-haiku-4-5-20251001",
      "create-site": "claude-opus-4-7",
    },
  },
  {
    id: "nubia",
    model: "claude-sonnet-4-20250514",
    promptFile: "data/nubia/prompts/nubia.md",
    models: {
      haiku: "claude-haiku-4-5-20251001",
    },
  },
  {
    id: "forge",
    model: "claude-sonnet-4-20250514",
    promptFile: "data/forge/prompts/forge.md",
  },
];

export function getAgent(id: string): AgentConfig | null {
  return AGENTS.find((a) => a.id === id) ?? null;
}

export function loadSystemPrompt(id: string): string {
  const agent = getAgent(id);
  if (!agent || !agent.promptFile) throw new Error(`Agent or promptFile not found: ${id}`);
  const promptPath = path.join(process.cwd(), agent.promptFile);
  return fs.readFileSync(promptPath, "utf-8");
}

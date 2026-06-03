// Shared domain types for the MentorIA feature. Consumed by the page component
// and all three mentoria hooks (session / history / progress).

import type React from "react";

export type Step = "dashboard" | "history" | "chat" | "neville-select";

export interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  options?: string[];
  timestamp: Date;
}

export interface StoredMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  options?: string[];
  timestamp: string;
}

export interface SessionMeta {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

export interface ToolDef {
  id: string;
  title: string;
  description: string;
  Icon: React.ElementType;
  initialContent: string;
  initialOptions: string[];
  provider: "anthropic" | "venice" | "nvidia_nim";
}

/** Agent summary as returned by /api/mentoria/agents. */
export interface AgentSummary {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  icon: string;
  provider: "anthropic" | "venice" | "nvidia_nim";
  requiresConfirmation?: boolean;
  disclaimer?: string;
  totalLessons: number;
  welcome: { content: string; options: string[] };
}

export type SearchHit = {
  sessionId: string;
  tool: string;
  title: string;
  updatedAt: string;
  role: string;
  snippet: string;
  seq: number;
};

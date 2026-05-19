export type AttachmentType = "image" | "video" | "doc";

export type ChatAttachment = {
  id: string;
  type: AttachmentType;
  title: string;
  url: string;
};

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
  attachments?: ChatAttachment[];
};

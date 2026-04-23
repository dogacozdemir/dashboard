export type ChatRole = 'user' | 'assistant';

export interface AiMessage {
  id: string;
  role: ChatRole;
  content: string;
  tokensUsed?: number;
  createdAt: string;
}

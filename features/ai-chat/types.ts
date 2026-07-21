import type { ProposedAction } from './actions/proposedActions';

export type ChatRole = 'user' | 'assistant';

export interface AiMessage {
  id: string;
  role: ChatRole;
  content: string;
  tokensUsed?: number;
  createdAt: string;
  /** Write actions MonoAI suggested; they run only once the user confirms. */
  proposedActions?: ProposedAction[];
}

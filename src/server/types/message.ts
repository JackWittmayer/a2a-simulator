export interface Message {
  id: string;
  from: string;
  to: string;
  prompt: string;
  timestamp: string;
  replyTo?: string;
  replyToContent?: string;
}

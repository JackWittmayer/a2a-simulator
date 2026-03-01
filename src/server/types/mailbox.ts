import { Message } from "./message";

export interface Mailbox {
  name: string;
  messages: Message[];
}

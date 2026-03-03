import { Mailbox } from "./types/mailbox";
import { Message } from "./types/message";

export const agents = new Map<string, Mailbox>();
export const ipToAgent = new Map<string, string>();
export const messageLog: Message[] = [];
export const cursors = new Map<string, number>();

export function getOrCreateMailbox(name: string): Mailbox {
  let mailbox = agents.get(name);
  if (!mailbox) {
    mailbox = { name, status: "idle", statusUpdatedAt: new Date().toISOString() };
    agents.set(name, mailbox);
    cursors.set(name, 0);
  }
  return mailbox;
}

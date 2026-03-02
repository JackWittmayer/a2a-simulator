import { Mailbox } from "./types/mailbox";

export const agents = new Map<string, Mailbox>();
export const ipToAgent = new Map<string, string>();

export function getOrCreateMailbox(name: string): Mailbox {
  let mailbox = agents.get(name);
  if (!mailbox) {
    mailbox = { name, messages: [] };
    agents.set(name, mailbox);
  }
  return mailbox;
}

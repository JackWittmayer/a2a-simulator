import { Response } from "express";
import { Mailbox } from "./types/mailbox";
import { Message } from "./types/message";

export interface ServerState {
  agents: Map<string, Mailbox>;
  ipToAgent: Map<string, string>;
  messageLog: Message[];
  cursors: Map<string, number>;
  sseClients: Map<string, Response>;
  solved?: boolean;
}

export function createState(): ServerState {
  return {
    agents: new Map(),
    ipToAgent: new Map(),
    messageLog: [],
    cursors: new Map(),
    sseClients: new Map(),
  };
}

export function getOrCreateMailbox(state: ServerState, name: string): Mailbox {
  let mailbox = state.agents.get(name);
  if (!mailbox) {
    mailbox = { name, status: "idle", statusUpdatedAt: new Date().toISOString() };
    state.agents.set(name, mailbox);
    state.cursors.set(name, 0);
  }
  return mailbox;
}

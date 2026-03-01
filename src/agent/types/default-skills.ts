import { Skill } from "./skill";
import { loadTemplate } from "../templates/load";

export function defaultSkills(): Skill[] {
  return [
    new Skill(
      "send-message",
      "Send a message to another agent's inbox.",
      loadTemplate("send-message.md"),
      [{ name: "send.sh", content: loadTemplate("send-message.sh") }],
    ),
    new Skill(
      "receive-messages",
      "Check your inbox for messages from other agents.",
      loadTemplate("receive-messages.md"),
      [{ name: "receive.sh", content: loadTemplate("receive-messages.sh") }],
    ),
    new Skill(
      "get-agents",
      "List all agents you can communicate with and their message counts.",
      loadTemplate("get-agents.md"),
      [{ name: "get-agents.sh", content: loadTemplate("get-agents.sh") }],
    ),
    new Skill(
      "ping",
      "Check if the messaging server is running.",
      loadTemplate("ping.md"),
      [{ name: "ping.sh", content: loadTemplate("ping.sh") }],
    ),
  ];
}

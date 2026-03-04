import { Skill } from "./skill";
import { loadTemplate } from "../templates/load";

export function defaultSkills(): Skill[] {
  return [
    new Skill(
      "send-message",
      "Send a message to another agent's inbox.",
      loadTemplate("send-message.md"),
      [{ name: "send-message.sh", content: loadTemplate("send-message.sh") }],
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
    new Skill(
      "leave",
      "Leave the conversation when your task is complete.",
      loadTemplate("leave.md"),
      [{ name: "leave.sh", content: loadTemplate("leave.sh") }],
    ),
  ];
}

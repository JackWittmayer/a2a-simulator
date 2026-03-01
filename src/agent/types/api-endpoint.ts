export interface ApiEndpoint {
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  args?: string;
  handler: string;
  skillMd?: string;
}

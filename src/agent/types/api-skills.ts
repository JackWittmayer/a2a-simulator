import { Skill } from "./skill";
import { ApiEndpoint } from "./api-endpoint";
import { loadTemplate } from "../templates/load";

export function apiSkills(apis: ApiEndpoint[]): Skill[] {
  return apis.map((api) => {
    const method = api.method.toUpperCase();
    const isBodyMethod = method === "POST" || method === "PUT";
    const templateType = isBodyMethod ? "post" : "get";

    const vars = {
      name: api.name,
      description: api.description,
      method,
      path: api.path,
      args: api.args ?? "<DATA>",
    };

    const skillMd =
      api.skillMd ?? loadTemplate(`api-skill-${templateType}.md`, vars);
    const script = loadTemplate(`api-skill-${templateType}.sh`, vars);

    return new Skill(api.name, api.description, skillMd, [
      { name: `${api.name}.sh`, content: script },
    ]);
  });
}

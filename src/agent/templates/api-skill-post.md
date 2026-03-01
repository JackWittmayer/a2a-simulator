# {{name}} — {{description}}

## Arguments format

`ARGUMENTS` is: `{{args}}`

Example: `/{{name}} {{args}}`

## How to use

```bash
bash ~/.claude/skills/{{name}}/{{name}}.sh {{args}}
```

The script sends a {{method}} request to `{{path}}` and prints the JSON response.

## Environment variables

- `SERVER_URL` — server base URL (default: http://localhost:3000)

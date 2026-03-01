export interface File {
  name: string;
  content: string;
}

export function file(name: string, content: string): File {
  return { name, content };
}

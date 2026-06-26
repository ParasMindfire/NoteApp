type TipTapNode = {
  type?: string;
  text?: string;
  content?: TipTapNode[];
};

function collectText(node: TipTapNode, parts: string[]): void {
  if (node.type === 'text' && typeof node.text === 'string') {
    parts.push(node.text);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectText(child, parts);
    }
  }
}

export function extractText(doc: unknown): string {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return '';
  const parts: string[] = [];
  collectText(doc as TipTapNode, parts);
  return parts.join(' ').trim();
}

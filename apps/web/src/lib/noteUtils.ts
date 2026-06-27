interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

export function extractPlainText(json: unknown, maxLength = 100): string {
  if (!json || typeof json !== 'object') return '';

  const parts: string[] = [];

  function walk(node: TipTapNode) {
    if (node.text) {
      parts.push(node.text);
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child);
        if (parts.join('').length >= maxLength) break;
      }
    }
  }

  walk(json as TipTapNode);
  return parts.join('').slice(0, maxLength);
}

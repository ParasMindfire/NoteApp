type TipTapNode = {
  type?: string;
  text?: string;
  content?: TipTapNode[];
};

export function extractTextFromTipTap(json: Record<string, unknown>): string {
  const parts: string[] = [];

  function walk(node: TipTapNode) {
    if (node.text) {
      parts.push(node.text);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(json as TipTapNode);
  return parts.join(' ');
}

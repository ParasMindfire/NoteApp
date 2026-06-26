import { PrismaClient } from '@prisma/client';
import { extractText } from './tiptap.js';

export const prisma = new PrismaClient().$extends({
  query: {
    note: {
      create({ args, query }) {
        if (args.data.body !== undefined) {
          (args.data as Record<string, unknown>).bodyText = extractText(args.data.body);
        }
        return query(args);
      },
      update({ args, query }) {
        const data = args.data as Record<string, unknown>;
        if (data['body'] !== undefined) {
          data['bodyText'] = extractText(data['body']);
        }
        return query(args);
      },
    },
  },
});

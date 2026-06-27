import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { authRouter } from './routes/auth/index.js';
import notesRouter from './routes/notes.js';
import tagsRouter from './routes/tags.js';
import searchRouter from './routes/search.js';
import sharesRouter from './routes/shares.js';
import versionsRouter from './routes/versions.js';
import publicRouter from './routes/public.js';
import { errorHandler } from './middleware/errorHandler.js';
import { versionPurgeCron } from './lib/purge.js';

const app = express();

app.use(cors({
  origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/notes', notesRouter);
app.use('/notes', sharesRouter);
app.use('/notes', versionsRouter);
app.use('/tags', tagsRouter);
app.use('/search', searchRouter);
app.use('/public', publicRouter);

app.use(errorHandler);

const PORT = process.env['PORT'] ?? 3000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
  versionPurgeCron.start();
});

export default app;

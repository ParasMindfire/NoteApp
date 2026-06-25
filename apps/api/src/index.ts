import express from 'express';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { authRouter } from './routes/auth/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRouter);

app.use(errorHandler);

const PORT = process.env['PORT'] ?? 3000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});

export default app;

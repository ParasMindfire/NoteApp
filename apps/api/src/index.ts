import express from 'express'
import 'dotenv/config'

const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

const PORT = process.env['PORT'] ?? 3000

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`)
})

export default app

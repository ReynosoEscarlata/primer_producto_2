import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { authRoutes } from './routes/auth.js';
import { patientRoutes } from './routes/patients.js';
import { nutritionistRoutes } from './routes/nutritionists.js';

export async function buildApp() {
  const app = Fastify({ logger: true });
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

  await app.register(cors, {
    origin: webOrigin,
    credentials: true,
  });

  await app.register(cookie);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes);
  await app.register(patientRoutes);
  await app.register(nutritionistRoutes);

  return app;
}

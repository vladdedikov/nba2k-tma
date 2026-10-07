import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load env from root
dotenv.config({ path: '../.env' });

const prisma = new PrismaClient();
const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: true,
});

fastify.get('/', async (request, reply) => {
  return { hello: 'NBA2K TMA API' };
});

fastify.get('/teams', async (request, reply) => {
  const teams = await prisma.team.findMany({ 
    include: { 
      players: true, 
      owner: true,
      current_picks: true,
      original_picks: true
    } 
  });
  // Map snake_case from DB to camelCase if frontend expects it, or just return as is
  return teams;
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

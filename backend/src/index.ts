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

// Role check middleware/helper
const checkAdmin = (request: any, reply: any) => {
  const role = request.headers['x-user-role'];
  if (role !== 'ADMIN') {
    reply.status(403).send({ error: 'Access denied: Admin only' });
    return false;
  }
  return true;
};

fastify.get('/league/settings', async (request, reply) => {
  let settings = await prisma.leagueSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.leagueSettings.create({
      data: {
        id: 1, soft_cap: 140000000, luxury_tax: 170000000, first_apron: 178000000, second_apron: 189000000, hard_cap: 200000000
      }
    });
  }
  return settings;
});

fastify.patch('/admin/league/settings', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const data = request.body as any;
  const settings = await prisma.leagueSettings.update({
    where: { id: 1 },
    data: {
      soft_cap: data.soft_cap ? parseFloat(data.soft_cap) : undefined,
      luxury_tax: data.luxury_tax ? parseFloat(data.luxury_tax) : undefined,
      first_apron: data.first_apron ? parseFloat(data.first_apron) : undefined,
      second_apron: data.second_apron ? parseFloat(data.second_apron) : undefined,
      hard_cap: data.hard_cap ? parseFloat(data.hard_cap) : undefined,
    }
  });
  return settings;
});

fastify.post('/admin/players', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const data = request.body as any;
  const salaries = data.salaries ? data.salaries.map(Number) : [parseFloat(data.salary)];
  const player = await prisma.player.create({
    data: {
      name: data.name,
      position: data.position,
      overall_rating: parseInt(data.overall_rating),
      salary: salaries[0],
      salaries: salaries,
      contract_years_left: salaries.length,
      option_type: data.option_type || 'NONE',
      team_id: data.team_id,
    }
  });
  return player;
});

fastify.patch('/admin/players/:id', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { id } = request.params as any;
  const data = request.body as any;
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.overall_rating !== undefined) updateData.overall_rating = parseInt(data.overall_rating);
  
  if (data.salaries !== undefined) {
    updateData.salaries = data.salaries.map(Number);
    updateData.salary = updateData.salaries[0];
    updateData.contract_years_left = updateData.salaries.length;
  }
  
  if (data.option_type !== undefined) updateData.option_type = data.option_type;
  if (data.team_id !== undefined) updateData.team_id = data.team_id;

  const player = await prisma.player.update({
    where: { id },
    data: updateData,
  });
  return player;
});

fastify.delete('/admin/players/:id', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { id } = request.params as any;
  await prisma.player.delete({
    where: { id }
  });
  return { success: true };
});

fastify.post('/admin/players/:id/transfer', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { id } = request.params as any;
  const { target_team_id } = request.body as any;
  const player = await prisma.player.update({
    where: { id },
    data: { team_id: target_team_id }
  });
  return player;
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

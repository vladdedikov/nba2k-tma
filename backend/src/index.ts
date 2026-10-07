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

// Trades API
fastify.get('/trades', async (request, reply) => {
  const trades = await prisma.tradeOffer.findMany({
    orderBy: { created_at: 'desc' },
    include: { sender_team: true, receiver_team: true }
  });
  return trades;
});

fastify.post('/trades/offer', async (request, reply) => {
  const data = request.body as any;
  // TODO: we assume frontend did validation, but backend should too. For brevity, creating the offer.
  const offer = await prisma.tradeOffer.create({
    data: {
      sender_team_id: data.sender_team_id,
      receiver_team_id: data.receiver_team_id,
      sent_player_ids: data.sent_player_ids || [],
      received_player_ids: data.received_player_ids || [],
      sent_pick_ids: data.sent_pick_ids || [],
      received_pick_ids: data.received_pick_ids || [],
      message: data.message,
      status: 'PENDING'
    }
  });
  return offer;
});

fastify.post('/trades/:id/respond', async (request, reply) => {
  const { id } = request.params as any;
  const { action } = request.body as any; // 'ACCEPT' | 'REJECT'
  
  const trade = await prisma.tradeOffer.findUnique({
    where: { id },
    include: { sender_team: true, receiver_team: true }
  });
  if (!trade) return reply.status(404).send({ error: 'Trade not found' });
  if (trade.status !== 'PENDING') return reply.status(400).send({ error: 'Trade is not pending' });

  if (action === 'REJECT') {
    return await prisma.tradeOffer.update({ where: { id }, data: { status: 'REJECTED' } });
  }

  if (action === 'ACCEPT') {
    const sentPlayers = await prisma.player.findMany({ where: { id: { in: trade.sent_player_ids } } });
    const recPlayers = await prisma.player.findMany({ where: { id: { in: trade.received_player_ids } } });

    await prisma.$transaction([
      ...trade.sent_player_ids.map(pid => prisma.player.update({ where: { id: pid }, data: { team_id: trade.receiver_team_id } })),
      ...trade.received_player_ids.map(pid => prisma.player.update({ where: { id: pid }, data: { team_id: trade.sender_team_id } })),
      ...trade.sent_pick_ids.map(pid => prisma.draftPick.update({ where: { id: pid }, data: { current_team_id: trade.receiver_team_id } })),
      ...trade.received_pick_ids.map(pid => prisma.draftPick.update({ where: { id: pid }, data: { current_team_id: trade.sender_team_id } })),
      prisma.tradeOffer.update({ where: { id }, data: { status: 'ACCEPTED' } }),
      prisma.insiderPost.create({
        data: {
          content: `⚡️ СДЕЛКА СОСТОЯЛАСЬ! ${trade.sender_team.name} и ${trade.receiver_team.name} завершили обмен:\nУшли из ${trade.sender_team.name}: ${sentPlayers.map(p => p.name).join(', ') || 'Пики'}\nУшли из ${trade.receiver_team.name}: ${recPlayers.map(p => p.name).join(', ') || 'Пики'}.`,
        }
      })
    ]);
    return { success: true, status: 'ACCEPTED' };
  }
});

// Insider Feed API
fastify.get('/feed', async (request, reply) => {
  return await prisma.insiderPost.findMany({ orderBy: { created_at: 'desc' }, include: { team: true, author: true } });
});

// Offseason & Stage API
fastify.patch('/admin/league/stage', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { stage } = request.body as any;
  await prisma.leagueSettings.update({ where: { id: 1 }, data: { current_stage: stage } });
  return { success: true };
});

fastify.get('/offseason/options', async (request, reply) => {
  return await prisma.player.findMany({
    where: { option_type: { in: ['PLAYER_OPTION', 'TEAM_OPTION'] } },
    include: { team: true }
  });
});

fastify.post('/offseason/options/:id/resolve', async (request, reply) => {
  const { id } = request.params as any;
  const { decision } = request.body as any;
  const role = request.headers['x-user-role'];
  
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) return reply.status(404).send({ error: 'Player not found' });
  
  if (player.option_type === 'PLAYER_OPTION' && role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Only admin can resolve player options' });
  }

  if (decision === 'ACCEPT') {
    await prisma.player.update({ where: { id }, data: { option_type: 'NONE' } });
  } else if (decision === 'DECLINE') {
    await prisma.player.update({
      where: { id },
      data: { previous_team_id: player.team_id, team_id: null, option_type: 'NONE' }
    });
  }
  return { success: true };
});

fastify.post('/admin/season/advance-year', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  
  const players = await prisma.player.findMany();
  const updates = players.map(p => {
    const newSalaries = p.salaries.slice(1);
    const newYearsLeft = p.contract_years_left - 1;
    if (newYearsLeft <= 0 || newSalaries.length === 0) {
      return prisma.player.update({
        where: { id: p.id },
        data: { team_id: null, previous_team_id: p.team_id, option_type: 'NONE', contract_years_left: 0, salaries: [], salary: 0 }
      });
    } else {
      return prisma.player.update({
        where: { id: p.id },
        data: { salaries: newSalaries, salary: newSalaries[0], contract_years_left: newYearsLeft }
      });
    }
  });

  await prisma.$transaction([
    ...updates,
    prisma.draftPick.updateMany({ data: { year: { decrement: 1 } } }),
    prisma.insiderPost.create({ data: { content: '🚨 СТАРТ НОВОГО СЕЗОНА! Контракты сдвинуты на 1 год. Игроки с истекшими контрактами стали свободными агентами.' } }),
    prisma.leagueSettings.update({ where: { id: 1 }, data: { current_stage: 'REGULAR_SEASON' } })
  ]);
  
  return { success: true };
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

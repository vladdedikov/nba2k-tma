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
      draft_picks: true
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
      min_salary_schedule: data.min_salary_schedule,
      tax_mle_schedule: data.tax_mle_schedule,
      full_mle_schedule: data.full_mle_schedule,
      rookie_max_schedule: data.rookie_max_schedule,
      medium_max_schedule: data.medium_max_schedule,
      veteran_max_schedule: data.veteran_max_schedule,
      supermax_schedule: data.supermax_schedule,
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
const checkTradesAllowed = async (reply: any, playerIds: string[] = []) => {
  const settings = await prisma.leagueSettings.findUnique({ where: { id: 1 } });
  if (settings?.current_stage === 'TRADE_DEADLINE') {
    reply.status(400).send({ error: 'Дедлайн наступил! Обмены закрыты на время плей-офф' });
    return false;
  }
  if (playerIds.length > 0) {
    const restricted = await prisma.player.findFirst({
      where: { id: { in: playerIds }, is_trade_restricted: true }
    });
    if (restricted) {
      reply.status(400).send({ error: `Игрок ${restricted.name} недавно подписал контракт/задрафтован и не может быть обменян до снятия ограничений.` });
      return false;
    }
  }
  return true;
};

fastify.get('/trades', async (request, reply) => {
  const trades = await prisma.tradeOffer.findMany({
    orderBy: { created_at: 'desc' },
    include: { sender_team: true, receiver_team: true }
  });
  return trades;
});

fastify.post('/trades/offer', async (request, reply) => {
  const data = request.body as any;
  const playerIds = [...(data.sent_player_ids || []), ...(data.received_player_ids || [])];
  if (!(await checkTradesAllowed(reply, playerIds))) return;
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
    const playerIds = [...trade.sent_player_ids, ...trade.received_player_ids];
    if (!(await checkTradesAllowed(reply, playerIds))) return;
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
  if (stage === 'TRADE_RESTRICTIONS_LIFTED') {
    await prisma.player.updateMany({ where: { is_trade_restricted: true }, data: { is_trade_restricted: false } });
  }
  await prisma.leagueSettings.update({ where: { id: 1 }, data: { current_stage: stage } });
  return { success: true };
});

fastify.post('/admin/season/advance', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;

  const players = await prisma.player.findMany({ where: { team_id: { not: null } } });
  const updates = players.map(p => {
    let newSalaries = [...p.salaries];
    let newLeft = p.contract_years_left;
    if (newLeft > 0) {
      newSalaries = newSalaries.slice(1);
      newLeft -= 1;
    }
    return prisma.player.update({
      where: { id: p.id },
      data: {
        salaries: newSalaries,
        contract_years_left: newLeft,
        salary: newSalaries[0] || 0,
        team_id: newLeft <= 0 ? null : p.team_id,
        previous_team_id: newLeft <= 0 ? p.team_id : p.previous_team_id
      }
    });
  });
  
  await prisma.$transaction([
    ...updates,
    prisma.draftPick.updateMany({
      where: { year: { gt: new Date().getFullYear() - 5 } },
      data: { year: { decrement: 1 } }
    }),
    prisma.faBlock.deleteMany(),
    prisma.player.updateMany({ data: { fa_block_id: null } }),
    prisma.leagueSettings.update({
      where: { id: 1 },
      data: {
        current_stage: 'DRAFT',
        current_block_number: 1,
        approved_fa_blocks: [],
        completed_fa_blocks: [],
        current_block_deadline: null
      }
    })
  ]);

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

// Draft API
fastify.get('/draft/board', async (request, reply) => {
  const settings = await prisma.leagueSettings.findUnique({ where: { id: 1 } });
  const currentYear = new Date().getFullYear();
  const picks = await prisma.draftPick.findMany({
    where: { year: currentYear },
    orderBy: { id: 'asc' },
    include: { team: true }
  });
  return { picks, settings };
});

fastify.get('/draft/prospects', async (request, reply) => {
  return await prisma.player.findMany({ where: { is_prospect: true, team_id: null }, orderBy: { overall_rating: 'desc' } });
});

fastify.post('/admin/draft/prospects', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { name, position, overall_rating } = request.body as any;
  await prisma.player.create({
    data: {
      name, position, overall_rating: parseInt(overall_rating, 10),
      salary: 0, salaries: [], contract_years_left: 0, option_type: 'NONE',
      is_prospect: true, is_trade_restricted: true, team_id: null
    }
  });
  return { success: true };
});

fastify.delete('/admin/draft/prospects/:id', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { id } = request.params as any;
  await prisma.player.delete({ where: { id } });
  return { success: true };
});

fastify.post('/admin/draft-picks', async (request, reply) => {
  try {
    if (!checkAdmin(request, reply)) return;
    const { team_id, year, name } = request.body as any;
    
    const parsedTeamId = String(team_id || '').trim();
    const parsedYear = Number(year);
    const parsedName = String(name || '').trim();
    
    if (!parsedTeamId || !parsedYear || !parsedName) {
      return reply.status(400).send({ error: "Заполните год и название пика" });
    }
    
    const pick = await prisma.draftPick.create({
      data: {
        team_id: parsedTeamId,
        year: parsedYear,
        name: parsedName,
      }
    });
    return reply.status(201).send({ success: true, pick });
  } catch (error) {
    console.error('Draft pick creation error:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

fastify.delete('/admin/draft-picks/:id', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { id } = request.params as any;
  await prisma.draftPick.delete({ where: { id: Number(id) } });
  return { success: true };
});

fastify.patch('/admin/draft/setup', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { picks } = request.body as any; 
  
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < picks.length; i++) {
      const currentTeamId = picks[i].current_team_id || picks[i].team_id;
      if (currentTeamId) {
        await tx.draftPick.update({
          where: { id: picks[i].id },
          data: { team_id: currentTeamId }
        });
      }
    }
    await tx.leagueSettings.update({
      where: { id: 1 },
      data: { draft_order_approved: true, current_draft_pick_index: 0, draft_is_completed: false }
    });
  });
  return { success: true };
});

fastify.post('/draft/pick', async (request, reply) => {
  const { pick_id, player_id } = request.body as any;
  
  const pick = await prisma.draftPick.findUnique({ where: { id: parseInt(pick_id, 10) } });
  const player = await prisma.player.findUnique({ where: { id: player_id } });
  const settings = await prisma.leagueSettings.findUnique({ where: { id: 1 } });
  
  if (!pick || !player || !settings) return reply.status(400).send({ error: 'Not found' });
  
  await prisma.player.update({
    where: { id: player_id },
    data: {
      team_id: pick.team_id,
      is_prospect: false,
      is_trade_restricted: true,
      salary: 6000000,
      salaries: [6000000, 6500000, 7000000],
      contract_years_left: 3,
      option_type: 'TEAM_OPTION'
    }
  });
  
  await prisma.draftPick.update({
    where: { id: pick.id },
    data: { is_used: true }
  });
  
  const nextIndex = settings.current_draft_pick_index + 1;
  await prisma.leagueSettings.update({
    where: { id: 1 },
    data: { 
      current_draft_pick_index: nextIndex,
      draft_is_completed: nextIndex >= 4 
    }
  });
  
  return { success: true };
});

// Free Agency API
fastify.get('/free-agency/players', async (request, reply) => {
  return await prisma.player.findMany({
    where: { team_id: null, is_prospect: false },
    include: { contract_offers: { include: { team: true }, orderBy: { annual_salary: 'desc' } }, team: true }
  });
});

fastify.get('/admin/free-agency/unassigned-players', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  return await prisma.player.findMany({
    where: { team_id: null, is_prospect: false, fa_block_id: null },
    orderBy: { overall_rating: 'desc' }
  });
});

fastify.post('/admin/free-agency/blocks', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const block = await prisma.$transaction(async (tx) => {
    const count = await tx.faBlock.count();
    return await tx.faBlock.create({
      data: { number: count + 1 }
    });
  });
  return block;
});

fastify.delete('/admin/free-agency/blocks/:blockId', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { blockId } = request.params as any;
  const id = parseInt(blockId);
  
  const updatedBlocks = await prisma.$transaction(async (tx) => {
    // 1. Unassign players
    await tx.player.updateMany({
      where: { fa_block_id: id },
      data: { fa_block_id: null }
    });
    // 2. Delete block
    await tx.faBlock.deleteMany({ where: { id } });
    
    // 3. Renumber remaining
    const remaining = await tx.faBlock.findMany({ orderBy: { number: 'asc' } });
    for (let i = 0; i < remaining.length; i++) {
      await tx.faBlock.update({
        where: { id: remaining[i].id },
        data: { number: i + 1 }
      });
    }
    return await tx.faBlock.findMany({ orderBy: { number: 'asc' } });
  });
  return updatedBlocks;
});

fastify.post('/admin/free-agency/blocks/:blockId/add-player', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { blockId } = request.params as any;
  const { player_id } = request.body as any;
  await prisma.player.update({
    where: { id: player_id },
    data: { fa_block_id: parseInt(blockId) }
  });
  return { success: true };
});

fastify.post('/admin/free-agency/blocks/:blockId/remove-player', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { player_id } = request.body as any;
  await prisma.player.update({
    where: { id: player_id },
    data: { fa_block_id: null }
  });
  return { success: true };
});

fastify.post('/admin/free-agency/blocks/:blockId/start', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { blockId } = request.params as any;
  const { days = 0, minutes = 30 } = request.body as any;
  
  const block = await prisma.faBlock.findUnique({ where: { id: parseInt(blockId) } });
  if (!block) return reply.status(404).send({ error: 'Block not found' });

  const durationMs = (days * 1440 + minutes) * 60000;
  const deadline = new Date(Date.now() + durationMs);
  
  await prisma.faBlock.update({
    where: { id: parseInt(blockId) },
    data: { status: 'ACTIVE', deadline }
  });

  const settings = await prisma.leagueSettings.findUnique({ where: { id: 1 } });
  const newApproved = [...(settings?.approved_fa_blocks || []), block.number];
  
  await prisma.leagueSettings.update({
    where: { id: 1 },
    data: {
      approved_fa_blocks: newApproved,
      current_block_number: block.number,
      current_block_deadline: deadline
    }
  });
  
  return { success: true };
});

fastify.get('/free-agency/blocks', async (request, reply) => {
  const role = request.headers['x-user-role'];
  const blocks = await prisma.faBlock.findMany({ orderBy: { number: 'asc' } });
  
  if (role === 'ADMIN') {
    return blocks.map(b => ({
      ...b,
      is_approved: b.status !== 'PENDING',
      is_active: b.status === 'ACTIVE',
      is_completed: b.status === 'COMPLETED'
    }));
  } else {
    return blocks.filter(b => b.status !== 'PENDING').map(b => ({
      ...b,
      is_approved: true,
      is_active: b.status === 'ACTIVE',
      is_completed: b.status === 'COMPLETED'
    }));
  }
});

fastify.get('/free-agency/blocks/:blockId', async (request, reply) => {
  const { blockId } = request.params as any;
  
  const players = await prisma.player.findMany({
    where: { fa_block_id: parseInt(blockId) },
    orderBy: { overall_rating: 'desc' },
    include: { contract_offers: { include: { team: true } }, team: true }
  });
  
  const playersWithSortedOffers = players.map(p => {
    const offers = p.contract_offers.sort((a, b) => {
      const totalA = a.salaries.length > 0 ? a.salaries.reduce((acc, v) => acc + v, 0) : a.annual_salary * a.years;
      const totalB = b.salaries.length > 0 ? b.salaries.reduce((acc, v) => acc + v, 0) : b.annual_salary * b.years;
      return totalB - totalA;
    });
    return { ...p, contract_offers: offers };
  });

  return playersWithSortedOffers;
});

fastify.post('/admin/free-agency/blocks/:blockId/finalize', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { blockId } = request.params as any;
  
  const block = await prisma.faBlock.findUnique({ where: { id: parseInt(blockId) } });
  if (!block) return reply.status(404).send({ error: 'Block not found' });

  const players = await prisma.player.findMany({
    where: { fa_block_id: parseInt(blockId) },
    include: { contract_offers: { include: { team: true } } }
  });
  
  const summaries: string[] = [];
  
  await prisma.$transaction(async (tx) => {
    for (const player of players) {
      if (player.contract_offers.length === 0) continue;
      
      const bestOffer = player.contract_offers.sort((a, b) => {
        const totalA = a.salaries.length > 0 ? a.salaries.reduce((acc, v) => acc + v, 0) : a.annual_salary * a.years;
        const totalB = b.salaries.length > 0 ? b.salaries.reduce((acc, v) => acc + v, 0) : b.annual_salary * b.years;
        return totalB - totalA;
      })[0];
      
      const salaries = bestOffer.salaries.length > 0 ? bestOffer.salaries : Array(bestOffer.years).fill(bestOffer.annual_salary);
      const totalMoney = salaries.reduce((a, b) => a + b, 0);

      await tx.contractOffer.update({ where: { id: bestOffer.id }, data: { status: 'ACCEPTED' } });
      await tx.player.update({
        where: { id: player.id },
        data: {
          team_id: bestOffer.team_id,
          salary: salaries[0],
          salaries,
          contract_years_left: bestOffer.years,
          is_rfa: false,
          is_trade_restricted: true,
          previous_team_id: null
        }
      });
      await tx.contractOffer.updateMany({
        where: { player_id: player.id, id: { not: bestOffer.id } },
        data: { status: 'DECLINED' }
      });
      
      summaries.push(`- ${player.name} в ${bestOffer.team.name} ($${(totalMoney / 1000000).toFixed(1)}M / ${bestOffer.years} г.)`);
    }
    
    if (summaries.length > 0) {
      await tx.insiderPost.create({
        data: {
          content: `🚨 Внимание, закрытие Рынка СА (Блок ${block.number})!\nВот итоговые подписания блока:\n${summaries.join('\n')}`
        }
      });
    }

    await tx.faBlock.update({ where: { id: parseInt(blockId) }, data: { status: 'COMPLETED' } });
    
    const settings = await tx.leagueSettings.findUnique({ where: { id: 1 } });
    const newCompleted = [...(settings?.completed_fa_blocks || [])];
    if (!newCompleted.includes(block.number)) newCompleted.push(block.number);
    
    await tx.leagueSettings.update({
      where: { id: 1 },
      data: {
        completed_fa_blocks: newCompleted,
        current_block_number: null,
        current_block_deadline: null
      }
    });
  });
  
  return { success: true };
});

fastify.post('/free-agency/offer', async (request, reply) => {
  const { player_id, team_id, offer_type, salaries } = request.body as any;
  const parsedSalaries = salaries ? salaries.map(Number) : [];
  const years = parsedSalaries.length;
  
  const player = await prisma.player.findUnique({ 
    where: { id: player_id },
    include: { fa_block: true }
  });
  if (!player) return reply.status(404).send({ error: 'Player not found' });
  if (!player.fa_block) return reply.status(400).send({ error: 'Игрок не в блоке' });

  const settings = await prisma.leagueSettings.findUnique({ where: { id: 1 } });
  if (!settings) return reply.status(500).send({ error: 'Settings not found' });
  
  if (player.fa_block.status !== 'ACTIVE') return reply.status(400).send({ error: 'Блок игрока не активен' });
  if (player.fa_block.deadline && new Date() > new Date(player.fa_block.deadline)) {
    return reply.status(400).send({ error: 'Дедлайн блока истек! Подача новых предложений заблокирована' });
  }

  if (offer_type === 'ROOKIE_MAX') {
    if (!player.is_rfa) return reply.status(400).send({ error: 'Детский макс доступен исключительно для RFA-игроков!' });
    if (years !== 4) return reply.status(400).send({ error: 'Детский макс строго 4 года' });
  }
  if (offer_type === 'SUPERMAX') {
    if (player.previous_team_id !== team_id) return reply.status(400).send({ error: 'Супермакс может предложить только родная команда' });
  }
  if (['MEDIUM_MAX', 'VETERAN_MAX', 'SUPERMAX'].includes(offer_type) && (years < 4 || years > 5)) {
    return reply.status(400).send({ error: 'Макс. контракт должен быть 4-5 лет' });
  }

  const offer = await prisma.contractOffer.create({
    data: { 
      player_id, team_id, years, 
      annual_salary: parsedSalaries[0] || 0,
      salaries: parsedSalaries
    }
  });
  return { success: true, offer };
});

fastify.post('/free-agency/offers/:offerId/match', async (request, reply) => {
  const { offerId } = request.params as any;
  const { action } = request.body as any;
  
  const offer = await prisma.contractOffer.findUnique({ where: { id: offerId }, include: { player: true, team: true } });
  if (!offer) return reply.status(404).send({ error: 'Offer not found' });
  
  const salaries = offer.salaries && offer.salaries.length > 0 ? offer.salaries : Array(offer.years).fill(offer.annual_salary);
  const totalMoney = salaries.reduce((a, b) => a + b, 0);

  if (action === 'MATCH') {
    await prisma.$transaction(async (tx) => {
      await tx.contractOffer.update({ where: { id: offerId }, data: { status: 'MATCHED' } });
      await tx.player.update({
        where: { id: offer.player_id },
        data: {
          team_id: offer.player.previous_team_id,
          salary: salaries[0],
          salaries,
          contract_years_left: offer.years,
          is_rfa: false,
          is_trade_restricted: true,
          previous_team_id: null
        }
      });
      const previousTeam = await tx.team.findUnique({ where: { id: offer.player.previous_team_id! } });
      await tx.insiderPost.create({
        data: {
          content: `🚨 BREAKING via @ShamsCharania: ${previousTeam?.name} повторяют оффер и сохраняют ${offer.player.name} (${offer.years} г, $${(totalMoney / 1000000).toFixed(1)}M)!`
        }
      });
    });
  } else if (action === 'PASS') {
    await prisma.contractOffer.update({ where: { id: offerId }, data: { status: 'ACCEPTED' } });
    await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: offer.player_id },
        data: {
          team_id: offer.team_id,
          salary: salaries[0],
          salaries,
          contract_years_left: offer.years,
          is_rfa: false,
          is_trade_restricted: true,
          previous_team_id: null
        }
      });
      await tx.insiderPost.create({
        data: {
          content: `🚨 BREAKING via @ShamsCharania: ${offer.player.name} подписывает контракт с ${offer.team.name} на ${offer.years} года на общую сумму $${(totalMoney / 1000000).toFixed(1)}M!`
        }
      });
    });
  }
  return { success: true };
});

fastify.post('/admin/free-agency/finalize/:playerId', async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  const { playerId } = request.params as any;
  const offer = await prisma.contractOffer.findFirst({
    where: { player_id: playerId, status: 'PENDING' },
    orderBy: { annual_salary: 'desc' },
    include: { player: true, team: true }
  });
  
  if (!offer) return reply.status(400).send({ error: 'Нет активных предложений' });
  
  const salaries = offer.salaries && offer.salaries.length > 0 ? offer.salaries : Array(offer.years).fill(offer.annual_salary);
  const totalMoney = salaries.reduce((a, b) => a + b, 0);

  await prisma.$transaction(async (tx) => {
    await tx.contractOffer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED' } });
    await tx.player.update({
      where: { id: playerId },
      data: {
        team_id: offer.team_id,
        salary: salaries[0],
        salaries,
        contract_years_left: offer.years,
        is_rfa: false,
        is_trade_restricted: true,
        previous_team_id: null
      }
    });
    await tx.contractOffer.updateMany({
      where: { player_id: playerId, id: { not: offer.id } },
      data: { status: 'DECLINED' }
    });
    await tx.insiderPost.create({
      data: {
        content: `🚨 BREAKING via @WojPod: Свободный агент ${offer.player.name} согласовал условия контракта с ${offer.team.name}: $${(totalMoney / 1000000).toFixed(1)}M на ${offer.years} года!`
      }
    });
  });
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

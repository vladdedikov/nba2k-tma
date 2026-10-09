import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load env
dotenv.config();
dotenv.config({ path: '../.env' });

// Support BigInt serialization in JSON
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

const prisma = new PrismaClient();
const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: true,
});

// Support requests without Content-Type or empty body to prevent HTTP 415
fastify.addContentTypeParser('*', function (request, payload, done) {
  let data = '';
  payload.on('data', chunk => { data += chunk; });
  payload.on('end', () => {
    if (!data || data.length === 0) return done(null, {});
    try {
      done(null, JSON.parse(data));
    } catch {
      done(null, data);
    }
  });
});

fastify.get('/', async (request, reply) => {
  return { hello: 'NBA2K TMA API' };
});

const getTeamsHandler = async (request: any, reply: any) => {
  const teams = await prisma.team.findMany({ 
    include: { 
      players: true, 
      gm: true,
      draft_picks: true
    },
    orderBy: { name: 'asc' }
  });
  return teams.map(t => ({
    ...t,
    owner: t.gm // backwards compatibility for old components
  }));
};

fastify.get('/teams', getTeamsHandler);
fastify.get('/api/teams', getTeamsHandler);

// Role check middleware/helper
const checkAdmin = (request: any, reply: any) => {
  const role = request.headers['x-user-role'];
  if (role !== 'ADMIN') {
    reply.status(403).send({ error: 'Access denied: Admin only' });
    return false;
  }
  return true;
};

// Team permission check helper: Admin or specific team GM
const checkUserTeamPermission = (request: any, reply: any, targetTeamId: string) => {
  const role = request.headers['x-user-role'];
  if (role === 'ADMIN') return true;

  const userTeamId = request.headers['x-user-team-id'] || request.body?.user_team_id || request.body?.my_team_id;
  if (!userTeamId) {
    reply.status(403).send({ error: 'Зрители без команды не могут совершать действия! Дождитесь назначения клуба комиссионером.' });
    return false;
  }
  if (String(userTeamId) !== String(targetTeamId)) {
    reply.status(403).send({ error: 'Вы не можете совершать действия за чужую команду!' });
    return false;
  }
  return true;
};

// Telegram Sync / Auth
const telegramSyncHandler = async (request: any, reply: any) => {
  const { telegram_id, username, first_name } = request.body || {};
  if (!telegram_id) {
    return reply.status(400).send({ error: 'Параметр telegram_id обязателен' });
  }

  const cleanUsername = String(username || '').replace('@', '').toLowerCase();
  const configuredAdmin = (process.env.ADMIN_USERNAME || 'smthing69else').replace('@', '').toLowerCase();
  const isAdmin = cleanUsername === configuredAdmin;
  const parsedTgId = BigInt(telegram_id);

  let user = await prisma.user.findUnique({
    where: { telegram_id: parsedTgId },
    include: { team: true }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegram_id: parsedTgId,
        username: cleanUsername || null,
        first_name: first_name ? String(first_name) : null,
        role: isAdmin ? 'ADMIN' : 'USER',
      },
      include: { team: true }
    });
  } else {
    const updates: any = {};
    if (isAdmin && user.role !== 'ADMIN') updates.role = 'ADMIN';
    if (cleanUsername && user.username !== cleanUsername) updates.username = cleanUsername;
    if (first_name && user.first_name !== first_name) updates.first_name = String(first_name);

    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updates,
        include: { team: true }
      });
    }
  }

  return {
    id: user.id,
    telegram_id: Number(user.telegram_id),
    username: user.username,
    first_name: user.first_name,
    role: user.role,
    team_id: user.team_id,
    team: user.team
  };
};

fastify.post('/auth/telegram-sync', telegramSyncHandler);
fastify.post('/api/auth/telegram-sync', telegramSyncHandler);

// Admin Users Management
const adminGetUsersHandler = async (request: any, reply: any) => {
  if (!checkAdmin(request, reply)) return;

  const users = await prisma.user.findMany({
    include: { team: true },
    orderBy: { id: 'asc' }
  });

  const teams = await prisma.team.findMany({
    include: { gm: true },
    orderBy: { name: 'asc' }
  });

  const serializedUsers = users.map(u => ({
    ...u,
    telegram_id: Number(u.telegram_id)
  }));

  return { users: serializedUsers, teams };
};

fastify.get('/admin/users', adminGetUsersHandler);
fastify.get('/api/admin/users', adminGetUsersHandler);

const adminAssignTeamHandler = async (request: any, reply: any) => {
  if (!checkAdmin(request, reply)) return;

  const { user_id, team_id } = request.body || {};
  if (!user_id) {
    return reply.status(400).send({ error: 'Параметр user_id обязателен' });
  }

  const parsedUserId = Number(user_id);

  if (!team_id) {
    // Unassign user from team
    await prisma.user.update({
      where: { id: parsedUserId },
      data: { team_id: null }
    });
    return { success: true, message: 'Команда успешно откреплена' };
  }

  const targetTeamId = String(team_id);

  // Unassign any user currently attached to this team to respect @unique constraint
  await prisma.user.updateMany({
    where: { team_id: targetTeamId },
    data: { team_id: null }
  });

  // Assign user to this team
  await prisma.user.update({
    where: { id: parsedUserId },
    data: { team_id: targetTeamId }
  });

  return { success: true, message: 'Команда успешно закреплена за пользователем' };
};

fastify.post('/admin/users/assign-team', adminAssignTeamHandler);
fastify.post('/api/admin/users/assign-team', adminAssignTeamHandler);

const adminSetUserRoleHandler = async (request: any, reply: any) => {
  if (!checkAdmin(request, reply)) return;

  const { target_user_id, user_id, role } = request.body || {};
  const rawId = target_user_id || user_id;
  if (!rawId) {
    return reply.status(400).send({ error: 'Параметр target_user_id обязателен' });
  }

  const parsedUserId = Number(rawId);
  const targetRole = String(role || '').toUpperCase();
  if (targetRole !== 'ADMIN' && targetRole !== 'USER') {
    return reply.status(400).send({ error: 'Недопустимая роль. Допустимы: ADMIN или USER' });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: parsedUserId } });
  if (!targetUser) {
    return reply.status(404).send({ error: 'Пользователь не найден' });
  }

  // Protection: cannot revoke admin rights from the league creator
  const creatorUsername = (process.env.ADMIN_USERNAME || 'smthing69else').replace('@', '').toLowerCase();
  if (targetUser.username?.toLowerCase() === creatorUsername && targetRole !== 'ADMIN') {
    return reply.status(403).send({ error: `Нельзя отозвать права администратора у создателя лиги (@${targetUser.username})` });
  }

  const updatedUser = await prisma.user.update({
    where: { id: parsedUserId },
    data: { role: targetRole },
    include: { team: true }
  });

  return {
    success: true,
    user: {
      ...updatedUser,
      telegram_id: Number(updatedUser.telegram_id)
    }
  };
};

fastify.post('/admin/users/set-role', adminSetUserRoleHandler);
fastify.post('/api/admin/users/set-role', adminSetUserRoleHandler);


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

const getTradesHandler = async (request: any, reply: any) => {
  const role = request.headers['x-user-role'];
  const userTeamId = request.headers['x-user-team-id'] || (request.query as any)?.team_id;

  let whereClause: any = {};
  if (role !== 'ADMIN') {
    if (!userTeamId) {
      // Spectator without a team sees no confidential trade offers
      return [];
    }
    whereClause = {
      OR: [
        { sender_team_id: String(userTeamId) },
        { receiver_team_id: String(userTeamId) }
      ]
    };
  }

  const trades = await prisma.tradeOffer.findMany({
    where: whereClause,
    orderBy: { created_at: 'desc' },
    include: { sender_team: true, receiver_team: true }
  });
  return trades;
};

fastify.get('/trades', getTradesHandler);
fastify.get('/api/trades', getTradesHandler);

const createTradeOfferHandler = async (request: any, reply: any) => {
  const data = request.body as any;
  if (!checkUserTeamPermission(request, reply, data.sender_team_id)) return;

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
};

fastify.post('/trades/offer', createTradeOfferHandler);
fastify.post('/api/trades/offer', createTradeOfferHandler);

const respondTradeOfferHandler = async (request: any, reply: any) => {
  const { id } = request.params as any;
  const { action } = request.body as any; // 'ACCEPT' | 'REJECT'
  
  const trade = await prisma.tradeOffer.findUnique({
    where: { id },
    include: { sender_team: true, receiver_team: true }
  });
  if (!trade) return reply.status(404).send({ error: 'Trade not found' });
  if (trade.status !== 'PENDING') return reply.status(400).send({ error: 'Trade is not pending' });

  if (!checkUserTeamPermission(request, reply, trade.receiver_team_id)) return;

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
      ...trade.sent_pick_ids.map(pid => prisma.draftPick.update({ where: { id: pid }, data: { team_id: trade.receiver_team_id } })),
      ...trade.received_pick_ids.map(pid => prisma.draftPick.update({ where: { id: pid }, data: { team_id: trade.sender_team_id } })),
      prisma.tradeOffer.update({ where: { id }, data: { status: 'ACCEPTED' } }),
      prisma.insiderPost.create({
        data: {
          content: `⚡️ СДЕЛКА СОСТОЯЛАСЬ! ${trade.sender_team.name} и ${trade.receiver_team.name} завершили обмен:\nУшли из ${trade.sender_team.name}: ${sentPlayers.map(p => p.name).join(', ') || 'Пики'}\nУшли из ${trade.receiver_team.name}: ${recPlayers.map(p => p.name).join(', ') || 'Пики'}.`,
        }
      })
    ]);
    return { success: true, status: 'ACCEPTED' };
  }
};

fastify.post('/trades/:id/respond', respondTradeOfferHandler);
fastify.post('/api/trades/:id/respond', respondTradeOfferHandler);

// Insider Feed API
const getFeedHandler = async (request: any, reply: any) => {
  return await prisma.insiderPost.findMany({ orderBy: { created_at: 'desc' }, include: { team: true } });
};
fastify.get('/feed', getFeedHandler);
fastify.get('/api/feed', getFeedHandler);

const createTeamPostHandler = async (request: any, reply: any) => {
  const { text, content, team_id } = request.body || {};
  const role = request.headers['x-user-role'];
  const userTeamId = request.headers['x-user-team-id'] || team_id;

  const targetTeamId = userTeamId ? String(userTeamId) : null;

  if (!targetTeamId) {
    return reply.status(400).send({ error: 'У вас нет назначенной команды для публикации официального заявления' });
  }

  const cleanText = String(text || content || '').trim();
  if (!cleanText) {
    return reply.status(400).send({ error: 'Текст заявления не может быть пустым' });
  }

  if (role !== 'ADMIN' && String(request.headers['x-user-team-id']) !== targetTeamId) {
    return reply.status(403).send({ error: 'Вы можете публиковать заявления только от своей команды' });
  }

  const team = await prisma.team.findUnique({ where: { id: targetTeamId } });
  if (!team) {
    return reply.status(404).send({ error: 'Команда не найдена' });
  }

  const newPost = await prisma.insiderPost.create({
    data: {
      type: 'TEAM_POST',
      team_id: targetTeamId,
      content: cleanText
    },
    include: { team: true }
  });

  return { success: true, post: newPost };
};

fastify.post('/insiders/team-post', createTeamPostHandler);
fastify.post('/api/insiders/team-post', createTeamPostHandler);

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

const changeSeasonHandler = async (request: any, reply: any) => {
  if (!checkAdmin(request, reply)) return;
  const { target_season } = request.body || {};
  if (!target_season) {
    return reply.status(400).send({ error: 'Параметр target_season обязателен' });
  }

  const settings = await prisma.leagueSettings.findUnique({ where: { id: 1 } });
  const currentSeasonStr = settings?.current_season || '2026-27';

  // Определяем год завершившегося драфта из текущего сезона (например, "2026-27" -> 2027)
  const getDraftYear = (seasonStr: string): number => {
    const parts = seasonStr.split('-');
    const startYear = parseInt(parts[0], 10);
    return isNaN(startYear) ? new Date().getFullYear() : startYear + 1;
  };
  const finishedDraftYear = getDraftYear(currentSeasonStr);

  console.log(`>>> [SEASON_CHANGE] Смена сезона: ${currentSeasonStr} -> ${target_season}, удаление пиков <= ${finishedDraftYear}`);

  // 1. АВТОМАТИЧЕСКАЯ ОЧИСТКА ДРАФТ-ПИКОВ:
  // Удалить из таблицы DraftPick все пики команд, год которых меньше или равен году завершившегося драфта
  await prisma.draftPick.deleteMany({
    where: { year: { lte: finishedDraftYear } }
  });

  // 2. СДВИГ КОНТРАКТОВ ИГРОКОВ:
  const players = await prisma.player.findMany({ where: { team_id: { not: null } } });
  const playerUpdates = players.map(p => {
    let newSalaries = [...p.salaries];
    let newLeft = p.contract_years_left - 1;
    if (newSalaries.length > 0) {
      newSalaries.shift();
    }
    const isExpired = newLeft <= 0 || newSalaries.length === 0;

    if (isExpired) {
      return prisma.player.update({
        where: { id: p.id },
        data: {
          team_id: null,
          previous_team_id: p.team_id,
          is_rfa: false,
          contract_years_left: 0,
          salaries: [],
          salary: 0,
          option_type: 'NONE',
          is_trade_restricted: false,
          fa_block_id: null
        }
      });
    } else {
      return prisma.player.update({
        where: { id: p.id },
        data: {
          contract_years_left: newLeft,
          salaries: newSalaries,
          salary: newSalaries[0] || 0,
          is_trade_restricted: false,
          fa_block_id: null
        }
      });
    }
  });

  await prisma.$transaction([
    ...playerUpdates,
    prisma.player.updateMany({
      where: { team_id: null },
      data: { is_trade_restricted: false, fa_block_id: null }
    }),
    prisma.faBlock.deleteMany(),
    prisma.leagueSettings.update({
      where: { id: 1 },
      data: {
        current_season: target_season,
        current_stage: 'DRAFT',
        draft_order_approved: true,
        current_draft_pick_index: 0,
        draft_is_completed: false,
        approved_fa_blocks: [],
        completed_fa_blocks: [],
        current_block_deadline: null,
        current_block_number: 1
      }
    })
  ]);

  console.log(`>>> [SEASON_CHANGE] Сезон успешно изменен на: ${target_season}`);
  return reply.status(200).send({ success: true, newSeason: target_season });
};

fastify.post('/admin/league/season', changeSeasonHandler);
fastify.post('/api/admin/league/season', changeSeasonHandler);

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
    prisma.leagueSettings.update({ where: { id: 1 }, data: { current_stage: 'REGULAR_SEASON' } })
  ]);
  
  return { success: true };
});

// Draft API
const getDraftBoardHandler = async (request: any, reply: any) => {
  const settings = await prisma.leagueSettings.findUnique({ where: { id: 1 } });
  
  const allPicks = await prisma.draftPick.findMany({
    orderBy: [{ year: 'asc' }, { id: 'asc' }],
    include: {
      team: true,
      selected_player: {
        select: { id: true, name: true, position: true, overall_rating: true }
      }
    }
  });

  // Strictly 30 picks for Round 1
  const round1Picks = allPicks.slice(0, 30);

  const picks = round1Picks.map((p, idx) => ({
    ...p,
    pick_number: idx + 1,
    team: {
      id: p.team.id,
      name: p.team.name,
      logo_url: p.team.logo_url
    },
    selected_player: p.selected_player ? {
      id: p.selected_player.id,
      name: p.selected_player.name,
      position: p.selected_player.position,
      overall_rating: p.selected_player.overall_rating
    } : null
  }));

  const currentPickIndex = settings?.current_draft_pick_index ?? 0;

  return { 
    picks, 
    settings,
    current_pick_index: currentPickIndex
  };
};

fastify.get('/draft/board', getDraftBoardHandler);
fastify.get('/api/draft/board', getDraftBoardHandler);

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

const createDraftPickHandler = async (request: any, reply: any) => {
  console.log('>>> [DRAFT_PICK_CREATE] Входящие данные:', request.body);
  if (!checkAdmin(request, reply)) {
    console.error('>>> [DRAFT_PICK_CREATE] Ошибка авторизации: пользователь не ADMIN');
    return;
  }
  const { team_id, teamId, year, name } = (request.body as any) || {};
  const rawTeamId = team_id !== undefined ? team_id : teamId;
  let targetTeamId = String(rawTeamId || '').trim();
  const targetYear = Number(year);
  const targetName = String(name || '').trim();

  // If a numeric index was provided (e.g., 1, 2, 3), find corresponding team in DB
  if (targetTeamId && !isNaN(Number(targetTeamId)) && !targetTeamId.includes('-')) {
    const allTeams = await prisma.team.findMany({ orderBy: { name: 'asc' } });
    const num = Number(targetTeamId);
    if (allTeams[num - 1]) {
      targetTeamId = allTeams[num - 1].id;
    }
  }

  if (!targetTeamId || !targetYear || !targetName) {
    console.error('>>> [DRAFT_PICK_CREATE] Ошибка валидации:', { targetTeamId, targetYear, targetName });
    return reply.status(400).send({ 
      error: `Некорректные параметры: team_id=${targetTeamId}, year=${targetYear}, name=${targetName}` 
    });
  }

  try {
    const newPick = await prisma.draftPick.create({
      data: {
        team_id: targetTeamId,
        year: targetYear,
        name: targetName,
      }
    });
    console.log('>>> [DRAFT_PICK_CREATE] Успешно создан пик:', newPick);
    return reply.status(201).send({ success: true, pick: newPick });
  } catch (dbErr: any) {
    console.error('>>> [DRAFT_PICK_CREATE] Ошибка базы данных:', dbErr);
    return reply.status(500).send({ error: dbErr?.message || 'Database error' });
  }
};

const deleteDraftPickHandler = async (request: any, reply: any) => {
  console.log('>>> [DRAFT_PICK_DELETE] Запрос на удаление:', request.params);
  if (!checkAdmin(request, reply)) return;
  const { id } = request.params as any;
  try {
    await prisma.draftPick.delete({ where: { id: Number(id) } });
    console.log('>>> [DRAFT_PICK_DELETE] Успешно удален id:', id);
    return { success: true };
  } catch (dbErr: any) {
    console.error('>>> [DRAFT_PICK_DELETE] Ошибка базы данных:', dbErr);
    return reply.status(500).send({ error: dbErr?.message || 'Database error' });
  }
};

fastify.post('/admin/draft-picks', createDraftPickHandler);
fastify.post('/api/admin/draft-picks', createDraftPickHandler);

fastify.delete('/admin/draft-picks/:id', deleteDraftPickHandler);
fastify.delete('/api/admin/draft-picks/:id', deleteDraftPickHandler);

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

const draftPickHandler = async (request: any, reply: any) => {
  const { pick_id, player_id } = (request.body as any) || {};

  if (!pick_id || !player_id) {
    return reply.status(400).send({ error: 'Параметры pick_id и player_id обязательны' });
  }

  const pick = await prisma.draftPick.findUnique({ 
    where: { id: parseInt(pick_id, 10) },
    include: { team: true }
  });
  const player = await prisma.player.findUnique({ where: { id: player_id } });
  const settings = await prisma.leagueSettings.findUnique({ where: { id: 1 } });

  if (!pick || !player || !settings) {
    return reply.status(404).send({ error: 'Пик, игрок или настройки лиги не найдены' });
  }

  if (pick.is_used) {
    return reply.status(400).send({ error: 'Этот пик уже использован!' });
  }

  if (!checkUserTeamPermission(request, reply, pick.team_id)) return;

  // Назначение игрока
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

  // Отметка пика
  await prisma.draftPick.update({
    where: { id: pick.id },
    data: { 
      is_used: true,
      selected_player_id: player_id
    }
  });

  // Индекс current_draft_pick_index увеличивается на 1 (ход переходит дальше)
  const round1Count = 30;
  const nextIndex = settings.current_draft_pick_index + 1;
  const isCompleted = nextIndex >= round1Count;

  const updatedSettings = await prisma.leagueSettings.update({
    where: { id: 1 },
    data: { 
      current_draft_pick_index: nextIndex,
      draft_is_completed: isCompleted
    }
  });

  // Возвращать обновленное состояние доски (ровно 30 слотов)
  const allUpdatedPicks = await prisma.draftPick.findMany({
    orderBy: [{ year: 'asc' }, { id: 'asc' }],
    include: {
      team: true,
      selected_player: {
        select: { id: true, name: true, position: true, overall_rating: true }
      }
    }
  });

  const picks = allUpdatedPicks.slice(0, 30).map((p, idx) => ({
    ...p,
    pick_number: idx + 1,
    team: {
      id: p.team.id,
      name: p.team.name,
      logo_url: p.team.logo_url
    },
    selected_player: p.selected_player ? {
      id: p.selected_player.id,
      name: p.selected_player.name,
      position: p.selected_player.position,
      overall_rating: p.selected_player.overall_rating
    } : null
  }));

  return { 
    success: true, 
    picks, 
    settings: updatedSettings,
    current_pick_index: nextIndex
  };
};

fastify.post('/draft/pick', draftPickHandler);
fastify.post('/api/draft/pick', draftPickHandler);

// Free Agency API
fastify.get('/free-agency/players', async (request, reply) => {
  return await prisma.player.findMany({
    where: { team_id: null, is_prospect: false },
    include: { contract_offers: { include: { team: true }, orderBy: { annual_salary: 'desc' } }, team: true }
  });
});

const getUnassignedPlayersHandler = async (request: any, reply: any) => {
  if (!checkAdmin(request, reply)) return;
  try {
    const players = await prisma.player.findMany({
      where: { team_id: null, is_prospect: false, fa_block_id: null },
      orderBy: { overall_rating: 'desc' }
    });
    return players;
  } catch (error) {
    console.error('Error fetching unassigned players:', error);
    return reply.status(500).send({ error: 'Ошибка получения свободных агентов' });
  }
};

fastify.get('/admin/free-agency/unassigned-players', getUnassignedPlayersHandler);
fastify.get('/api/admin/free-agency/unassigned-players', getUnassignedPlayersHandler);

const createFaBlockHandler = async (request: any, reply: any) => {
  if (!checkAdmin(request, reply)) return;
  try {
    let body = request.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }
    const { duration_minutes } = (body as any) || {};
    const duration = Number(duration_minutes) || 30;

    const count = await prisma.faBlock.count();
    const newBlockNumber = count + 1;

    const newBlock = await prisma.faBlock.create({
      data: {
        number: newBlockNumber,
        status: 'PENDING'
      }
    });

    const blockResponse = {
      ...newBlock,
      block_number: newBlock.number,
      duration_minutes: duration
    };

    console.log(`>>> [FA_BLOCK_CREATE] Создан блок #${newBlockNumber} (id: ${newBlock.id}), duration: ${duration} мин.`);
    return reply.status(201).send({ success: true, block: blockResponse });
  } catch (error) {
    console.error('>>> [FA_BLOCK_CREATE_ERROR] Ошибка при создании блока:', error);
    return reply.status(500).send({ error: 'Ошибка при создании блока свободных агентов' });
  }
};

fastify.post('/admin/free-agency/blocks', createFaBlockHandler);
fastify.post('/api/admin/free-agency/blocks', createFaBlockHandler);

const deleteBlockHandler = async (request: any, reply: any) => {
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
};

fastify.delete('/admin/free-agency/blocks/:blockId', deleteBlockHandler);
fastify.delete('/api/admin/free-agency/blocks/:blockId', deleteBlockHandler);

const addPlayerHandler = async (request: any, reply: any) => {
  if (!checkAdmin(request, reply)) return;
  const { blockId } = request.params as any;
  const { player_id } = request.body as any;
  await prisma.player.update({
    where: { id: player_id },
    data: { fa_block_id: parseInt(blockId) }
  });
  return { success: true };
};

fastify.post('/admin/free-agency/blocks/:blockId/add-player', addPlayerHandler);
fastify.post('/api/admin/free-agency/blocks/:blockId/add-player', addPlayerHandler);

const removePlayerHandler = async (request: any, reply: any) => {
  if (!checkAdmin(request, reply)) return;
  const { player_id } = request.body as any;
  await prisma.player.update({
    where: { id: player_id },
    data: { fa_block_id: null }
  });
  return { success: true };
};

fastify.post('/admin/free-agency/blocks/:blockId/remove-player', removePlayerHandler);
fastify.post('/api/admin/free-agency/blocks/:blockId/remove-player', removePlayerHandler);

const startBlockHandler = async (request: any, reply: any) => {
  if (!checkAdmin(request, reply)) return;
  const { blockId } = request.params as any;
  const { days = 0, minutes = 30 } = (request.body as any) || {};
  
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
};

fastify.post('/admin/free-agency/blocks/:blockId/start', startBlockHandler);
fastify.post('/api/admin/free-agency/blocks/:blockId/start', startBlockHandler);

const getOfferEvaluationAmount = (offer: any) => {
  if (typeof offer.evaluation_amount === 'number' && offer.evaluation_amount > 0) {
    return offer.evaluation_amount;
  }
  const salaries = offer.salaries && offer.salaries.length > 0 
    ? offer.salaries 
    : Array(offer.years || 1).fill(offer.annual_salary || 0);
  return salaries.slice(0, 4).reduce((sum: number, val: number) => sum + Number(val || 0), 0);
};

const getFaBlocksHandler = async (request: any, reply: any) => {
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
};

fastify.get('/free-agency/blocks', getFaBlocksHandler);
fastify.get('/api/free-agency/blocks', getFaBlocksHandler);

const getFaBlockByIdHandler = async (request: any, reply: any) => {
  const { blockId } = request.params as any;
  
  const players = await prisma.player.findMany({
    where: { fa_block_id: parseInt(blockId) },
    orderBy: { overall_rating: 'desc' },
    include: { contract_offers: { include: { team: true } }, team: true }
  });
  
  const playersWithSortedOffers = players.map(p => {
    const offers = p.contract_offers.sort((a, b) => {
      const evalA = getOfferEvaluationAmount(a);
      const evalB = getOfferEvaluationAmount(b);
      return evalB - evalA;
    });
    return { ...p, contract_offers: offers };
  });

  return playersWithSortedOffers;
};

fastify.get('/free-agency/blocks/:blockId', getFaBlockByIdHandler);
fastify.get('/api/free-agency/blocks/:blockId', getFaBlockByIdHandler);

const finalizeBlockHandler = async (request: any, reply: any) => {
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
        const evalA = getOfferEvaluationAmount(a);
        const evalB = getOfferEvaluationAmount(b);
        return evalB - evalA;
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
          option_type: bestOffer.last_year_option || 'NONE',
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
};

fastify.post('/admin/free-agency/blocks/:blockId/finalize', finalizeBlockHandler);
fastify.post('/api/admin/free-agency/blocks/:blockId/finalize', finalizeBlockHandler);

const createFaOfferHandler = async (request: any, reply: any) => {
  const { player_id, team_id, offer_type, salaries, last_year_option } = request.body as any;
  if (!checkUserTeamPermission(request, reply, team_id)) return;

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

  // Calculate evaluation strictly over first 4 years
  const evalSalaries = parsedSalaries.slice(0, 4);
  const evaluationAmount = evalSalaries.reduce((sum: number, val: number) => sum + Number(val || 0), 0);

  const cleanLastYearOption = ['NONE', 'PLAYER_OPTION', 'TEAM_OPTION'].includes(last_year_option)
    ? last_year_option
    : (offer_type === 'MIN' ? 'PLAYER_OPTION' : 'NONE');

  const offer = await prisma.contractOffer.create({
    data: { 
      player_id, 
      team_id, 
      years, 
      annual_salary: parsedSalaries[0] || 0,
      salaries: parsedSalaries,
      last_year_option: cleanLastYearOption,
      evaluation_amount: evaluationAmount
    }
  });
  return { success: true, offer };
};

fastify.post('/free-agency/offer', createFaOfferHandler);
fastify.post('/api/free-agency/offer', createFaOfferHandler);

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
          option_type: offer.last_year_option || 'NONE',
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
          option_type: offer.last_year_option || 'NONE',
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
  const offers = await prisma.contractOffer.findMany({
    where: { player_id: playerId, status: 'PENDING' },
    include: { player: true, team: true }
  });
  
  if (offers.length === 0) return reply.status(400).send({ error: 'Нет активных предложений' });
  const offer = offers.sort((a, b) => getOfferEvaluationAmount(b) - getOfferEvaluationAmount(a))[0];
  
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
        option_type: offer.last_year_option || 'NONE',
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
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

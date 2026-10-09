import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting full stock seed...');

  // Clear existing data
  await prisma.freeAgencyLot.deleteMany();
  await prisma.insiderPost.deleteMany();
  await prisma.contractOffer.deleteMany();
  await prisma.tradeOffer.deleteMany();
  await prisma.draftPick.deleteMany();
  await prisma.faBlock.deleteMany();
  await prisma.player.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  // 0. League Settings
  await prisma.leagueSettings.deleteMany();
  await prisma.leagueSettings.create({
    data: {
      id: 1,
      soft_cap: 140000000,
      luxury_tax: 170000000,
      first_apron: 178000000,
      second_apron: 189000000,
      hard_cap: 200000000,
      current_stage: 'DRAFT',
      current_season: '2026-27',
      draft_order_approved: true,
      current_draft_pick_index: 0,
      draft_is_completed: false,
      approved_fa_blocks: [],
      completed_fa_blocks: [],
      current_block_deadline: null,
      current_block_number: 1,
      min_salary_schedule: [1.15, 1.25, 1.35, 1.45, 1.55],
      tax_mle_schedule: [5.3, 5.6, 5.9],
      full_mle_schedule: [12.9, 13.6, 14.3, 15.0],
      rookie_max_schedule: [35.5, 38.3, 41.1, 44.0],
      medium_max_schedule: [42.5, 45.9, 49.3, 52.7, 56.1],
      veteran_max_schedule: [50.0, 54.0, 58.0, 62.0, 66.0],
      supermax_schedule: [60.0, 64.8, 69.6, 74.4, 79.2]
    }
  });

  // 1. Create Default Users (including Commissioner @smthing69else)
  const adminUser = await prisma.user.create({
    data: {
      telegram_id: BigInt(777777777),
      username: 'smthing69else',
      first_name: 'Комиссионер',
      role: 'ADMIN',
    },
  });

  const demoUser = await prisma.user.create({
    data: {
      telegram_id: BigInt(123456789),
      username: 'nba_player_gm',
      first_name: 'Alex',
      role: 'USER',
    },
  });

  // 2. Create 30 NBA Teams
  const NBA_TEAMS_DATA = [
    { name: 'Atlanta Hawks', logo_url: 'https://upload.wikimedia.org/wikipedia/en/2/24/Atlanta_Hawks_logo.svg' },
    { name: 'Boston Celtics', logo_url: 'https://upload.wikimedia.org/wikipedia/en/8/8f/Boston_Celtics.svg' },
    { name: 'Brooklyn Nets', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Brooklyn_Nets_newlogo.svg' },
    { name: 'Charlotte Hornets', logo_url: 'https://upload.wikimedia.org/wikipedia/en/c/c4/Charlotte_Hornets_%282014%29.svg' },
    { name: 'Chicago Bulls', logo_url: 'https://upload.wikimedia.org/wikipedia/en/6/67/Chicago_Bulls_logo.svg' },
    { name: 'Cleveland Cavaliers', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Cleveland_Cavaliers_logo.svg' },
    { name: 'Dallas Mavericks', logo_url: 'https://upload.wikimedia.org/wikipedia/en/9/97/Dallas_Mavericks_logo.svg' },
    { name: 'Denver Nuggets', logo_url: 'https://upload.wikimedia.org/wikipedia/en/7/76/Denver_Nuggets_logo.svg' },
    { name: 'Detroit Pistons', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Logo_of_the_Detroit_Pistons.svg' },
    { name: 'Golden State Warriors', logo_url: 'https://upload.wikimedia.org/wikipedia/en/0/01/Golden_State_Warriors_logo.svg' },
    { name: 'Houston Rockets', logo_url: 'https://upload.wikimedia.org/wikipedia/en/2/28/Houston_Rockets.svg' },
    { name: 'Indiana Pacers', logo_url: 'https://upload.wikimedia.org/wikipedia/en/1/1b/Indiana_Pacers.svg' },
    { name: 'LA Clippers', logo_url: 'https://upload.wikimedia.org/wikipedia/en/b/bb/Los_Angeles_Clippers_%282024%29.svg' },
    { name: 'Los Angeles Lakers', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Los_Angeles_Lakers_logo.svg' },
    { name: 'Memphis Grizzlies', logo_url: 'https://upload.wikimedia.org/wikipedia/en/f/f1/Memphis_Grizzlies.svg' },
    { name: 'Miami Heat', logo_url: 'https://upload.wikimedia.org/wikipedia/en/6/67/Miami_Heat_logo.svg' },
    { name: 'Milwaukee Bucks', logo_url: 'https://upload.wikimedia.org/wikipedia/en/4/4a/Milwaukee_Bucks_logo.svg' },
    { name: 'Minnesota Timberwolves', logo_url: 'https://upload.wikimedia.org/wikipedia/en/c/c2/Minnesota_Timberwolves_logo.svg' },
    { name: 'New Orleans Pelicans', logo_url: 'https://upload.wikimedia.org/wikipedia/en/0/0d/New_Orleans_Pelicans_logo.svg' },
    { name: 'New York Knicks', logo_url: 'https://upload.wikimedia.org/wikipedia/en/2/25/New_York_Knicks_logo.svg' },
    { name: 'Oklahoma City Thunder', logo_url: 'https://upload.wikimedia.org/wikipedia/en/5/5d/Oklahoma_City_Thunder.svg' },
    { name: 'Orlando Magic', logo_url: 'https://upload.wikimedia.org/wikipedia/en/1/10/Orlando_Magic_logo.svg' },
    { name: 'Philadelphia 76ers', logo_url: 'https://upload.wikimedia.org/wikipedia/en/0/0e/Philadelphia_76ers_logo.svg' },
    { name: 'Phoenix Suns', logo_url: 'https://upload.wikimedia.org/wikipedia/en/d/dc/Phoenix_Suns_logo.svg' },
    { name: 'Portland Trail Blazers', logo_url: 'https://upload.wikimedia.org/wikipedia/en/2/21/Portland_Trail_Blazers_logo.svg' },
    { name: 'Sacramento Kings', logo_url: 'https://upload.wikimedia.org/wikipedia/en/c/c7/SacramentoKings.svg' },
    { name: 'San Antonio Spurs', logo_url: 'https://upload.wikimedia.org/wikipedia/en/a/a2/San_Antonio_Spurs.svg' },
    { name: 'Toronto Raptors', logo_url: 'https://upload.wikimedia.org/wikipedia/en/3/36/Toronto_Raptors_logo.svg' },
    { name: 'Utah Jazz', logo_url: 'https://upload.wikimedia.org/wikipedia/en/0/04/Utah_Jazz_logo_2022.svg' },
    { name: 'Washington Wizards', logo_url: 'https://upload.wikimedia.org/wikipedia/en/0/02/Washington_Wizards_logo.svg' },
  ];

  const createdTeamsMap: Record<string, any> = {};

  for (const t of NBA_TEAMS_DATA) {
    const created = await prisma.team.create({
      data: {
        name: t.name,
        logo_url: t.logo_url,
        budget: 150000000,
        salary_cap: 140000000,
      }
    });
    createdTeamsMap[t.name] = created;
  }

  // Attach demo user to Boston Celtics
  if (createdTeamsMap['Boston Celtics']) {
    await prisma.user.update({
      where: { id: demoUser.id },
      data: { team_id: createdTeamsMap['Boston Celtics'].id }
    });
  }

  // 3. Stock Players
  const playersList: any[] = [
    // Lakers
    { team: 'Los Angeles Lakers', name: 'LeBron James', position: 'SF', overall_rating: 96, salary: 47600000, years: 2 },
    { team: 'Los Angeles Lakers', name: 'Anthony Davis', position: 'PF', overall_rating: 94, salary: 40600000, years: 4 },
    { team: 'Los Angeles Lakers', name: 'Austin Reaves', position: 'SG', overall_rating: 82, salary: 12000000, years: 3 },
    { team: 'Los Angeles Lakers', name: 'D\'Angelo Russell', position: 'PG', overall_rating: 81, salary: 17300000, years: 1 },
    { team: 'Los Angeles Lakers', name: 'Rui Hachimura', position: 'PF', overall_rating: 80, salary: 15700000, years: 2 },

    // Celtics
    { team: 'Boston Celtics', name: 'Jayson Tatum', position: 'SF', overall_rating: 95, salary: 32600000, years: 3 },
    { team: 'Boston Celtics', name: 'Jaylen Brown', position: 'SG', overall_rating: 89, salary: 31800000, years: 1 },
    { team: 'Boston Celtics', name: 'Jrue Holiday', position: 'PG', overall_rating: 86, salary: 36800000, years: 1 },
    { team: 'Boston Celtics', name: 'Kristaps Porzingis', position: 'C', overall_rating: 86, salary: 36000000, years: 1 },
    { team: 'Boston Celtics', name: 'Derrick White', position: 'SG', overall_rating: 82, salary: 18300000, years: 2 },

    // Warriors
    { team: 'Golden State Warriors', name: 'Stephen Curry', position: 'PG', overall_rating: 96, salary: 51900000, years: 3 },
    { team: 'Golden State Warriors', name: 'Klay Thompson', position: 'SG', overall_rating: 84, salary: 43200000, years: 1 },
    { team: 'Golden State Warriors', name: 'Draymond Green', position: 'PF', overall_rating: 83, salary: 22300000, years: 4 },
    { team: 'Golden State Warriors', name: 'Andrew Wiggins', position: 'SF', overall_rating: 82, salary: 24300000, years: 4 },
    { team: 'Golden State Warriors', name: 'Jonathan Kuminga', position: 'PF', overall_rating: 81, salary: 6000000, years: 2 },

    // Heat
    { team: 'Miami Heat', name: 'Jimmy Butler', position: 'SF', overall_rating: 94, salary: 45100000, years: 3 },
    { team: 'Miami Heat', name: 'Bam Adebayo', position: 'C', overall_rating: 87, salary: 32600000, years: 3 },
    { team: 'Miami Heat', name: 'Tyler Herro', position: 'SG', overall_rating: 84, salary: 27000000, years: 4 },
    { team: 'Miami Heat', name: 'Terry Rozier', position: 'PG', overall_rating: 82, salary: 23200000, years: 3 },
    { team: 'Miami Heat', name: 'Duncan Robinson', position: 'SG', overall_rating: 78, salary: 18100000, years: 3 },

    // Stars on other teams
    { team: 'Milwaukee Bucks', name: 'Giannis Antetokounmpo', position: 'PF', overall_rating: 97, salary: 48787676, years: 3 },
    { team: 'Milwaukee Bucks', name: 'Damian Lillard', position: 'PG', overall_rating: 92, salary: 45640084, years: 2 },
    { team: 'Denver Nuggets', name: 'Nikola Jokić', position: 'C', overall_rating: 98, salary: 47607350, years: 4 },
    { team: 'Denver Nuggets', name: 'Jamal Murray', position: 'PG', overall_rating: 88, salary: 33833400, years: 2 },
    { team: 'Dallas Mavericks', name: 'Luka Dončić', position: 'PG', overall_rating: 97, salary: 40064220, years: 3 },
    { team: 'Dallas Mavericks', name: 'Kyrie Irving', position: 'PG', overall_rating: 92, salary: 37037037, years: 2 },
    { team: 'Oklahoma City Thunder', name: 'Shai Gilgeous-Alexander', position: 'PG', overall_rating: 96, salary: 33386860, years: 3 },
    { team: 'Oklahoma City Thunder', name: 'Chet Holmgren', position: 'C', overall_rating: 87, salary: 10880640, years: 3 },
    { team: 'Philadelphia 76ers', name: 'Joel Embiid', position: 'C', overall_rating: 97, salary: 46900000, years: 3 },
    { team: 'Philadelphia 76ers', name: 'Tyrese Maxey', position: 'PG', overall_rating: 89, salary: 35147000, years: 4 },
    { team: 'Minnesota Timberwolves', name: 'Anthony Edwards', position: 'SG', overall_rating: 94, salary: 35250000, years: 4 },
    { team: 'Minnesota Timberwolves', name: 'Rudy Gobert', position: 'C', overall_rating: 86, salary: 41000000, years: 2 },
    { team: 'Phoenix Suns', name: 'Kevin Durant', position: 'PF', overall_rating: 95, salary: 47649433, years: 2 },
    { team: 'Phoenix Suns', name: 'Devin Booker', position: 'SG', overall_rating: 93, salary: 36016200, years: 4 },
    { team: 'New York Knicks', name: 'Jalen Brunson', position: 'PG', overall_rating: 93, salary: 26346666, years: 3 },
    { team: 'New York Knicks', name: 'OG Anunoby', position: 'SF', overall_rating: 85, salary: 36637931, years: 4 },
    { team: 'Cleveland Cavaliers', name: 'Donovan Mitchell', position: 'SG', overall_rating: 92, salary: 32600060, years: 2 },
    { team: 'Indiana Pacers', name: 'Tyrese Haliburton', position: 'PG', overall_rating: 91, salary: 35250000, years: 4 },
    { team: 'San Antonio Spurs', name: 'Victor Wembanyama', position: 'C', overall_rating: 91, salary: 12160800, years: 3 },
    { team: 'Memphis Grizzlies', name: 'Ja Morant', position: 'PG', overall_rating: 91, salary: 34005250, years: 4 },
    { team: 'Atlanta Hawks', name: 'Trae Young', position: 'PG', overall_rating: 89, salary: 40064220, years: 3 },
    { team: 'New Orleans Pelicans', name: 'Zion Williamson', position: 'PF', overall_rating: 88, salary: 34005250, years: 4 },
    { team: 'Sacramento Kings', name: 'De\'Aaron Fox', position: 'PG', overall_rating: 89, salary: 32600060, years: 2 },
    { team: 'Houston Rockets', name: 'Alperen Şengün', position: 'C', overall_rating: 86, salary: 36000000, years: 4 },
    { team: 'Orlando Magic', name: 'Paolo Banchero', position: 'PF', overall_rating: 88, salary: 11608080, years: 3 },
    { team: 'Detroit Pistons', name: 'Cade Cunningham', position: 'PG', overall_rating: 86, salary: 13940800, years: 3 },
    { team: 'Charlotte Hornets', name: 'LaMelo Ball', position: 'PG', overall_rating: 87, salary: 35250000, years: 4 },
    { team: 'Toronto Raptors', name: 'Scottie Barnes', position: 'SF', overall_rating: 86, salary: 10130980, years: 2 },
    { team: 'Utah Jazz', name: 'Lauri Markkanen', position: 'PF', overall_rating: 86, salary: 42176400, years: 4 },
    { team: 'Portland Trail Blazers', name: 'Scoot Henderson', position: 'PG', overall_rating: 79, salary: 9770880, years: 3 },
    { team: 'Washington Wizards', name: 'Kyle Kuzma', position: 'PF', overall_rating: 81, salary: 23522727, years: 3 },
    { team: 'Brooklyn Nets', name: 'Cam Thomas', position: 'SG', overall_rating: 82, salary: 4041249, years: 1 },
    { team: 'Chicago Bulls', name: 'Zach LaVine', position: 'SG', overall_rating: 83, salary: 40064220, years: 3 },
    { team: 'LA Clippers', name: 'James Harden', position: 'PG', overall_rating: 87, salary: 35000000, years: 2 },
  ];

  for (const p of playersList) {
    const team = createdTeamsMap[p.team];
    if (team) {
      await prisma.player.create({
        data: {
          name: p.name,
          position: p.position,
          overall_rating: p.overall_rating,
          salary: p.salary,
          salaries: Array(p.years).fill(p.salary),
          contract_years_left: p.years,
          team_id: team.id,
          option_type: 'NONE',
          is_prospect: false,
          is_trade_restricted: false,
        }
      });
    }
  }

  // 4. Draft Picks (2026 and 2027 for all 30 teams)
  const allTeams = Object.values(createdTeamsMap);
  const picksData: any[] = [];
  const years = [2026, 2027];

  for (const year of years) {
    for (let round = 1; round <= 2; round++) {
      for (const team of allTeams) {
        picksData.push({
          name: `${round}-й раунд`,
          year,
          team_id: team.id,
          is_used: false,
          selected_player_id: null
        });
      }
    }
  }

  await prisma.draftPick.createMany({ data: picksData });

  // 5. Draft Prospects
  const prospectsData = [
    { name: 'Cooper Flagg', position: 'PF', overall_rating: 81, salary: 0, contract_years_left: 0, is_prospect: true },
    { name: 'Ace Bailey', position: 'SF', overall_rating: 79, salary: 0, contract_years_left: 0, is_prospect: true },
    { name: 'Dylan Harper', position: 'PG', overall_rating: 77, salary: 0, contract_years_left: 0, is_prospect: true },
    { name: 'VJ Edgecombe', position: 'SG', overall_rating: 76, salary: 0, contract_years_left: 0, is_prospect: true },
    { name: 'Tre Johnson', position: 'SG', overall_rating: 74, salary: 0, contract_years_left: 0, is_prospect: true },
    { name: 'Khaman Maluach', position: 'C', overall_rating: 75, salary: 0, contract_years_left: 0, is_prospect: true },
    { name: 'Nolan Traore', position: 'PG', overall_rating: 74, salary: 0, contract_years_left: 0, is_prospect: true },
    { name: 'Drake Powell', position: 'SG', overall_rating: 73, salary: 0, contract_years_left: 0, is_prospect: true }
  ];

  await prisma.player.createMany({
    data: prospectsData.map(p => ({
      ...p,
      salaries: [],
      option_type: 'NONE'
    })),
  });

  console.log('Stock seed completed successfully! 30 teams, stock players, draft picks, and commissioner initialized.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

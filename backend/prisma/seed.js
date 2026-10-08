"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting seed...');
    // Clear existing data to make seed idempotent
    await prisma.freeAgencyLot.deleteMany();
    await prisma.insiderPost.deleteMany();
    await prisma.contractOffer.deleteMany();
    await prisma.tradeOffer.deleteMany();
    await prisma.draftPick.deleteMany();
    await prisma.player.deleteMany();
    await prisma.team.deleteMany();
    await prisma.user.deleteMany();
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
            min_salary_schedule: [1.15, 1.25, 1.35, 1.45, 1.55],
            tax_mle_schedule: [5.3, 5.6, 5.9],
            full_mle_schedule: [12.9, 13.6, 14.3, 15.0],
            rookie_max_schedule: [35.5, 38.3, 41.1, 44.0],
            medium_max_schedule: [42.5, 45.9, 49.3, 52.7, 56.1],
            veteran_max_schedule: [50.0, 54.0, 58.0, 62.0, 66.0],
            supermax_schedule: [60.0, 64.8, 69.6, 74.4, 79.2]
        }
    });
    // 1. Create a test user
    const adminUser = await prisma.user.create({
        data: {
            telegram_id: '123456789',
            username: 'admin_test',
            role: 'ADMIN',
        },
    });
    const playerUser = await prisma.user.create({
        data: {
            telegram_id: '987654321',
            username: 'manager_test',
            role: 'PLAYER',
        },
    });
    // 2. Create 4 NBA Teams
    const lakers = await prisma.team.create({
        data: {
            name: 'Los Angeles Lakers',
            logo_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Los_Angeles_Lakers_logo.svg',
            budget: 150000000,
            salary_cap: 140000000,
            owner_id: adminUser.id,
        },
    });
    const celtics = await prisma.team.create({
        data: {
            name: 'Boston Celtics',
            logo_url: 'https://upload.wikimedia.org/wikipedia/en/8/8f/Boston_Celtics.svg',
            budget: 150000000,
            salary_cap: 140000000,
            owner_id: playerUser.id,
        },
    });
    const warriors = await prisma.team.create({
        data: {
            name: 'Golden State Warriors',
            logo_url: 'https://upload.wikimedia.org/wikipedia/en/0/01/Golden_State_Warriors_logo.svg',
            budget: 150000000,
            salary_cap: 140000000,
        },
    });
    const heat = await prisma.team.create({
        data: {
            name: 'Miami Heat',
            logo_url: 'https://upload.wikimedia.org/wikipedia/en/6/67/Miami_Heat_logo.svg',
            budget: 150000000,
            salary_cap: 140000000,
        },
    });
    const teams = [lakers, celtics, warriors, heat];
    // 3. Create 5 players per team
    const playersData = [
        { name: 'LeBron James', position: 'SF', overall_rating: 96, salary: 47600000, contract_years_left: 2, team_id: lakers.id },
        { name: 'Anthony Davis', position: 'PF', overall_rating: 94, salary: 40600000, contract_years_left: 4, team_id: lakers.id },
        { name: 'Austin Reaves', position: 'SG', overall_rating: 82, salary: 12000000, contract_years_left: 3, team_id: lakers.id },
        { name: 'D\'Angelo Russell', position: 'PG', overall_rating: 81, salary: 17300000, contract_years_left: 1, team_id: lakers.id },
        { name: 'Rui Hachimura', position: 'PF', overall_rating: 80, salary: 15700000, contract_years_left: 2, team_id: lakers.id },
        { name: 'Jayson Tatum', position: 'SF', overall_rating: 95, salary: 32600000, contract_years_left: 3, team_id: celtics.id },
        { name: 'Jaylen Brown', position: 'SG', overall_rating: 89, salary: 31800000, contract_years_left: 1, team_id: celtics.id },
        { name: 'Jrue Holiday', position: 'PG', overall_rating: 86, salary: 36800000, contract_years_left: 1, team_id: celtics.id },
        { name: 'Kristaps Porzingis', position: 'C', overall_rating: 86, salary: 36000000, contract_years_left: 1, team_id: celtics.id },
        { name: 'Derrick White', position: 'SG', overall_rating: 82, salary: 18300000, contract_years_left: 2, team_id: celtics.id },
        { name: 'Stephen Curry', position: 'PG', overall_rating: 96, salary: 51900000, contract_years_left: 3, team_id: warriors.id },
        { name: 'Klay Thompson', position: 'SG', overall_rating: 84, salary: 43200000, contract_years_left: 1, team_id: warriors.id },
        { name: 'Draymond Green', position: 'PF', overall_rating: 83, salary: 22300000, contract_years_left: 4, team_id: warriors.id },
        { name: 'Andrew Wiggins', position: 'SF', overall_rating: 82, salary: 24300000, contract_years_left: 4, team_id: warriors.id },
        { name: 'Jonathan Kuminga', position: 'PF', overall_rating: 81, salary: 6000000, contract_years_left: 2, team_id: warriors.id },
        { name: 'Jimmy Butler', position: 'SF', overall_rating: 94, salary: 45100000, contract_years_left: 3, team_id: heat.id },
        { name: 'Bam Adebayo', position: 'C', overall_rating: 87, salary: 32600000, contract_years_left: 3, team_id: heat.id },
        { name: 'Tyler Herro', position: 'SG', overall_rating: 84, salary: 27000000, contract_years_left: 4, team_id: heat.id },
        { name: 'Terry Rozier', position: 'PG', overall_rating: 82, salary: 23200000, contract_years_left: 3, team_id: heat.id },
        { name: 'Duncan Robinson', position: 'SG', overall_rating: 78, salary: 18100000, contract_years_left: 3, team_id: heat.id },
    ];
    await prisma.player.createMany({
        data: playersData.map(p => ({
            ...p,
            salaries: Array(p.contract_years_left).fill(p.salary),
            option_type: 'NONE'
        })),
    });
    const currentYear = new Date().getFullYear();
    const picksData = [];
    for (const team of teams) {
        for (let year = currentYear; year <= currentYear + 1; year++) {
            for (let round = 1; round <= 2; round++) {
                picksData.push({
                    name: `${round}-й раунд`,
                    year,
                    team_id: team.id,
                });
            }
        }
    }
    await prisma.draftPick.createMany({
        data: picksData,
    });
    // 5. Create Draft Prospects
    const prospectsData = [
        { name: 'Cooper Flagg', position: 'PF', overall_rating: 81, salary: 0, contract_years_left: 0, is_prospect: true },
        { name: 'Ace Bailey', position: 'SF', overall_rating: 79, salary: 0, contract_years_left: 0, is_prospect: true },
        { name: 'Dylan Harper', position: 'PG', overall_rating: 77, salary: 0, contract_years_left: 0, is_prospect: true },
        { name: 'VJ Edgecombe', position: 'SG', overall_rating: 76, salary: 0, contract_years_left: 0, is_prospect: true },
        { name: 'Tre Johnson', position: 'SG', overall_rating: 74, salary: 0, contract_years_left: 0, is_prospect: true },
        { name: 'Khaman Maluach', position: 'C', overall_rating: 75, salary: 0, contract_years_left: 0, is_prospect: true }
    ];
    await prisma.player.createMany({
        data: prospectsData.map(p => ({
            ...p,
            salaries: [],
            option_type: 'NONE'
        })),
    });
    console.log('Seed completed successfully!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});

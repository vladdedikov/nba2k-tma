import { useState, useEffect } from 'react';

export default function RostersTab() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // WebApp fallback
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.ready();
    }

    fetch('http://localhost:3000/teams')
      .then(res => {
        if (!res.ok) throw new Error('Ошибка сети');
        return res.json();
      })
      .then(data => {
        setTeams(data || []);
        if (data && data.length > 0) {
          setSelectedTeamId(data[0].id);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Сбой подключения к серверу. Убедитесь, что бэкенд запущен.');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3390ec]"></div></div>;
  if (error) return <div className="p-4 text-center text-[#ff3b30] mt-10 font-medium">{error}</div>;
  if (!teams || teams.length === 0) return <div className="p-4 text-center text-[#8e8e93] mt-10">Команды отсутствуют.</div>;

  const team = teams.find(t => t.id === selectedTeamId);
  if (!team) return null;

  const players = team.players || [];
  const draftPicks = team.currentPicks || team.current_picks || [];
  
  const totalPayroll = players.reduce((sum: number, p: any) => sum + (p.salary || 0), 0);
  const capSpace = (team.salary_cap || 0) - totalPayroll;

  const formatMoney = (amount: number) => `$${(amount / 1000000).toFixed(1)}M`;

  return (
    <div className="p-4 space-y-5" style={{ backgroundColor: '#181818' }}>
      {/* Selector */}
      <div className="relative">
        <select 
          className="w-full p-3.5 bg-[#212121] border border-[#303030] rounded-xl text-white font-semibold appearance-none outline-none focus:border-[#3390ec]"
          value={selectedTeamId}
          onChange={e => setSelectedTeamId(e.target.value)}
        >
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t?.name || 'Unknown'}</option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8e8e93]">
          <svg width="24" height="24" style={{ minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24 }} className="shrink-0 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
        </div>
      </div>

      {/* Cap Info */}
      <div className="bg-[#212121] p-4 rounded-2xl flex items-center gap-4 shadow-sm">
        {team?.logo_url ? (
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center p-1.5 shrink-0">
            <img src={team.logo_url} className="w-full h-full object-contain" alt="" />
          </div>
        ) : (
          <div className="w-14 h-14 bg-[#303030] rounded-full shrink-0"></div>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">{team.name}</h2>
          <div className="mt-1 text-[13px] space-y-1">
            <div className="flex justify-between text-[#8e8e93]">
              <span>Кепка:</span>
              <span className="text-white">{formatMoney(team.salary_cap || 0)}</span>
            </div>
            <div className="flex justify-between text-[#8e8e93]">
              <span>Платежка:</span>
              <span className={totalPayroll > (team.salary_cap || 0) ? 'text-[#ff3b30]' : 'text-white'}>
                {formatMoney(totalPayroll)}
              </span>
            </div>
            <div className="flex justify-between text-[#8e8e93]">
              <span>Свободно:</span>
              <span className={capSpace < 0 ? 'text-[#ff3b30]' : 'text-[#34c759]'}>
                {formatMoney(capSpace)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Roster List */}
      <div>
        <h3 className="text-[15px] font-bold text-[#8e8e93] uppercase tracking-wide mb-3 ml-1">Состав</h3>
        <div className="space-y-2.5">
          {players.sort((a: any, b: any) => (b.overall_rating || 0) - (a.overall_rating || 0)).map((p: any) => (
            <div key={p.id} className="bg-[#212121] p-3 rounded-xl flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold bg-[#303030] text-[#8e8e93] w-7 text-center py-1 rounded shrink-0">
                  {p.position}
                </span>
                <div className="flex flex-col">
                  <span className="font-semibold text-white text-[15px]">{p.name}</span>
                  <span className="text-[12px] text-[#8e8e93] mt-0.5">
                    {formatMoney(p.salary)} • {p.contract_years_left} лет
                  </span>
                </div>
              </div>
              <div className="text-lg font-black text-[#3390ec]">{p.overall_rating}</div>
            </div>
          ))}
          {players.length === 0 && <div className="text-[#8e8e93] text-sm px-1">Игроков нет</div>}
        </div>
      </div>

      {/* Picks */}
      <div>
        <h3 className="text-[15px] font-bold text-[#8e8e93] uppercase tracking-wide mb-3 ml-1">Пики</h3>
        <div className="flex flex-wrap gap-2">
          {draftPicks.length > 0 ? draftPicks.sort((a: any, b: any) => a.year - b.year || a.round - b.round).map((pick: any) => (
            <div key={pick.id} className="bg-[#212121] px-3 py-1.5 rounded-lg text-[13px] border border-[#303030] flex items-center gap-1.5">
              <span className="font-bold text-white">{pick.year}</span>
              <span className="text-[#8e8e93]">R{pick.round}</span>
            </div>
          )) : (
            <div className="text-[#8e8e93] text-[13px] px-1">Нет пиков</div>
          )}
        </div>
      </div>

      {/* Manager Button */}
      <div className="pt-2 pb-6">
        {team.owner?.username ? (
          <a 
            href={`https://t.me/${team.owner.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full bg-[#3390ec] text-white py-3.5 rounded-xl font-bold justify-center items-center hover:bg-[#2b7bc4] active:scale-[0.98] transition-transform"
          >
            Связаться с менеджером
          </a>
        ) : (
          <div className="w-full bg-[#303030] text-[#8e8e93] py-3.5 rounded-xl font-bold text-center">
            Менеджер не назначен
          </div>
        )}
      </div>
    </div>
  );
}

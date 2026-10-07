import { useState, useEffect, Fragment } from 'react';
import { Pencil, Trash2, Plus, X, ArrowRightLeft } from 'lucide-react';

export default function RostersTab({ role }: { role: string }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    position: 'PG',
    overall_rating: 75,
    salaries: ['', '', '', '', ''], // string to allow empty
    option_type: 'NONE'
  });

  const [transferTargetId, setTransferTargetId] = useState('');

  const fetchSettingsAndTeams = async () => {
    try {
      const [setRes, teamsRes] = await Promise.all([
        fetch('http://localhost:3000/league/settings'),
        fetch('http://localhost:3000/teams')
      ]);
      const setJson = await setRes.json();
      const teamsJson = await teamsRes.json();
      
      const safeTeams = Array.isArray(teamsJson) ? teamsJson : (teamsJson.teams || []);
      
      setSettings(setJson);
      setTeams(safeTeams);
      if (safeTeams && safeTeams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(safeTeams[0].id);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Сбой подключения к серверу. Убедитесь, что бэкенд запущен.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.ready();
    }
    fetchSettingsAndTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'ADMIN') return;
    
    const parsedSalaries = formData.salaries
      .filter(s => s !== '')
      .map(s => Number(s) * 1000000);

    if (parsedSalaries.length === 0) {
      alert('Укажите хотя бы одну зарплату');
      return;
    }

    const payload = {
      name: formData.name,
      position: formData.position,
      overall_rating: Number(formData.overall_rating),
      salaries: parsedSalaries,
      option_type: formData.option_type,
      team_id: selectedTeamId
    };

    try {
      if (editingPlayer) {
        await fetch(`http://localhost:3000/admin/players/${editingPlayer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-user-role': role },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('http://localhost:3000/admin/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': role },
          body: JSON.stringify(payload)
        });
      }
      setIsModalOpen(false);
      fetchSettingsAndTeams();
    } catch (err) {
      alert('Ошибка при сохранении игрока');
    }
  };

  const handleDeletePlayer = async (id: string) => {
    if (role !== 'ADMIN') return;
    if (confirm('Вы уверены, что хотите удалить (отчислить) этого игрока?')) {
      try {
        await fetch(`http://localhost:3000/admin/players/${id}`, { 
          method: 'DELETE',
          headers: { 'x-user-role': role }
        });
        fetchSettingsAndTeams();
      } catch (err) {
        alert('Ошибка при удалении');
      }
    }
  };

  const handleTransferPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'ADMIN') return;
    try {
      await fetch(`http://localhost:3000/admin/players/${editingPlayer.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ target_team_id: transferTargetId })
      });
      setIsTransferModalOpen(false);
      fetchSettingsAndTeams();
    } catch (err) {
      alert('Ошибка перевода');
    }
  };

  const openAddModal = () => {
    setEditingPlayer(null);
    setFormData({ name: '', position: 'PG', overall_rating: 75, salaries: ['5', '', '', '', ''], option_type: 'NONE' });
    setIsModalOpen(true);
  };

  const openEditModal = (player: any) => {
    setEditingPlayer(player);
    const sals = player.salaries || [player.salary];
    const formSals = ['', '', '', '', ''];
    sals.forEach((s: number, i: number) => {
      if (i < 5) formSals[i] = (s / 1000000).toString();
    });
    setFormData({
      name: player.name,
      position: player.position,
      overall_rating: player.overall_rating,
      salaries: formSals,
      option_type: player.option_type || 'NONE'
    });
    setIsModalOpen(true);
  };

  const openTransferModal = (player: any) => {
    setEditingPlayer(player);
    setTransferTargetId(teams.filter(t => t.id !== selectedTeamId)[0]?.id || '');
    setIsTransferModalOpen(true);
  };

  if (loading) return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3390ec] mb-4"></div>
      <div className="text-sm font-bold">Загрузка лиги...</div>
    </div>
  );
  if (error) return <div className="p-4 text-center text-[#ff3b30] mt-10 font-medium">{error}</div>;
  if (!Array.isArray(teams) || teams.length === 0) return <div className="p-4 text-center text-[#8e8e93] mt-10">Команды отсутствуют.</div>;

  const team = Array.isArray(teams) ? teams.find((t) => t.id === selectedTeamId) || teams[0] : null;
  if (!team) return <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">Загрузка команд...</div>;

  const players = team?.players ?? [];
  const draftPicks = team?.currentPicks ?? team?.current_picks ?? [];
  
  const totalPayroll = players.reduce((sum: number, p: any) => sum + (p.salary || 0), 0);
  
  const formatMoney = (amount: number) => `$${(amount / 1000000).toFixed(1)}M`;

  const safeSoftCap = settings?.soft_cap ?? 140000000;
  const safeLuxuryTax = settings?.luxury_tax ?? 170000000;
  const safeFirstApron = settings?.first_apron ?? 178000000;
  const safeHardCap = settings?.hard_cap ?? 200000000;

  const capPercentage = Math.min((totalPayroll / safeHardCap) * 100, 100);

  return (
    <div className="p-4 space-y-5" style={{ backgroundColor: '#181818' }}>
      {/* Selector */}
      <div className="relative">
        <select 
          className="w-full p-3.5 bg-[#212121] border border-[#303030] rounded-xl text-white font-semibold appearance-none outline-none focus:border-[#3390ec]"
          value={selectedTeamId || team.id}
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
      <div className="bg-[#212121] p-4 rounded-2xl flex flex-col gap-4 shadow-sm">
        <div className="flex items-center gap-4">
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
                <span>Платежка:</span>
                <span className={totalPayroll > safeSoftCap ? 'text-[#ff3b30] font-bold' : 'text-white font-bold'}>
                  {formatMoney(totalPayroll)}
                </span>
              </div>
              <div className="flex justify-between text-[#8e8e93]">
                <span>Место (от Soft Cap):</span>
                <span className={safeSoftCap - totalPayroll < 0 ? 'text-[#ff3b30]' : 'text-[#34c759]'}>
                  {formatMoney(safeSoftCap - totalPayroll)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-3 bg-[#303030] rounded-full mt-2 overflow-hidden">
          <div 
            className={`absolute top-0 left-0 h-full rounded-full transition-all ${totalPayroll > safeSoftCap ? 'bg-[#ff3b30]' : 'bg-[#3390ec]'}`}
            style={{ width: `${capPercentage}%` }}
          ></div>
          {/* Threshold markers */}
          <div className="absolute top-0 bottom-0 border-l-2 border-white/50" style={{ left: `${(safeSoftCap / safeHardCap) * 100}%` }}></div>
          <div className="absolute top-0 bottom-0 border-l-2 border-[#ffd60a]/50" style={{ left: `${(safeLuxuryTax / safeHardCap) * 100}%` }}></div>
          <div className="absolute top-0 bottom-0 border-l-2 border-[#ff9f0a]/50" style={{ left: `${(safeFirstApron / safeHardCap) * 100}%` }}></div>
        </div>
        <div className="flex justify-between text-[10px] text-[#8e8e93] px-1 font-semibold">
          <span>0</span>
          <span>CAP ({formatMoney(safeSoftCap)})</span>
          <span>TAX ({formatMoney(safeLuxuryTax)})</span>
          <span>HARD ({formatMoney(safeHardCap)})</span>
        </div>
      </div>

      {/* Roster List Header */}
      <div className="flex justify-between items-center px-1">
        <h3 className="text-[15px] font-bold text-[#8e8e93] uppercase tracking-wide">Состав</h3>
        {role === 'ADMIN' && (
          <button onClick={openAddModal} className="flex items-center gap-1 text-[#3390ec] font-bold text-[13px] bg-[#3390ec]/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
            <Plus width="16" height="16" style={{ minWidth: 16, minHeight: 16, maxWidth: 16, maxHeight: 16 }} />
            Добавить
          </button>
        )}
      </div>

      {/* Roster List */}
      <div>
        <div className="space-y-2.5">
          {[...players].sort((a: any, b: any) => (b.overall_rating || 0) - (a.overall_rating || 0)).map((p: any) => {
            const sals = p.salaries || [p.salary];
            const opt = p.option_type === 'PLAYER_OPTION' ? ' (PO)' : p.option_type === 'TEAM_OPTION' ? ' (TO)' : '';
            const salsStr = sals.map((s: number) => `$${(s/1000000).toFixed(1)}M`).join(' → ') + opt;

            return (
              <div key={p.id} className="bg-[#212121] p-3 rounded-xl flex flex-col group gap-2 shadow-sm border border-[#303030]/50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold bg-[#303030] text-[#8e8e93] w-7 text-center py-1 rounded shrink-0">
                      {p.position}
                    </span>
                    <span className="font-semibold text-white text-[15px]">{p.name}</span>
                  </div>
                  <div className="text-lg font-black text-[#3390ec]">{p.overall_rating}</div>
                </div>
                
                <div className="flex justify-between items-end">
                  <div className="text-[11px] text-[#8e8e93] font-mono tracking-tight leading-relaxed max-w-[70%]">
                    <div className="text-white mb-0.5">{sals.length} года:</div>
                    {salsStr}
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(p.option_type === 'PLAYER_OPTION' || p.option_type === 'TEAM_OPTION') && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-[#ff9f0a]/20 text-[#ff9f0a] mr-2 shrink-0">
                        ⚠️ {p.option_type === 'PLAYER_OPTION' ? 'PO' : 'TO'}
                      </span>
                    )}
                    {p.is_trade_restricted && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-[#ff3b30]/20 text-[#ff3b30] mr-2 shrink-0" title="Мораторий на обмен (2 мес)">
                        🔒 Мораторий
                      </span>
                    )}
                    {role === 'ADMIN' && (
                      <>
                        <button onClick={() => openTransferModal(p)} className="p-1.5 text-[#3390ec] hover:text-white bg-[#3390ec]/10 rounded-md transition-colors active:scale-95" title="Обмен">
                          <ArrowRightLeft width="14" height="14" style={{ minWidth: 14, minHeight: 14, maxWidth: 14, maxHeight: 14 }} />
                        </button>
                        <button onClick={() => openEditModal(p)} className="p-1.5 text-[#8e8e93] hover:text-white bg-[#303030] rounded-md transition-colors active:scale-95" title="Редактировать">
                          <Pencil width="14" height="14" style={{ minWidth: 14, minHeight: 14, maxWidth: 14, maxHeight: 14 }} />
                        </button>
                        <button onClick={() => handleDeletePlayer(p.id)} className="p-1.5 text-[#ff3b30] hover:text-white bg-[#ff3b30]/10 rounded-md transition-colors active:scale-95" title="Отчислить">
                          <Trash2 width="14" height="14" style={{ minWidth: 14, minHeight: 14, maxWidth: 14, maxHeight: 14 }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* Player Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
          <div className="bg-[#212121] w-full max-w-sm rounded-2xl p-5 relative shadow-xl border border-[#303030] max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-[#8e8e93] hover:text-white transition-colors">
              <X width="24" height="24" style={{ minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24 }} />
            </button>
            <h2 className="text-xl font-bold mb-5 text-white">{editingPlayer ? 'Редактировать' : 'Новый игрок'}</h2>
            
            <form onSubmit={handleSavePlayer} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5 uppercase">Имя</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-[#181818] border border-[#303030] rounded-xl text-white outline-none focus:border-[#3390ec] transition-colors" />
              </div>
              
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5 uppercase">Позиция</label>
                  <select value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} className="w-full p-3 bg-[#181818] border border-[#303030] rounded-xl text-white outline-none focus:border-[#3390ec] transition-colors">
                    <option>PG</option><option>SG</option><option>SF</option><option>PF</option><option>C</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5 uppercase">OVR</label>
                  <input required type="number" min="40" max="99" value={formData.overall_rating} onChange={e => setFormData({...formData, overall_rating: Number(e.target.value)})} className="w-full p-3 bg-[#181818] border border-[#303030] rounded-xl text-white outline-none focus:border-[#3390ec] transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5 uppercase">Зарплаты по годам ($M)</label>
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4].map(i => (
                    <input 
                      key={i} 
                      type="number" step="0.1" min="0" placeholder={`Год ${i+1}`}
                      value={formData.salaries[i]} 
                      onChange={e => {
                        const newSals = [...formData.salaries];
                        newSals[i] = e.target.value;
                        setFormData({...formData, salaries: newSals});
                      }} 
                      className="w-full p-2 bg-[#181818] border border-[#303030] rounded-lg text-white text-center text-sm outline-none focus:border-[#3390ec] transition-colors" 
                    />
                  ))}
                </div>
                <p className="text-[10px] text-[#8e8e93] mt-1.5">Пустые поля игнорируются (например, если контракт на 2 года, заполните только 1 и 2 год).</p>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5 uppercase">Тип опции (последний год)</label>
                <select value={formData.option_type} onChange={e => setFormData({...formData, option_type: e.target.value})} className="w-full p-3 bg-[#181818] border border-[#303030] rounded-xl text-white outline-none focus:border-[#3390ec] transition-colors">
                  <option value="NONE">Нет опции</option>
                  <option value="PLAYER_OPTION">Опция игрока (PO)</option>
                  <option value="TEAM_OPTION">Опция команды (TO)</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-[#3390ec] text-white py-3.5 rounded-xl font-bold mt-2 hover:bg-[#2b7bc4] active:scale-[0.98] transition-transform">
                {editingPlayer ? 'Сохранить изменения' : 'Создать'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
          <div className="bg-[#212121] w-full max-w-sm rounded-2xl p-5 relative shadow-xl border border-[#303030]">
            <button onClick={() => setIsTransferModalOpen(false)} className="absolute top-4 right-4 text-[#8e8e93] hover:text-white transition-colors">
              <X width="24" height="24" style={{ minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24 }} />
            </button>
            <h2 className="text-xl font-bold mb-5 text-white">Перевод игрока</h2>
            <p className="text-sm text-[#8e8e93] mb-4">Выберите команду, в которую перейдет {editingPlayer?.name}:</p>
            <form onSubmit={handleTransferPlayer} className="space-y-4">
              <select 
                value={transferTargetId} 
                onChange={e => setTransferTargetId(e.target.value)} 
                className="w-full p-3.5 bg-[#181818] border border-[#303030] rounded-xl text-white font-semibold outline-none focus:border-[#3390ec]"
              >
                {teams.filter(t => t.id !== selectedTeamId).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button type="submit" className="w-full bg-[#34c759] text-white py-3.5 rounded-xl font-bold hover:bg-[#2eb050] active:scale-[0.98] transition-transform">
                Подтвердить обмен
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

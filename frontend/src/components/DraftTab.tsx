import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

export default function DraftTab({ role, myTeamId }: { role: string, myTeamId?: string }) {
  const [board, setBoard] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);

  // Draft Prep State
  const [newProspectName, setNewProspectName] = useState('');
  const [newProspectPos, setNewProspectPos] = useState('PG');
  const [newProspectOvr, setNewProspectOvr] = useState<number>(75);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [boardRes, propsRes, teamsRes] = await Promise.all([
        fetch('http://localhost:3000/draft/board'),
        fetch('http://localhost:3000/draft/prospects'),
        fetch('http://localhost:3000/teams')
      ]);
      const boardData = await boardRes.json();
      const propsData = await propsRes.json();
      const teamsData = await teamsRes.json();
      
      setBoard(boardData.picks || []);
      setSettings(boardData.settings || null);
      setProspects(Array.isArray(propsData) ? propsData : []);
      setTeams(Array.isArray(teamsData) ? teamsData : (teamsData.teams || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePickTeamChange = (pickIndex: number, newTeamId: string) => {
    const newBoard = [...board];
    newBoard[pickIndex].team_id = newTeamId;
    newBoard[pickIndex].team = teams.find(t => t.id === newTeamId) || newBoard[pickIndex].team;
    setBoard(newBoard);
  };

  const startDraft = async () => {
    if (role !== 'ADMIN') return;
    try {
      setLoading(true);
      await fetch('http://localhost:3000/admin/draft/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ picks: board.map(p => ({ id: p.id, team_id: p.team_id })) })
      });
      await fetchData();
    } catch (e) {
      alert('Ошибка при старте драфта');
      setLoading(false);
    }
  };

  const addProspect = async () => {
    if (!newProspectName.trim()) return;
    try {
      setLoading(true);
      await fetch('http://localhost:3000/admin/draft/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ name: newProspectName, position: newProspectPos, overall_rating: newProspectOvr })
      });
      setNewProspectName('');
      await fetchData();
    } catch (e) {
      alert('Ошибка добавления');
      setLoading(false);
    }
  };

  const removeProspect = async (id: string) => {
    if (!confirm('Точно удалить игрока из пула?')) return;
    try {
      setLoading(true);
      await fetch(`http://localhost:3000/admin/draft/prospects/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': role }
      });
      await fetchData();
    } catch (e) {
      alert('Ошибка удаления');
      setLoading(false);
    }
  };

  const draftPlayer = async (playerId: string) => {
    if (!settings || settings.draft_is_completed) return;
    const currentPick = board[settings.current_draft_pick_index];
    if (!currentPick) return;
    
    if (role !== 'ADMIN' && myTeamId !== currentPick.team_id) {
      alert('Сейчас не ваш выбор!');
      return;
    }

    try {
      setLoading(true);
      await fetch('http://localhost:3000/draft/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ pick_id: currentPick.id, player_id: playerId })
      });
      await fetchData();
    } catch (e) {
      alert('Ошибка выбора игрока');
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3390ec] mb-4"></div>
      <div className="text-sm font-bold">Синхронизация с сервером...</div>
    </div>
  );

  if (!settings) return null;

  if (!settings.draft_order_approved) {
    if (role !== 'ADMIN') {
      return (
        <div className="p-8 h-full flex flex-col items-center justify-center text-center text-[#8e8e93]">
          <span className="text-4xl mb-4">🎟</span>
          <div className="text-sm font-bold mb-2">Комиссионер формирует класс новичков и порядок пиков.</div>
          <div className="text-[12px]">Ожидайте старта драфта.</div>
        </div>
      );
    }

    // Admin PREP view
    return (
      <div className="p-4 h-full overflow-y-auto bg-[#181818] pb-[100px]">
        {/* Block 1: Board Setup */}
        <div className="mb-6">
          <div className="text-[15px] font-bold text-white mb-3">Настройка драфт-доски</div>
          <div className="space-y-2 mb-4">
            {board.map((pick, i) => (
              <div key={pick.id} className="bg-[#212121] p-3 rounded-xl border border-[#303030] flex items-center gap-3">
                <span className="font-bold text-[#8e8e93] shrink-0 w-8">#{i + 1}</span>
                <select 
                  value={pick.team_id} 
                  onChange={(e) => handlePickTeamChange(i, e.target.value)}
                  className="flex-1 bg-[#181818] border border-[#303030] text-white text-[13px] rounded-lg p-2 outline-none font-bold"
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button onClick={startDraft} className="w-full py-3.5 bg-[#34c759] text-white font-bold rounded-xl active:scale-[0.98] transition-transform shadow-lg">
            ✅ Утвердить порядок пиков и начать драфт
          </button>
        </div>

        {/* Block 2: Draft Class */}
        <div className="mb-6 pt-6 border-t border-[#303030]">
          <div className="text-[15px] font-bold text-white mb-3">Добавление новичков (Draft Class)</div>
          
          <div className="bg-[#212121] p-4 rounded-xl border border-[#303030] mb-4 space-y-3">
            <input 
              type="text" placeholder="Имя и фамилия игрока" 
              value={newProspectName} onChange={e => setNewProspectName(e.target.value)}
              className="w-full bg-[#181818] border border-[#303030] p-2.5 rounded-lg text-white text-[13px] outline-none"
            />
            <div className="flex gap-2">
              <select 
                value={newProspectPos} onChange={e => setNewProspectPos(e.target.value)}
                className="flex-1 bg-[#181818] border border-[#303030] p-2.5 rounded-lg text-white text-[13px] outline-none"
              >
                <option value="PG">PG</option>
                <option value="SG">SG</option>
                <option value="SF">SF</option>
                <option value="PF">PF</option>
                <option value="C">C</option>
              </select>
              <input 
                type="number" min="40" max="99"
                value={newProspectOvr} onChange={e => setNewProspectOvr(parseInt(e.target.value))}
                className="w-20 bg-[#181818] border border-[#303030] p-2.5 rounded-lg text-white text-[13px] outline-none text-center"
              />
            </div>
            <button onClick={addProspect} className="w-full py-2.5 bg-[#3390ec] text-white font-bold rounded-lg text-[13px] active:scale-[0.98]">
              + Добавить в пул драфта
            </button>
          </div>

          <div className="space-y-2">
            {prospects.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-[#212121] p-3 rounded-lg border border-[#303030]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#3390ec]/20 text-[#3390ec] font-bold text-[12px] flex items-center justify-center">{p.overall_rating}</div>
                  <div>
                    <div className="text-white text-[13px] font-bold">{p.name}</div>
                    <div className="text-[#8e8e93] text-[11px]">{p.position}</div>
                  </div>
                </div>
                <button onClick={() => removeProspect(p.id)} className="p-2 text-[#ff3b30]/70 hover:text-[#ff3b30] bg-[#ff3b30]/10 rounded-lg transition-colors">
                  <Trash2 width="16" height="16" />
                </button>
              </div>
            ))}
            {prospects.length === 0 && (
              <div className="text-center text-[#8e8e93] text-[12px] py-4">Пул новичков пуст</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active Draft View
  const currentPick = board[settings.current_draft_pick_index];
  
  return (
    <div className="flex flex-col h-full bg-[#181818] pb-[100px]">
      {/* Top Banner */}
      <div className="bg-[#212121] border-b border-[#303030] p-4 flex gap-2 overflow-x-auto shadow-sm">
        {board.map((pick, i) => {
          const isCurrent = !settings.draft_is_completed && i === settings.current_draft_pick_index;
          const isUsed = pick.is_used;
          return (
            <div key={pick.id} className={`shrink-0 w-[100px] p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${isCurrent ? 'bg-[#3390ec]/20 border-[#3390ec] scale-105' : isUsed ? 'bg-[#181818] border-[#303030] opacity-60' : 'bg-[#212121] border-[#303030]'}`}>
              <div className="text-[10px] text-[#8e8e93] font-bold mb-1">ПИК #{i + 1}</div>
              <div className="text-[12px] font-bold text-white line-clamp-2">{pick.team?.name}</div>
            </div>
          );
        })}
      </div>

      {settings.draft_is_completed ? (
        <div className="p-8 flex flex-col items-center text-center mt-10">
          <span className="text-5xl mb-4">🎉</span>
          <div className="text-[18px] font-bold text-white mb-2">Драфт успешно завершен!</div>
          <div className="text-[13px] text-[#8e8e93]">Все выборы сделаны. Новички добавлены в составы.</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* On The Clock Banner */}
          <div className="bg-[#3390ec]/10 border-b border-[#3390ec]/30 p-3 flex justify-center items-center gap-2">
            <span className="animate-pulse text-[16px]">⏱</span>
            <span className="text-[#3390ec] font-bold text-[14px]">НА ЧАСАХ: {currentPick?.team?.name} (Пик #{settings.current_draft_pick_index + 1})</span>
          </div>

          {/* Prospects List */}
          <div className="p-4 overflow-y-auto flex-1">
            <div className="text-[15px] font-bold text-white mb-4">Доступные проспекты</div>
            <div className="grid grid-cols-2 gap-3">
              {prospects.map(p => (
                <div key={p.id} className="bg-[#212121] p-3 rounded-2xl border border-[#303030] flex flex-col items-center text-center shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-[#303030] px-2 py-1 rounded-bl-lg text-[10px] font-bold text-[#8e8e93]">{p.position}</div>
                  <div className="w-12 h-12 bg-[#3390ec]/10 rounded-full flex items-center justify-center text-[18px] font-bold text-[#3390ec] mt-2 mb-2">
                    {p.overall_rating}
                  </div>
                  <div className="text-[13px] font-bold text-white mb-3 line-clamp-1">{p.name}</div>
                  
                  <button 
                    onClick={() => draftPlayer(p.id)}
                    disabled={role !== 'ADMIN' && myTeamId !== currentPick?.team_id}
                    className="w-full py-2 bg-[#3390ec] text-white text-[12px] font-bold rounded-xl active:scale-[0.98] disabled:bg-[#303030] disabled:text-[#8e8e93] disabled:cursor-not-allowed transition-all"
                  >
                    Выбрать игрока
                  </button>
                </div>
              ))}
              {prospects.length === 0 && (
                <div className="col-span-2 text-center text-[#8e8e93] text-[12px] py-10">В пуле нет доступных игроков</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

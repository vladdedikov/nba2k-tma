import { useState, useEffect } from 'react';
import { Trash2, ArrowLeft, Plus, Search, ChevronDown, ChevronUp } from 'lucide-react';

export default function DraftTab({ role, myTeamId }: { role: string, myTeamId?: string }) {
  const [screen, setScreen] = useState<'BOARD' | 'POOL'>('BOARD');
  const [selectedPick, setSelectedPick] = useState<any>(null);

  const [board, setBoard] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDrafting, setIsDrafting] = useState(false);

  // Pool Filters
  const [selectedPos, setSelectedPos] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Admin Management State
  const [isAdminPrepOpen, setIsAdminPrepOpen] = useState(false);
  const [newProspectName, setNewProspectName] = useState('');
  const [newProspectPos, setNewProspectPos] = useState('PG');
  const [newProspectOvr, setNewProspectOvr] = useState<number>(75);

  const fetchData = async () => {
    try {
      const [boardRes, propsRes] = await Promise.all([
        fetch('/api/draft/board'),
        fetch('/api/draft/prospects')
      ]);
      const boardData = await boardRes.json();
      const propsData = await propsRes.json();

      setBoard((boardData.picks || []).slice(0, 30));
      setSettings(boardData.settings || null);
      setProspects(Array.isArray(propsData) ? propsData : []);
    } catch (e) {
      console.error('Ошибка загрузки данных драфта:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addProspect = async () => {
    if (!newProspectName.trim()) return;
    try {
      setLoading(true);
      await fetch('/api/admin/draft/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ name: newProspectName.trim(), position: newProspectPos, overall_rating: newProspectOvr })
      });
      setNewProspectName('');
      await fetchData();
    } catch (e) {
      alert('Ошибка добавления новичка');
      setLoading(false);
    }
  };

  const removeProspect = async (id: string) => {
    if (!confirm('Точно удалить игрока из пула?')) return;
    try {
      setLoading(true);
      await fetch(`/api/admin/draft/prospects/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': role }
      });
      await fetchData();
    } catch (e) {
      alert('Ошибка удаления');
      setLoading(false);
    }
  };

  const handleDraftPlayer = async (playerId: string) => {
    if (!selectedPick) return;
    try {
      setIsDrafting(true);
      const res = await fetch('/api/draft/pick', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-user-role': role,
          'x-user-team-id': myTeamId || ''
        },
        body: JSON.stringify({ 
          pick_id: selectedPick.id, 
          player_id: playerId,
          user_team_id: myTeamId 
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Ошибка при драфте игрока');
        setIsDrafting(false);
        return;
      }

      await fetchData();
      setSelectedPick(null);
      setScreen('BOARD');
    } catch (e: any) {
      console.error(e);
      alert('Сетевая ошибка при выборе игрока');
    } finally {
      setIsDrafting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3390ec] mb-4"></div>
        <div className="text-sm font-bold">Синхронизация с Draft Room...</div>
      </div>
    );
  }

  const currentPickIndex = settings?.current_draft_pick_index ?? 0;
  const isDraftCompleted = settings?.draft_is_completed ?? (board.length > 0 && currentPickIndex >= board.length);
  const activePick = !isDraftCompleted && board.length > currentPickIndex ? board[currentPickIndex] : null;

  // Filter available prospects
  const availableProspects = prospects.filter(p => {
    const isAvail = p.is_prospect && !p.team_id;
    const matchesPos = selectedPos === 'ALL' || p.position === selectedPos;
    const matchesSearch = !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return isAvail && matchesPos && matchesSearch;
  });

  // -------------------------------------------------------------
  // ЭКРАН Б: «Выбор проспекта (Prospects Pool)»
  // -------------------------------------------------------------
  if (screen === 'POOL' && selectedPick) {
    const isCurrentTeamGM = Boolean(myTeamId && selectedPick.team_id === myTeamId);
    const isAdminForced = role === 'ADMIN' && !isCurrentTeamGM;

    return (
      <div className="flex flex-col h-full bg-[#181818] pb-[100px] overflow-y-auto">
        {/* Header Screen B */}
        <div className="bg-[#212121] border-b border-[#303030] p-4 sticky top-0 z-10 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={() => { setSelectedPick(null); setScreen('BOARD'); }} 
              className="flex items-center gap-1.5 text-[#3390ec] hover:text-[#52a5f5] text-[13px] font-bold active:scale-95 transition-transform"
            >
              <ArrowLeft width="18" height="18" style={{ minWidth: 18, minHeight: 18, maxWidth: 18, maxHeight: 18 }} />
              Назад к списку пиков
            </button>

            {isAdminForced && (
              <span className="bg-[#ff9f0a]/20 border border-[#ff9f0a]/40 text-[#ff9f0a] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1">
                👑 Выбор администратора
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {selectedPick.team?.logo_url && (
              <img 
                src={selectedPick.team.logo_url} 
                alt={selectedPick.team.name} 
                width="36" 
                height="36" 
                style={{ minWidth: 36, minHeight: 36, maxWidth: 36, maxHeight: 36 }}
                className="object-contain" 
              />
            )}
            <div>
              <h1 className="text-[17px] font-extrabold text-white leading-tight">
                Выбор для: {selectedPick.team?.name || 'Команда'}
              </h1>
              <div className="text-[12px] text-[#8e8e93] font-semibold">
                Пик #{selectedPick.pick_number || currentPickIndex + 1} • {selectedPick.name || 'Раунд'}
              </div>
            </div>
          </div>
        </div>

        {/* Search & Position Filter */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-[#8e8e93]" width="16" height="16" style={{ minWidth: 16, minHeight: 16, maxWidth: 16, maxHeight: 16 }} />
            <input 
              type="text" 
              placeholder="Поиск по имени проспекта..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#212121] border border-[#303030] pl-9 pr-3 py-2.5 rounded-xl text-[13px] text-white outline-none focus:border-[#3390ec]"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {['ALL', 'PG', 'SG', 'SF', 'PF', 'C'].map(pos => (
              <button
                key={pos}
                onClick={() => setSelectedPos(pos)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors whitespace-nowrap ${
                  selectedPos === pos 
                    ? 'bg-[#3390ec] text-white' 
                    : 'bg-[#212121] text-[#8e8e93] hover:text-white border border-[#303030]'
                }`}
              >
                {pos === 'ALL' ? 'Все позиции' : pos}
              </button>
            ))}
          </div>
        </div>

        {/* Prospects Grid */}
        <div className="p-4 pt-0">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[13px] font-bold text-[#8e8e93] uppercase tracking-wide">
              Доступные проспекты ({availableProspects.length})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableProspects.map(p => (
              <div 
                key={p.id} 
                className="bg-[#212121] border border-[#303030] p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden hover:border-[#3a3a3c] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#3390ec]/15 rounded-xl flex items-center justify-center text-[18px] font-black text-[#3390ec] border border-[#3390ec]/30">
                      {p.overall_rating}
                    </div>
                    <div>
                      <div className="text-[15px] font-bold text-white leading-tight">{p.name}</div>
                      <div className="text-[12px] text-[#8e8e93] font-semibold mt-0.5">{p.position} • Рейтинг {p.overall_rating} OVR</div>
                    </div>
                  </div>
                  <span className="bg-[#303030] text-[#8e8e93] px-2 py-0.5 rounded text-[11px] font-bold">
                    {p.position}
                  </span>
                </div>

                <button 
                  disabled={isDrafting || (role !== 'ADMIN' && (!myTeamId || myTeamId !== selectedPick?.team_id))}
                  onClick={() => handleDraftPlayer(p.id)}
                  className="w-full mt-2 py-2.5 bg-[#34c759] hover:bg-[#2eb050] text-white text-[13px] font-bold rounded-xl active:scale-[0.98] transition-all shadow-md shadow-[#34c759]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <span>{(!myTeamId && role !== 'ADMIN') ? 'Только для менеджеров команд' : `Задрафтовать ${p.name}`}</span>
                </button>
              </div>
            ))}

            {availableProspects.length === 0 && (
              <div className="col-span-full text-center text-[#8e8e93] text-[13px] py-12 bg-[#212121] rounded-2xl border border-[#303030]">
                Нет доступных новичков по заданным критериям
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ЭКРАН А: «Список пиков (Draft Board)»
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-[#181818] pb-[100px] overflow-y-auto">
      {/* Header Screen A */}
      <div className="bg-[#212121] border-b border-[#303030] p-4 sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-[18px] font-black text-white">🎟 Draft Room</h1>
            <div className="text-[12px] text-[#8e8e93] font-medium">
              Порядок выборов и турнирная драфт-доска
            </div>
          </div>

          {role === 'ADMIN' && (
            <button 
              onClick={() => setIsAdminPrepOpen(!isAdminPrepOpen)} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#303030] hover:bg-[#3a3a3c] text-white rounded-lg text-[12px] font-bold transition-colors"
            >
              <span>⚙️ Пул новичков</span>
              {isAdminPrepOpen ? (
                <ChevronUp width="14" height="14" style={{ minWidth: 14, minHeight: 14, maxWidth: 14, maxHeight: 14 }} />
              ) : (
                <ChevronDown width="14" height="14" style={{ minWidth: 14, minHeight: 14, maxWidth: 14, maxHeight: 14 }} />
              )}
            </button>
          )}
        </div>

        {/* Status Banner */}
        {isDraftCompleted ? (
          <div className="mt-2 bg-[#34c759]/15 border border-[#34c759]/30 rounded-xl p-3 flex items-center gap-2">
            <span className="text-xl">🎉</span>
            <div>
              <div className="text-[#34c759] font-bold text-[13px]">Драфт успешно завершен!</div>
              <div className="text-[#8e8e93] text-[11px]">Все выборы сделаны. Новички перешли в команды.</div>
            </div>
          </div>
        ) : activePick ? (
          <div className="mt-2 bg-[#3390ec]/15 border border-[#3390ec]/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="animate-pulse text-lg">⏱</span>
              <div>
                <div className="text-[#3390ec] font-extrabold text-[13px]">
                  НА ЧАСАХ: {activePick.team?.name || 'Ожидание хода'}
                </div>
                <div className="text-[#8e8e93] text-[11px] font-semibold">
                  Пик #{activePick.pick_number || currentPickIndex + 1} • {activePick.name || 'Раунд 1'}
                </div>
              </div>
            </div>

            {/* Quick Draft Button in Header if on the clock */}
            <button
              onClick={() => {
                setSelectedPick(activePick);
                setScreen('POOL');
              }}
              disabled={role !== 'ADMIN' && myTeamId !== activePick.team_id}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                (role === 'ADMIN' || myTeamId === activePick.team_id)
                  ? 'bg-[#3390ec] text-white hover:bg-[#2b7bc4] active:scale-95 shadow-md shadow-[#3390ec]/30'
                  : 'bg-[#303030] text-[#8e8e93] opacity-60 cursor-not-allowed'
              }`}
            >
              🎯 Сделать выбор
            </button>
          </div>
        ) : null}
      </div>

      {/* Admin Prospect Manager Collapsible */}
      {role === 'ADMIN' && isAdminPrepOpen && (
        <div className="p-4 bg-[#1e1e1e] border-b border-[#303030] space-y-4">
          <div className="text-[14px] font-bold text-white flex items-center gap-1.5">
            <Plus width="16" height="16" style={{ minWidth: 16, minHeight: 16, maxWidth: 16, maxHeight: 16 }} className="text-[#3390ec]" />
            Добавление новичка в пул драфта
          </div>

          <div className="bg-[#212121] p-3 rounded-xl border border-[#303030] space-y-2.5">
            <input 
              type="text" 
              placeholder="Имя и фамилия игрока (например, Cooper Flagg)" 
              value={newProspectName} 
              onChange={e => setNewProspectName(e.target.value)}
              className="w-full bg-[#181818] border border-[#303030] p-2.5 rounded-lg text-white text-[13px] outline-none focus:border-[#3390ec]"
            />
            <div className="flex gap-2">
              <select 
                value={newProspectPos} 
                onChange={e => setNewProspectPos(e.target.value)}
                className="flex-1 bg-[#181818] border border-[#303030] p-2.5 rounded-lg text-white text-[13px] outline-none font-bold"
              >
                <option value="PG">PG</option>
                <option value="SG">SG</option>
                <option value="SF">SF</option>
                <option value="PF">PF</option>
                <option value="C">C</option>
              </select>
              <input 
                type="number" 
                min="40" 
                max="99"
                value={newProspectOvr} 
                onChange={e => setNewProspectOvr(parseInt(e.target.value) || 75)}
                className="w-20 bg-[#181818] border border-[#303030] p-2.5 rounded-lg text-white text-[13px] outline-none text-center font-bold"
              />
            </div>
            <button 
              onClick={addProspect} 
              className="w-full py-2 bg-[#3390ec] hover:bg-[#2b7bc4] text-white font-bold rounded-lg text-[13px] active:scale-95 transition-transform"
            >
              + Добавить в пул новичков
            </button>
          </div>

          {/* List of current prospects with delete */}
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
            {prospects.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-[#212121] p-2 px-3 rounded-lg border border-[#303030]">
                <div className="flex items-center gap-2">
                  <span className="text-[#3390ec] font-bold text-[12px]">{p.overall_rating}</span>
                  <span className="text-white text-[13px] font-semibold">{p.name}</span>
                  <span className="text-[11px] text-[#8e8e93]">({p.position})</span>
                </div>
                <button 
                  onClick={() => removeProspect(p.id)} 
                  className="p-1 text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded transition-colors"
                >
                  <Trash2 width="14" height="14" style={{ minWidth: 14, minHeight: 14, maxWidth: 14, maxHeight: 14 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Draft Board Table / List */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[13px] font-bold text-[#8e8e93] uppercase tracking-wide">
            Турнирная драфт-доска ({board.length} пиков)
          </span>
          <span className="text-[12px] text-[#8e8e93]">
            Ход: <span className="text-white font-bold">{Math.min(currentPickIndex + 1, board.length)} / {board.length}</span>
          </span>
        </div>

        {/* Picks List */}
        <div className="space-y-2">
          {board.map((pick, i) => {
            const isUsed = pick.is_used;
            const isOnTheClock = !isDraftCompleted && i === currentPickIndex;

            const isCurrentTeamGM = Boolean(myTeamId && pick.team_id === myTeamId);
            const canMakePick = isOnTheClock && (role === 'ADMIN' || isCurrentTeamGM);
            const pickNumber = pick.pick_number || i + 1;

            return (
              <div 
                key={pick.id} 
                className={`p-3 sm:p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isOnTheClock 
                    ? 'bg-[#3390ec]/10 border-[#3390ec] shadow-lg shadow-[#3390ec]/15' 
                    : isUsed 
                    ? 'bg-[#212121]/70 border-[#303030]/60' 
                    : 'bg-[#212121] border-[#303030]'
                }`}
              >
                {/* Left: Pick Number & Team Info */}
                <div className="flex items-center gap-3">
                  {/* Pick Number Badge */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-[14px] shrink-0 ${
                    isOnTheClock 
                      ? 'bg-[#3390ec] text-white shadow-md shadow-[#3390ec]/30' 
                      : isUsed 
                      ? 'bg-[#34c759]/20 text-[#34c759]' 
                      : 'bg-[#303030] text-[#8e8e93]'
                  }`}>
                    #{pickNumber}
                  </div>

                  {/* Team Logo and Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {pick.team?.logo_url && (
                      <img 
                        src={pick.team.logo_url} 
                        alt={pick.team.name} 
                        width="28" 
                        height="28" 
                        style={{ minWidth: 28, minHeight: 28, maxWidth: 28, maxHeight: 28 }}
                        className="object-contain shrink-0" 
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-white flex items-center gap-2 truncate">
                        <span className="truncate">{pick.team?.name || 'Команда'}</span>
                        {isCurrentTeamGM && (
                          <span className="bg-[#3390ec]/20 text-[#3390ec] text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0">
                            Ваша
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8e8e93] font-medium truncate">
                        {pick.name || 'Пик драфта'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Status and Action Button */}
                <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-[#303030]/50">
                  {/* Status Badge */}
                  <div>
                    {isUsed ? (
                      <div className="bg-[#34c759]/15 border border-[#34c759]/30 text-[#34c759] px-2.5 py-1 rounded-lg text-[12px] font-bold flex items-center gap-1.5">
                        <span>✅</span>
                        <span className="truncate max-w-[200px]">
                          {pick.selected_player?.name || 'Выбран'} 
                          {pick.selected_player?.position ? ` (${pick.selected_player.position}` : ''}
                          {pick.selected_player?.overall_rating ? `, ${pick.selected_player.overall_rating} OVR)` : pick.selected_player?.position ? ')' : ''}
                        </span>
                      </div>
                    ) : isOnTheClock ? (
                      <div className="animate-pulse bg-[#3390ec]/20 border border-[#3390ec]/40 text-[#3390ec] px-3 py-1 rounded-lg text-[12px] font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#3390ec]" />
                        <span>⏱ НА ЧАСАХ</span>
                      </div>
                    ) : (
                      <div className="bg-[#303030] text-[#8e8e93] px-2.5 py-1 rounded-lg text-[12px] font-medium">
                        Ожидание
                      </div>
                    )}
                  </div>

                  {/* Action Column */}
                  <div>
                    {isOnTheClock ? (
                      <button
                        disabled={!canMakePick}
                        onClick={() => {
                          setSelectedPick(pick);
                          setScreen('POOL');
                        }}
                        className={`px-3.5 py-2 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-all ${
                          canMakePick
                            ? 'bg-[#3390ec] text-white hover:bg-[#2b7bc4] active:scale-95 shadow-md shadow-[#3390ec]/25 cursor-pointer'
                            : 'bg-[#303030] text-[#8e8e93] opacity-50 cursor-not-allowed'
                        }`}
                        title={!canMakePick ? `Ход команды ${pick.team?.name}` : undefined}
                      >
                        <span>🎯 Сделать выбор</span>
                        {role === 'ADMIN' && !isCurrentTeamGM && (
                          <span className="bg-black/40 text-amber-300 px-1 py-0.5 rounded text-[10px]">
                            👑
                          </span>
                        )}
                      </button>
                    ) : isUsed ? (
                      <span className="text-[12px] text-[#8e8e93] font-semibold pr-2">Завершен</span>
                    ) : (
                      <span className="text-[12px] text-[#8e8e93] font-semibold pr-2">В очереди</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {board.length === 0 && (
            <div className="text-center text-[#8e8e93] text-[13px] py-16 bg-[#212121] rounded-2xl border border-[#303030]">
              Пики драфта отсутствуют. Администратор может добавить их в панели управления.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

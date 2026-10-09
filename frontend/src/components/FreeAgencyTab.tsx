import { useState, useEffect } from 'react';
import { DollarSign, BookOpen, Clock, AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import MemoTab from './MemoTab';

type ContractType = 'CUSTOM' | 'MIN' | 'TAX_MLE' | 'FULL_MLE' | 'ROOKIE_MAX' | 'MEDIUM_MAX' | 'VETERAN_MAX' | 'SUPERMAX';

export default function FreeAgencyTab({ role, myTeamId }: { role: string, myTeamId?: string }) {
  const [mode, setMode] = useState<'VIEW' | 'BUILDER'>('VIEW');
  const [blocks, setBlocks] = useState<any[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [unassignedPlayers, setUnassignedPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [startDays, setStartDays] = useState(0);
  const [startMinutes, setStartMinutes] = useState(30);

  // Modal State
  const [offerPlayer, setOfferPlayer] = useState<any>(null);
  const [offerType, setOfferType] = useState<ContractType>('CUSTOM');
  const [offerYears, setOfferYears] = useState(1);
  const [lastYearOption, setLastYearOption] = useState<'NONE' | 'PLAYER_OPTION' | 'TEAM_OPTION'>('NONE');
  const [salariesArr, setSalariesArr] = useState<string[]>(['']);
  
  const [showGuide, setShowGuide] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  const fetchBaseData = async () => {
    try {
      const [tmRes, stRes, blRes] = await Promise.all([
        fetch('/api/teams'),
        fetch('/api/league/settings'),
        fetch('/api/free-agency/blocks', { headers: { 'x-user-role': role } })
      ]);
      const tmData = await tmRes.json();
      const stData = await stRes.json();
      const blData = await blRes.json();
      
      setTeams(Array.isArray(tmData) ? tmData : (tmData.teams || []));
      setSettings(stData);
      setBlocks(blData);
      
      if (blData.length > 0 && !activeBlockId) {
        const active = blData.find((b: any) => b.is_active) || blData[blData.length - 1];
        setActiveBlockId(active.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBlockPlayers = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/free-agency/blocks/${id}`, { headers: { 'x-user-role': role } });
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassigned = async () => {
    if (role !== 'ADMIN') return;
    try {
      const res = await fetch(`/api/admin/free-agency/unassigned-players`, { headers: { 'x-user-role': role } });
      const data = await res.json();
      setUnassignedPlayers(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchBaseData();
    if (role === 'ADMIN') fetchUnassigned();
  }, [role, mode]);

  useEffect(() => {
    if (activeBlockId) {
      fetchBlockPlayers(activeBlockId);
    }
  }, [activeBlockId]);

  // Timer logic
  useEffect(() => {
    const activeBlock = blocks.find(b => b.id === activeBlockId);
    if (!activeBlock || !activeBlock.deadline || activeBlock.is_completed) {
      setTimeLeft('');
      setIsExpired(false);
      return;
    }

    const interval = setInterval(() => {
      const diff = new Date(activeBlock.deadline).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        setIsExpired(true);
      } else {
        setIsExpired(false);
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [blocks, activeBlockId]);

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBlock = async () => {
    if (isCreating) return;
    try {
      setIsCreating(true);
      const res = await fetch(`/api/admin/free-agency/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({ duration_minutes: 30 })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при создании блока');
      }

      if (data.block) {
        setBlocks(prev => [...prev, data.block]);
        setActiveBlockId(data.block.id);
        setMode('BUILDER');
      }
      await fetchBaseData();
      await fetchUnassigned();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Ошибка');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBlock = async (id: number) => {
    if (!confirm('Точно удалить этот блок? Все игроки вернутся в общий пул.')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/free-agency/blocks/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': role }
      });
      const updatedBlocks = await res.json();
      
      let nextId = null;
      if (updatedBlocks && updatedBlocks.length > 0) {
        const active = updatedBlocks.find((b: any) => b.is_active) || updatedBlocks[updatedBlocks.length - 1];
        nextId = active.id;
      }
      setActiveBlockId(nextId);
      
      await fetchBaseData();
      await fetchUnassigned();
    } catch (e) {
      alert('Ошибка при удалении');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async (playerId: string) => {
    if (!activeBlockId) return;
    try {
      await fetch(`/api/admin/free-agency/blocks/${activeBlockId}/add-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ player_id: playerId })
      });
      await fetchBlockPlayers(activeBlockId);
      await fetchUnassigned();
    } catch (e) {
      alert('Ошибка');
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!activeBlockId) return;
    try {
      await fetch(`/api/admin/free-agency/blocks/${activeBlockId}/remove-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ player_id: playerId })
      });
      await fetchBlockPlayers(activeBlockId);
      await fetchUnassigned();
    } catch (e) {
      alert('Ошибка');
    }
  };

  const handleStartBlock = async (id: number) => {
    try {
      await fetch(`/api/admin/free-agency/blocks/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ days: startDays, minutes: startMinutes })
      });
      await fetchBaseData();
    } catch (e) {
      alert('Ошибка');
    }
  };

  const handleFinalizeBlock = async (id: number) => {
    if (!confirm('Подписать игроков по лидирующим офферам и закрыть блок?')) return;
    try {
      setLoading(true);
      await fetch(`/api/admin/free-agency/blocks/${id}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({})
      });
      await fetchBaseData();
      await fetchBlockPlayers(id);
    } catch (e) {
      alert('Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async (offerId: string, action: 'MATCH' | 'PASS') => {
    if (!confirm(action === 'MATCH' ? 'Повторить ставку и подписать игрока?' : 'Отказаться от игрока?')) return;
    try {
      setLoading(true);
      await fetch(`/api/free-agency/offers/${offerId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ action })
      });
      if (activeBlockId) await fetchBlockPlayers(activeBlockId);
    } catch (e) {
      alert('Ошибка');
      setLoading(false);
    }
  };

  useEffect(() => {
    setSalariesArr(prev => {
      if (prev.length === offerYears) return prev;
      const newArr = [...prev];
      if (newArr.length < offerYears) {
        const schedule = getScheduleForType(offerType);
        while (newArr.length < offerYears) {
          const idx = newArr.length;
          const defaultVal = (offerType !== 'CUSTOM' && schedule && schedule[idx] !== undefined)
            ? schedule[idx].toString()
            : '';
          newArr.push(defaultVal);
        }
      } else if (newArr.length > offerYears) {
        newArr.length = offerYears;
      }
      return newArr;
    });
  }, [offerYears, offerType]);

  const getScheduleForType = (type: ContractType): number[] => {
    if (!settings) return [];
    switch(type) {
      case 'MIN': return settings.min_salary_schedule || [1.15, 1.25, 1.35, 1.45, 1.55];
      case 'TAX_MLE': return settings.tax_mle_schedule || [5.3, 5.6, 5.9];
      case 'FULL_MLE': return settings.full_mle_schedule || [12.9, 13.6, 14.3, 15.0];
      case 'ROOKIE_MAX': return settings.rookie_max_schedule || [35.5, 38.3, 41.1, 44.0];
      case 'MEDIUM_MAX': return settings.medium_max_schedule || [42.5, 45.9, 49.3, 52.7, 56.1];
      case 'VETERAN_MAX': return settings.veteran_max_schedule || [50.0, 54.0, 58.0, 62.0, 66.0];
      case 'SUPERMAX': return settings.supermax_schedule || [60.0, 64.8, 69.6, 74.4, 79.2];
      default: return [];
    }
  };

  const handleTypeChange = (type: ContractType) => {
    setOfferType(type);
    
    let targetYears = offerYears;
    let option: 'NONE' | 'PLAYER_OPTION' | 'TEAM_OPTION' = 'NONE';

    if (type === 'MIN') {
      targetYears = 2; // Fixed 1+1 PO
      option = 'PLAYER_OPTION';
    } else if (type === 'TAX_MLE') {
      targetYears = 2; // Strictly 2 years
      option = 'NONE';
    } else if (type === 'FULL_MLE') {
      targetYears = Math.min(Math.max(offerYears, 1), 4);
      option = 'NONE';
    } else if (type === 'ROOKIE_MAX') {
      if (!offerPlayer?.is_rfa) {
        alert('Детский макс доступен ИСКЛЮЧИТЕЛЬНО для RFA-игроков!');
        setOfferType('CUSTOM');
        return;
      }
      targetYears = 4;
      option = 'NONE';
    } else if (type === 'MEDIUM_MAX' || type === 'VETERAN_MAX' || type === 'SUPERMAX') {
      targetYears = offerYears === 5 ? 5 : 4;
      option = 'NONE';
    }

    setOfferYears(targetYears);
    setLastYearOption(option);

    if (type !== 'CUSTOM') {
      const schedule = getScheduleForType(type);
      if (schedule && schedule.length > 0) {
        const newArr = Array(targetYears).fill('');
        for (let i = 0; i < targetYears; i++) {
          newArr[i] = schedule[i] !== undefined ? schedule[i].toString() : schedule[schedule.length - 1].toString();
        }
        setSalariesArr(newArr);
      }
    }
  };

  const handleYearsChange = (y: number) => {
    setOfferYears(y);
    if (offerType !== 'CUSTOM') {
      const schedule = getScheduleForType(offerType);
      if (schedule && schedule.length > 0) {
        const newArr = Array(y).fill('');
        for (let i = 0; i < y; i++) {
          newArr[i] = schedule[i] !== undefined ? schedule[i].toString() : schedule[schedule.length - 1].toString();
        }
        setSalariesArr(newArr);
      }
    }
  };

  const handleSalaryChange = (index: number, value: string) => {
    const newArr = [...salariesArr];
    newArr[index] = value;
    setSalariesArr(newArr);
  };

  const availableYears = () => {
    if (offerType === 'MIN') return [2];
    if (offerType === 'TAX_MLE') return [2];
    if (offerType === 'FULL_MLE') return [1, 2, 3, 4];
    if (offerType === 'ROOKIE_MAX') return [4];
    if (offerType === 'MEDIUM_MAX' || offerType === 'VETERAN_MAX' || offerType === 'SUPERMAX') return [4, 5];
    return [1, 2, 3, 4, 5];
  };

  const formatMoney = (amount: number) => `$${(amount / 1000000).toFixed(1)}M`;
  
  const evalSalaries = salariesArr.slice(0, 4);
  const evaluationSum = evalSalaries.reduce((sum, val) => sum + (parseFloat(val) || 0), 0) * 1000000;
  const totalOfferSum = salariesArr.reduce((sum, val) => sum + (parseFloat(val) || 0), 0) * 1000000;
  const fifthYearSalary = offerYears === 5 ? (parseFloat(salariesArr[4]) || 0) * 1000000 : 0;

  const submitOffer = async () => {
    if (!offerPlayer || !myTeamId) return;
    const parsedSalaries = salariesArr.map(s => parseFloat(s) * 1000000);
    if (parsedSalaries.some(s => isNaN(s) || s <= 0)) return alert('Заполните все зарплаты корректно');
    
    try {
      setLoading(true);
      const res = await fetch('/api/free-agency/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({
          player_id: offerPlayer.id,
          team_id: myTeamId,
          offer_type: offerType,
          salaries: parsedSalaries,
          last_year_option: lastYearOption
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при отправке');
      
      setOfferPlayer(null);
      setOfferType('CUSTOM');
      setSalariesArr(['']);
      setOfferYears(1);
      setLastYearOption('NONE');
      if (activeBlockId) await fetchBlockPlayers(activeBlockId);
    } catch (e: any) {
      alert(e.message);
      setLoading(false);
    }
  };

  const myTeam = teams.find(t => t.id === myTeamId);
  const activeBlockData = blocks.find(b => b.id === activeBlockId);

  return (
    <div className="flex flex-col h-full bg-[#181818] pb-[100px] relative overflow-hidden">
      
      {/* Header and Guide Button */}
      <div className="p-4 bg-[#212121] border-b border-[#303030] flex flex-col gap-3 z-10 sticky top-0">
        <div className="flex justify-between items-center">
          <div className="font-bold text-white flex items-center gap-2">
            Рынок СА
          </div>
          <button onClick={() => setShowGuide(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3390ec]/10 text-[#3390ec] font-bold text-[12px] rounded-lg">
            <BookOpen width="16" height="16" /> Памятка
          </button>
        </div>
        
        {role === 'ADMIN' && (
          <div className="flex gap-2">
            <button onClick={() => setMode('BUILDER')} className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${mode === 'BUILDER' ? 'bg-[#3390ec] text-white' : 'bg-[#181818] border border-[#303030] text-[#8e8e93]'}`}>
              🛠 Конструктор
            </button>
            <button onClick={() => setMode('VIEW')} className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${mode === 'VIEW' ? 'bg-[#3390ec] text-white' : 'bg-[#181818] border border-[#303030] text-[#8e8e93]'}`}>
              👀 Просмотр рынка
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {mode === 'BUILDER' && role === 'ADMIN' ? (
          <div className="p-4">
            <div className="flex overflow-x-auto gap-2 mb-4 pb-2 border-b border-[#303030] no-scrollbar">
              {blocks.map(b => (
                <button 
                  key={b.id}
                  onClick={() => setActiveBlockId(b.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors ${activeBlockId === b.id ? 'bg-[#3390ec] text-white' : 'bg-[#212121] text-[#8e8e93]'}`}
                >
                  Блок {b.number} {b.status === 'COMPLETED' ? '(✅)' : b.status === 'ACTIVE' ? '(🔥)' : ''}
                </button>
              ))}
              <button onClick={handleCreateBlock} disabled={isCreating} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap ${isCreating ? 'bg-[#34c759]/5 text-[#34c759]/50 cursor-not-allowed' : 'bg-[#34c759]/10 text-[#34c759]'}`}>
                <Plus width="14" height="14" /> {isCreating ? 'Создание...' : 'Создать'}
              </button>
            </div>

            {activeBlockData && (
              <div className="bg-[#212121] border border-[#303030] p-4 rounded-xl mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-white">Формирование: Блок #{activeBlockData.number}</h3>
                  {activeBlockData.status !== 'COMPLETED' && (
                    <button onClick={() => handleDeleteBlock(activeBlockData.id)} className="text-[12px] font-bold text-[#ff3b30] bg-[#ff3b30]/10 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      🗑️ Удалить блок
                    </button>
                  )}
                </div>
                
                {activeBlockData.status === 'PENDING' && (
                  <div className="flex items-end gap-3 mb-4 bg-[#ff9f0a]/10 p-3 rounded-lg border border-[#ff9f0a]/30">
                    <div>
                      <label className="block text-[11px] font-bold text-[#8e8e93] mb-1">Дней</label>
                      <input type="number" min="0" value={startDays} onChange={e => setStartDays(Number(e.target.value))} className="w-16 p-2 bg-[#181818] border border-[#303030] rounded-lg text-white text-center font-bold" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#8e8e93] mb-1">Минут</label>
                      <input type="number" min="0" value={startMinutes} onChange={e => setStartMinutes(Number(e.target.value))} className="w-16 p-2 bg-[#181818] border border-[#303030] rounded-lg text-white text-center font-bold" />
                    </div>
                    <button onClick={() => handleStartBlock(activeBlockData.id)} className="ml-auto bg-[#ff9f0a] text-black px-4 py-2 rounded-lg font-bold text-[13px]">
                      🚀 Запустить
                    </button>
                  </div>
                )}

                {activeBlockData.status === 'ACTIVE' && (
                  <div className="flex justify-between items-center bg-[#34c759]/10 p-3 rounded-lg border border-[#34c759]/30 mb-4">
                    <span className="text-[#34c759] font-bold">🟢 Блок активен</span>
                    <button onClick={() => handleFinalizeBlock(activeBlockData.id)} className="bg-[#ff3b30]/10 text-[#ff3b30] px-3 py-1.5 rounded-lg font-bold text-[12px]">
                      ⚡️ Завершить досрочно
                    </button>
                  </div>
                )}

                {activeBlockData.status === 'COMPLETED' && (
                  <div className="bg-[#34c759]/10 border border-[#34c759]/30 p-3 rounded-lg text-[#34c759] font-bold mb-4">
                    ✅ Блок завершен
                  </div>
                )}

                <div className="text-[12px] font-bold text-[#8e8e93] mb-2">Игроки в блоке ({players.length}):</div>
                <div className="space-y-2">
                  {players.map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-[#181818] p-2 rounded-lg border border-[#303030]">
                      <div className="text-[13px] font-bold text-white flex items-center gap-2">
                        <span className="text-[#3390ec]">{p.overall_rating}</span> {p.name} <span className="text-[10px] text-[#8e8e93]">{p.position}</span>
                      </div>
                      {activeBlockData.status === 'PENDING' && (
                        <button onClick={() => handleRemovePlayer(p.id)} className="text-[#ff3b30] p-1 bg-[#ff3b30]/10 rounded">
                          <X width="14" height="14" />
                        </button>
                      )}
                    </div>
                  ))}
                  {players.length === 0 && <div className="text-[#8e8e93] text-[12px]">Нет игроков</div>}
                </div>
              </div>
            )}

            <div className="bg-[#212121] border border-[#303030] p-4 rounded-xl">
              <h3 className="font-bold text-white mb-3">Доступные свободные агенты (Пул)</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {unassignedPlayers.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-[#181818] p-2 rounded-lg border border-[#303030]">
                    <div className="text-[13px] font-bold text-white flex items-center gap-2">
                      <span className="text-[#3390ec]">{p.overall_rating}</span> {p.name} <span className="text-[10px] text-[#8e8e93]">{p.position}</span>
                    </div>
                    <button onClick={() => handleAddPlayer(p.id)} disabled={!activeBlockId || activeBlockData?.status !== 'PENDING'} className="text-[#34c759] p-1 bg-[#34c759]/10 rounded disabled:opacity-50">
                      <Plus width="14" height="14" />
                    </button>
                  </div>
                ))}
                {unassignedPlayers.length === 0 && <div className="text-[#8e8e93] text-[12px]">Все агенты распределены</div>}
              </div>
            </div>
          </div>
        ) : (
          <div>
            {!blocks.length ? (
              <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
                <AlertCircle width="48" height="48" className="mb-4 opacity-50" />
                <div className="text-center font-bold">Администратор еще не открыл рынок.<br/>Ожидайте первый блок.</div>
              </div>
            ) : (
              <>
                {/* Block Tabs */}
                <div className="flex overflow-x-auto p-3 gap-2 border-b border-[#303030] no-scrollbar">
                  {blocks.map(b => {
                    let label = `Блок ${b.number}`;
                    let style = 'bg-[#212121] text-[#8e8e93]';
                    if (b.is_completed) label = `✅ Блок ${b.number} (Завершен)`;
                    else if (b.is_active) label = `🔥 Блок ${b.number}`;
                    else label = `Блок ${b.number}`;

                    if (activeBlockId === b.id) style = 'bg-[#3390ec] text-white';

                    return (
                      <button 
                        key={b.id}
                        onClick={() => setActiveBlockId(b.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${style}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="p-4">
                  {activeBlockData && activeBlockData.is_active && (
                    <div className="bg-[#212121] border border-[#303030] p-4 rounded-xl mb-4 flex justify-between items-center">
                      {isExpired ? (
                        <div className="flex items-center gap-2 text-[#ff3b30] font-bold">
                          <Clock width="18" height="18" />
                          <span>🔒 Дедлайн истек (Ожидание итогов)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[#34c759] font-bold">
                          <Clock width="18" height="18" />
                          <span>⏳ До закрытия: {timeLeft}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {activeBlockData && activeBlockData.is_completed && (
                    <div className="bg-[#34c759]/10 border border-[#34c759]/30 p-4 rounded-xl mb-4 flex items-center justify-center gap-2 text-[#34c759] font-bold">
                      <CheckCircle2 width="20" height="20" />
                      <span>Блок завершен. Все контракты подписаны.</span>
                    </div>
                  )}

                  {/* Players List */}
                  {loading ? (
                    <div className="py-10 text-center text-[#8e8e93] font-bold">Загрузка игроков...</div>
                  ) : (
                    <div className="space-y-4">
                      {players.length === 0 ? (
                        <div className="text-center py-8 text-[#8e8e93] font-bold">Нет игроков в этом блоке.</div>
                      ) : players.map(p => {
                        const topOffer = p.contract_offers?.[0];
                        const isMyRFA = p.is_rfa && p.previous_team_id === myTeamId;
                        const hasOffer = !!topOffer;
                        const canMatch = isMyRFA && hasOffer && topOffer.status === 'PENDING' && !isExpired && activeBlockData?.is_active;
                        const previousTeamName = teams.find(t => t.id === p.previous_team_id)?.name;
                        const topOfferTotal = topOffer ? (topOffer.salaries?.length > 0 ? topOffer.salaries.reduce((a: number, b: number) => a + b, 0) : topOffer.annual_salary * topOffer.years) : 0;
                        const topOfferEval = topOffer ? (topOffer.evaluation_amount > 0 ? topOffer.evaluation_amount : (topOffer.salaries?.length > 0 ? topOffer.salaries.slice(0, 4).reduce((a: number, b: number) => a + b, 0) : topOfferTotal)) : 0;

                        return (
                          <div key={p.id} className="bg-[#212121] p-4 rounded-2xl shadow-sm border border-[#303030]">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#303030] rounded-xl flex items-center justify-center text-[16px] font-bold text-[#3390ec]">
                                  {p.overall_rating}
                                </div>
                                <div>
                                  <div className="text-[14px] font-bold text-white">{p.name}</div>
                                  <div className="text-[12px] text-[#8e8e93]">{p.position}</div>
                                </div>
                              </div>
                              <div>
                                {p.is_rfa ? (
                                  <div className="bg-[#ff9f0a]/20 text-[#ff9f0a] px-2 py-1 rounded text-[10px] font-bold text-right">
                                    🟡 RFA
                                    {previousTeamName && <div className="text-[8px] opacity-80">{previousTeamName}</div>}
                                  </div>
                                ) : (
                                  <div className="bg-[#34c759]/20 text-[#34c759] px-2 py-1 rounded text-[10px] font-bold text-right">🟢 UFA</div>
                                )}
                              </div>
                            </div>

                            {activeBlockData?.is_completed ? (
                              <div className="mt-3 p-3 bg-[#181818] rounded-xl border border-[#303030] flex flex-col gap-1.5">
                                {p.team ? (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 width="16" height="16" className="text-[#34c759]" />
                                      <span className="text-[13px] font-bold text-white">
                                        Подписан в: <span className="text-[#34c759]">{p.team.name}</span>
                                      </span>
                                    </div>
                                    <div className="text-[12px] text-[#8e8e93] pl-6 flex items-center gap-2 flex-wrap">
                                      <span>Сумма: {formatMoney(p.salaries?.reduce((a: number, b: number) => a + b, 0) || 0)} / {p.contract_years_left} г.</span>
                                      {p.option_type === 'PLAYER_OPTION' && (
                                        <span className="bg-[#3390ec]/20 text-[#3390ec] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                          PO на посл. год
                                        </span>
                                      )}
                                      {p.option_type === 'TEAM_OPTION' && (
                                        <span className="bg-[#ff9f0a]/20 text-[#ff9f0a] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                          TO на посл. год
                                        </span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <AlertCircle width="16" height="16" className="text-[#8e8e93]" />
                                    <span className="text-[13px] font-bold text-[#8e8e93]">Остался без контракта</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                {hasOffer && (
                                  <div className="mt-3 p-3 bg-[#181818] rounded-xl border border-[#303030] space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] text-[#8e8e93]">Лидирующее предложение:</span>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {topOffer.last_year_option === 'PLAYER_OPTION' && (
                                          <span className="bg-[#3390ec]/20 text-[#3390ec] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            PO на {topOffer.years}-й год
                                          </span>
                                        )}
                                        {topOffer.last_year_option === 'TEAM_OPTION' && (
                                          <span className="bg-[#ff9f0a]/20 text-[#ff9f0a] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            TO на {topOffer.years}-й год
                                          </span>
                                        )}
                                        {topOffer.years === 5 && (
                                          <span className="bg-[#af52de]/20 text-[#af52de] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            5 лет
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-[13px] font-bold text-white flex items-baseline justify-between">
                                      <div>
                                        <span>{topOffer.team.name}</span>
                                        <span className="text-[11px] text-[#8e8e93] font-normal ml-1">({topOffer.years} г.)</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-[#34c759] font-extrabold">{formatMoney(topOfferEval)}</span>
                                        <span className="text-[10px] text-[#8e8e93] block font-normal">оценка (первые 4 г.)</span>
                                      </div>
                                    </div>
                                    {topOffer.years === 5 && (
                                      <div className="text-[10px] text-[#8e8e93] pt-1.5 border-t border-[#303030]/60 flex items-center justify-between">
                                        <span>Всего: {formatMoney(topOfferTotal)}</span>
                                        <span className="text-[#af52de]">5-й год ({formatMoney(topOffer.salaries?.[4] || 0)}) — удержание</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="mt-3 flex flex-col gap-2">
                                  {canMatch ? (
                                    <div className="bg-[#ff9f0a]/10 border border-[#ff9f0a]/30 p-3 rounded-xl">
                                      <div className="text-[11px] text-[#ff9f0a] font-bold mb-2">⚠️ Ваш RFA игрок получил оффер!</div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleMatch(topOffer.id, 'MATCH')} className="flex-1 py-2 bg-[#34c759] text-white rounded-lg text-[12px] font-bold active:scale-[0.98]">
                                          ✅ Повторить
                                        </button>
                                        <button onClick={() => handleMatch(topOffer.id, 'PASS')} className="flex-1 py-2 bg-[#ff3b30]/10 text-[#ff3b30] rounded-lg text-[12px] font-bold active:scale-[0.98]">
                                          ❌ Отпустить
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => {
                                          setOfferPlayer(p);
                                          setOfferType('CUSTOM');
                                          setSalariesArr(['']);
                                          setOfferYears(1);
                                          setLastYearOption('NONE');
                                        }} 
                                        disabled={!myTeamId || isExpired || !activeBlockData?.is_active}
                                        className={`flex-1 py-2.5 font-bold rounded-xl text-[12px] active:scale-[0.98] transition-colors ${!myTeamId || isExpired || !activeBlockData?.is_active ? 'bg-[#303030] text-[#8e8e93]' : 'bg-[#3390ec]/10 text-[#3390ec]'}`}
                                      >
                                        Сделать оффер
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {offerPlayer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#212121] border border-[#303030] w-full max-w-sm rounded-2xl p-4 flex flex-col shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-[15px] font-bold text-white mb-1">Оффер для {offerPlayer.name}</div>
            <div className="text-[12px] text-[#8e8e93] mb-4">Команда: {myTeam?.name || 'Неизвестно'}</div>
            
            <div className="space-y-4 mb-6">
              
              <div>
                <label className="text-[12px] font-bold text-[#8e8e93] block mb-2">Тип контракта</label>
                <select 
                  value={offerType} 
                  onChange={(e) => handleTypeChange(e.target.value as ContractType)}
                  className="w-full bg-[#181818] border border-[#303030] p-2.5 rounded-lg text-white text-[13px] outline-none font-bold"
                >
                  <option value="CUSTOM">Кастомный (Настраиваемый)</option>
                  <option value="MIN">Минимум</option>
                  <option value="TAX_MLE">Tax MLE</option>
                  <option value="FULL_MLE">Full MLE</option>
                  <option value="ROOKIE_MAX" disabled={!offerPlayer.is_rfa}>Детский макс (Только RFA)</option>
                  <option value="MEDIUM_MAX">Средний макс</option>
                  <option value="VETERAN_MAX">Взрослый макс</option>
                  {offerPlayer.previous_team_id === myTeamId && (
                    <option value="SUPERMAX">Супермакс</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[12px] font-bold text-[#8e8e93] block mb-1">Срок контракта (лет)</label>
                <div className="flex gap-2">
                  {availableYears().map(y => (
                    <button 
                      key={y} 
                      type="button"
                      onClick={() => handleYearsChange(y)} 
                      className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-colors ${offerYears === y ? 'bg-[#3390ec] text-white' : 'bg-[#181818] border border-[#303030] text-[#8e8e93]'}`}
                    >
                      {offerType === 'MIN' ? '2 года (1+1 PO)' : `${y} ${y === 1 ? 'год' : y >= 5 ? 'лет' : 'года'}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option on the last year */}
              <div>
                <label className="text-[12px] font-bold text-[#8e8e93] block mb-1">
                  Опция на последний ({offerYears}-й) год
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={offerType === 'MIN'}
                    onClick={() => setLastYearOption('NONE')}
                    className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-colors ${
                      lastYearOption === 'NONE'
                        ? 'bg-[#3390ec] text-white'
                        : 'bg-[#181818] border border-[#303030] text-[#8e8e93] disabled:opacity-40'
                    }`}
                  >
                    Без опции
                  </button>
                  <button
                    type="button"
                    onClick={() => setLastYearOption('PLAYER_OPTION')}
                    className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-colors ${
                      lastYearOption === 'PLAYER_OPTION'
                        ? 'bg-[#3390ec] text-white'
                        : 'bg-[#181818] border border-[#303030] text-[#8e8e93]'
                    }`}
                  >
                    Игрока (PO)
                  </button>
                  <button
                    type="button"
                    disabled={offerType === 'MIN'}
                    onClick={() => setLastYearOption('TEAM_OPTION')}
                    className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-colors ${
                      lastYearOption === 'TEAM_OPTION'
                        ? 'bg-[#3390ec] text-white'
                        : 'bg-[#181818] border border-[#303030] text-[#8e8e93] disabled:opacity-40'
                    }`}
                  >
                    Команды (TO)
                  </button>
                </div>
                {offerType === 'MIN' && (
                  <div className="text-[10px] text-[#34c759] mt-1 font-medium">
                    * Минимальный контракт по правилам строго 1+1 PO (Опция игрока на 2-й год)
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-[#8e8e93] block mb-1">Зарплата по годам ($M)</label>
                {salariesArr.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[12px] text-[#8e8e93] w-12 shrink-0">
                      Год {idx + 1}
                      {idx === offerYears - 1 && lastYearOption === 'PLAYER_OPTION' && ' (PO)'}
                      {idx === offerYears - 1 && lastYearOption === 'TEAM_OPTION' && ' (TO)'}
                    </span>
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign width="14" height="14" className="text-[#8e8e93]" />
                      </div>
                      <input 
                        type="number" step="0.1" min="0"
                        disabled={offerType !== 'CUSTOM'}
                        value={val} onChange={e => handleSalaryChange(idx, e.target.value)}
                        className="w-full bg-[#181818] border border-[#303030] py-2 pl-8 pr-3 rounded-lg text-white text-[13px] outline-none font-bold disabled:opacity-50"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#181818] p-3.5 rounded-xl border border-[#303030] space-y-2">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-[#8e8e93] font-bold">Оценочная сумма (первые 4 года):</span>
                  <span className="font-extrabold text-[#34c759] text-[15px]">{formatMoney(evaluationSum)}</span>
                </div>

                {offerYears === 5 && (
                  <>
                    <div className="flex justify-between items-center text-[12px] pt-1.5 border-t border-[#303030]/60">
                      <span className="text-[#8e8e93]">Общая сумма (все 5 лет):</span>
                      <span className="font-bold text-white">{formatMoney(totalOfferSum)}</span>
                    </div>
                    <div className="text-[11px] text-[#af52de] bg-[#af52de]/10 border border-[#af52de]/20 p-2 rounded-lg">
                      ℹ️ 5-й год ({formatMoney(fifthYearSalary)}) — удержание, в торгах не учитывается
                    </div>
                  </>
                )}

                {lastYearOption !== 'NONE' && (
                  <div className="text-[11px] text-[#3390ec] bg-[#3390ec]/10 border border-[#3390ec]/20 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                    <span>Опция на последний год:</span>
                    <span className="font-bold">
                      {lastYearOption === 'PLAYER_OPTION' ? `Опция игрока (PO) на ${offerYears}-й год` : `Опция команды (TO) на ${offerYears}-й год`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setOfferPlayer(null)} className="flex-1 py-3 bg-[#303030] text-white font-bold rounded-xl text-[13px]">Отмена</button>
              <button onClick={submitOffer} className="flex-1 py-3 bg-[#3390ec] text-white font-bold rounded-xl text-[13px]">Отправить</button>
            </div>
          </div>
        </div>
      )}

      {showGuide && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-[#303030] w-full max-w-2xl h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <MemoTab settings={settings} onClose={() => setShowGuide(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

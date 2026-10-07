import { useState, useEffect } from 'react';
import { DollarSign, BookOpen, Clock, AlertCircle } from 'lucide-react';

type ContractType = 'CUSTOM' | 'MIN' | 'TAX_MLE' | 'FULL_MLE' | 'ROOKIE_MAX' | 'MEDIUM_MAX' | 'VETERAN_MAX' | 'SUPERMAX';

export default function FreeAgencyTab({ role, myTeamId }: { role: string, myTeamId?: string }) {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [activeBlockNum, setActiveBlockNum] = useState<number | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [durationMinutes, setDurationMinutes] = useState(60);

  // Modal State
  const [offerPlayer, setOfferPlayer] = useState<any>(null);
  const [offerType, setOfferType] = useState<ContractType>('CUSTOM');
  const [offerYears, setOfferYears] = useState(1);
  const [salariesArr, setSalariesArr] = useState<string[]>(['']);
  
  const [showGuide, setShowGuide] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const fetchBaseData = async () => {
    try {
      const [tmRes, stRes, blRes] = await Promise.all([
        fetch('http://localhost:3000/teams'),
        fetch('http://localhost:3000/league/settings'),
        fetch('http://localhost:3000/free-agency/blocks', { headers: { 'x-user-role': role } })
      ]);
      const tmData = await tmRes.json();
      const stData = await stRes.json();
      const blData = await blRes.json();
      
      setTeams(Array.isArray(tmData) ? tmData : (tmData.teams || []));
      setSettings(stData);
      setBlocks(blData);
      
      if (blData.length > 0 && !activeBlockNum) {
        const active = blData.find((b: any) => b.is_active) || blData[0];
        setActiveBlockNum(active.number);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBlockPlayers = async (num: number) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/free-agency/blocks/${num}`, { headers: { 'x-user-role': role } });
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, [role]);

  useEffect(() => {
    if (activeBlockNum) {
      fetchBlockPlayers(activeBlockNum);
    }
  }, [activeBlockNum]);

  // Timer logic
  useEffect(() => {
    const activeBlock = blocks.find(b => b.number === activeBlockNum);
    if (!activeBlock || !activeBlock.deadline) {
      setTimeLeft('');
      return;
    }

    const interval = setInterval(() => {
      const diff = new Date(activeBlock.deadline).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00:00 (Дедлайн)');
      } else {
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [blocks, activeBlockNum]);

  const handleApproveBlock = async () => {
    if (!activeBlockNum) return;
    try {
      await fetch(`http://localhost:3000/admin/free-agency/blocks/${activeBlockNum}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ duration_minutes: durationMinutes })
      });
      await fetchBaseData();
    } catch (e) {
      alert('Ошибка');
    }
  };

  const handleFinalizeBlock = async () => {
    if (!activeBlockNum) return;
    if (!confirm('Подписать игроков по лидирующим офферам и закрыть блок?')) return;
    try {
      setLoading(true);
      await fetch(`http://localhost:3000/admin/free-agency/blocks/${activeBlockNum}/finalize`, {
        method: 'POST',
        headers: { 'x-user-role': role }
      });
      await fetchBaseData();
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
      await fetch(`http://localhost:3000/free-agency/offers/${offerId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ action })
      });
      if (activeBlockNum) await fetchBlockPlayers(activeBlockNum);
    } catch (e) {
      alert('Ошибка');
      setLoading(false);
    }
  };

  // Sync array length with offerYears
  useEffect(() => {
    setSalariesArr(prev => {
      const newArr = [...prev];
      if (newArr.length < offerYears) {
        while (newArr.length < offerYears) {
          newArr.push('');
        }
      } else if (newArr.length > offerYears) {
        newArr.length = offerYears;
      }
      return newArr;
    });
  }, [offerYears]);

  const getScheduleForType = (type: ContractType): number[] => {
    if (!settings) return [];
    switch(type) {
      case 'MIN': return settings.min_salary_schedule;
      case 'TAX_MLE': return settings.tax_mle_schedule;
      case 'FULL_MLE': return settings.full_mle_schedule;
      case 'ROOKIE_MAX': return settings.rookie_max_schedule;
      case 'MEDIUM_MAX': return settings.medium_max_schedule;
      case 'VETERAN_MAX': return settings.veteran_max_schedule;
      case 'SUPERMAX': return settings.supermax_schedule;
      default: return [];
    }
  };

  const handleTypeChange = (type: ContractType) => {
    setOfferType(type);
    
    if (type === 'ROOKIE_MAX') {
      if (!offerPlayer.is_rfa) {
        alert('Детский макс доступен ИСКЛЮЧИТЕЛЬНО для RFA-игроков!');
        setOfferType('CUSTOM');
        return;
      }
      setOfferYears(4);
    } else if (type === 'MEDIUM_MAX' || type === 'VETERAN_MAX' || type === 'SUPERMAX') {
      if (offerYears < 4) setOfferYears(4);
    }

    if (type !== 'CUSTOM') {
      const schedule = getScheduleForType(type);
      if (schedule && schedule.length > 0) {
        const targetYears = type === 'ROOKIE_MAX' ? 4 : (offerYears < 4 && type.includes('MAX') ? 4 : offerYears);
        setOfferYears(targetYears);
        const newArr = Array(targetYears).fill('');
        for (let i = 0; i < targetYears; i++) {
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
    if (offerType === 'ROOKIE_MAX') return [4];
    if (offerType === 'MEDIUM_MAX' || offerType === 'VETERAN_MAX' || offerType === 'SUPERMAX') return [4, 5];
    return [1, 2, 3, 4, 5];
  };

  const formatMoney = (amount: number) => `$${(amount / 1000000).toFixed(1)}M`;
  const totalOfferSum = salariesArr.reduce((sum, val) => sum + (parseFloat(val) || 0), 0) * 1000000;
  const avgOfferSum = offerYears > 0 ? totalOfferSum / offerYears : 0;

  const submitOffer = async () => {
    if (!offerPlayer || !myTeamId) return;
    const parsedSalaries = salariesArr.map(s => parseFloat(s) * 1000000);
    if (parsedSalaries.some(s => isNaN(s) || s <= 0)) return alert('Заполните все зарплаты корректно');
    
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3000/free-agency/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({
          player_id: offerPlayer.id,
          team_id: myTeamId,
          offer_type: offerType,
          salaries: parsedSalaries
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при отправке');
      
      setOfferPlayer(null);
      setOfferType('CUSTOM');
      setSalariesArr(['']);
      setOfferYears(1);
      if (activeBlockNum) await fetchBlockPlayers(activeBlockNum);
    } catch (e: any) {
      alert(e.message);
      setLoading(false);
    }
  };

  const myTeam = teams.find(t => t.id === myTeamId);
  const myTeamPayroll = (myTeam?.players || []).reduce((sum: number, p: any) => sum + p.salary, 0);

  const activeBlockData = blocks.find(b => b.number === activeBlockNum);

  if (!blocks.length) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
        <AlertCircle width="48" height="48" className="mb-4 opacity-50" />
        <div className="text-center font-bold">Администратор лиги формирует пул свободных агентов.<br/>Ожидайте открытия 1-го блока.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#181818] pb-[100px] relative">
      
      {/* Header and Guide Button */}
      <div className="p-4 bg-[#212121] border-b border-[#303030] flex justify-between items-center z-10 sticky top-0">
        <div className="font-bold text-white flex items-center gap-2">
          Рынок СА
        </div>
        <button onClick={() => setShowGuide(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3390ec]/10 text-[#3390ec] font-bold text-[12px] rounded-lg">
          <BookOpen width="16" height="16" /> Памятка
        </button>
      </div>

      {/* Block Tabs */}
      <div className="flex overflow-x-auto p-3 gap-2 border-b border-[#303030] no-scrollbar">
        {blocks.map(b => (
          <button 
            key={b.number}
            onClick={() => setActiveBlockNum(b.number)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${activeBlockNum === b.number ? 'bg-[#3390ec] text-white' : 'bg-[#212121] text-[#8e8e93]'}`}
          >
            {b.is_active && '🔥'} Блок {b.number} {!b.is_approved && '(Не утв.)'}
          </button>
        ))}
      </div>

      {/* Block Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeBlockData && !activeBlockData.is_approved && role === 'ADMIN' && (
          <div className="bg-[#ff9f0a]/10 border border-[#ff9f0a]/30 p-4 rounded-xl mb-4">
            <h3 className="font-bold text-[#ff9f0a] mb-2">Запуск Блока {activeBlockData.number}</h3>
            <div className="flex items-center gap-3">
              <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} className="w-20 p-2 bg-[#181818] border border-[#303030] rounded-lg text-white text-center font-bold" />
              <span className="text-[13px] text-[#8e8e93]">минут</span>
              <button onClick={handleApproveBlock} className="ml-auto bg-[#ff9f0a] text-black px-4 py-2 rounded-lg font-bold text-[13px]">🚀 Утвердить и запустить</button>
            </div>
          </div>
        )}

        {activeBlockData && activeBlockData.is_active && (
          <div className="bg-[#212121] border border-[#303030] p-4 rounded-xl mb-4 flex justify-between items-center">
            <div className="flex items-center gap-2 text-[#34c759] font-bold">
              <Clock width="18" height="18" />
              <span>⏳ До закрытия: {timeLeft}</span>
            </div>
            {role === 'ADMIN' && (
              <button onClick={handleFinalizeBlock} className="bg-[#ff3b30]/10 text-[#ff3b30] px-3 py-1.5 rounded-lg font-bold text-[12px]">Закрыть досрочно</button>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-[#8e8e93] font-bold">Загрузка игроков...</div>
        ) : (
          <div className="space-y-4">
            {players.map(p => {
              const topOffer = p.contract_offers?.[0];
              const isMyRFA = p.is_rfa && p.previous_team_id === myTeamId;
              const hasOffer = !!topOffer;
              const canMatch = isMyRFA && hasOffer && topOffer.status === 'PENDING';
              const previousTeamName = teams.find(t => t.id === p.previous_team_id)?.name;
              const topOfferTotal = topOffer ? (topOffer.salaries?.length > 0 ? topOffer.salaries.reduce((a: number, b: number) => a + b, 0) : topOffer.annual_salary * topOffer.years) : 0;

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

                  {hasOffer && (
                    <div className="mt-3 p-3 bg-[#181818] rounded-xl border border-[#303030]">
                      <div className="text-[11px] text-[#8e8e93] mb-1">Лидирующее предложение:</div>
                      <div className="text-[13px] font-bold text-white">
                        {topOffer.team.name} — <span className="text-[#34c759]">{formatMoney(topOfferTotal)}</span> на {topOffer.years} г.
                      </div>
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
                          }} 
                          disabled={!myTeamId || (!activeBlockData?.is_active && role !== 'ADMIN')}
                          className="flex-1 py-2.5 bg-[#3390ec]/10 text-[#3390ec] font-bold rounded-xl text-[12px] active:scale-[0.98] disabled:opacity-50"
                        >
                          Сделать оффер
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Offer Modal */}
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
                      onClick={() => setOfferYears(y)} 
                      className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-colors ${offerYears === y ? 'bg-[#3390ec] text-white' : 'bg-[#181818] border border-[#303030] text-[#8e8e93]'}`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-[#8e8e93] block mb-1">Зарплата по годам ($M)</label>
                {salariesArr.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[12px] text-[#8e8e93] w-12 shrink-0">Год {idx + 1}</span>
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

              <div className="bg-[#181818] p-3 rounded-xl border border-[#303030] space-y-1">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#8e8e93]">Итоговая сумма:</span>
                  <span className="font-bold text-white">{formatMoney(totalOfferSum)}</span>
                </div>
                {settings && myTeam && (
                  <div className="flex justify-between text-[12px] mt-2 pt-2 border-t border-[#303030]">
                    <span className="text-[#8e8e93]">Проекция (Год 1):</span>
                    <span className={`font-bold ${(myTeamPayroll + ((parseFloat(salariesArr[0])||0)*1000000)) > settings.hard_cap ? 'text-[#ff3b30]' : 'text-[#34c759]'}`}>
                      {formatMoney(myTeamPayroll + ((parseFloat(salariesArr[0])||0)*1000000))} / {formatMoney(settings.hard_cap)} (Hard)
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

      {/* Financial Guide Modal */}
      {showGuide && settings && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#212121] border border-[#303030] w-full max-w-2xl rounded-2xl flex flex-col shadow-2xl max-h-[90vh]">
            <div className="p-4 border-b border-[#303030] flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">📖 Памятка по контрактам</h2>
              <button onClick={() => setShowGuide(false)} className="text-[#8e8e93] hover:text-white font-bold text-xl">&times;</button>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-[12px] text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="text-[#8e8e93] border-b border-[#303030]">
                    <th className="pb-2">Тип</th>
                    <th className="pb-2">Год 1</th>
                    <th className="pb-2">Год 2</th>
                    <th className="pb-2">Год 3</th>
                    <th className="pb-2">Год 4</th>
                    <th className="pb-2">Год 5</th>
                    <th className="pb-2">Ограничения</th>
                  </tr>
                </thead>
                <tbody className="text-white divide-y divide-[#303030]/50">
                  <tr>
                    <td className="py-3 font-bold">Min Salary</td>
                    <td>{settings.min_salary_schedule[0] || '-'}</td>
                    <td>{settings.min_salary_schedule[1] || '-'}</td>
                    <td>{settings.min_salary_schedule[2] || '-'}</td>
                    <td>{settings.min_salary_schedule[3] || '-'}</td>
                    <td>{settings.min_salary_schedule[4] || '-'}</td>
                    <td className="text-[#8e8e93]">1-5 лет</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-[#ff9f0a]">Tax MLE</td>
                    <td>{settings.tax_mle_schedule[0] || '-'}</td>
                    <td>{settings.tax_mle_schedule[1] || '-'}</td>
                    <td>{settings.tax_mle_schedule[2] || '-'}</td>
                    <td>-</td>
                    <td>-</td>
                    <td className="text-[#8e8e93]">До 3 лет</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-[#34c759]">Full MLE</td>
                    <td>{settings.full_mle_schedule[0] || '-'}</td>
                    <td>{settings.full_mle_schedule[1] || '-'}</td>
                    <td>{settings.full_mle_schedule[2] || '-'}</td>
                    <td>{settings.full_mle_schedule[3] || '-'}</td>
                    <td>-</td>
                    <td className="text-[#8e8e93]">До 4 лет</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-[#3390ec]">Детский макс</td>
                    <td>{settings.rookie_max_schedule[0] || '-'}</td>
                    <td>{settings.rookie_max_schedule[1] || '-'}</td>
                    <td>{settings.rookie_max_schedule[2] || '-'}</td>
                    <td>{settings.rookie_max_schedule[3] || '-'}</td>
                    <td>-</td>
                    <td className="text-[#ff3b30] font-bold">Строго 4 года, Только RFA</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-[#3390ec]">Средний макс</td>
                    <td>{settings.medium_max_schedule[0] || '-'}</td>
                    <td>{settings.medium_max_schedule[1] || '-'}</td>
                    <td>{settings.medium_max_schedule[2] || '-'}</td>
                    <td>{settings.medium_max_schedule[3] || '-'}</td>
                    <td>{settings.medium_max_schedule[4] || '-'}</td>
                    <td className="text-[#8e8e93]">4-5 лет</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-[#3390ec]">Взрослый макс</td>
                    <td>{settings.veteran_max_schedule[0] || '-'}</td>
                    <td>{settings.veteran_max_schedule[1] || '-'}</td>
                    <td>{settings.veteran_max_schedule[2] || '-'}</td>
                    <td>{settings.veteran_max_schedule[3] || '-'}</td>
                    <td>{settings.veteran_max_schedule[4] || '-'}</td>
                    <td className="text-[#8e8e93]">4-5 лет</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-[#bf5af2]">Supermax</td>
                    <td>{settings.supermax_schedule[0] || '-'}</td>
                    <td>{settings.supermax_schedule[1] || '-'}</td>
                    <td>{settings.supermax_schedule[2] || '-'}</td>
                    <td>{settings.supermax_schedule[3] || '-'}</td>
                    <td>{settings.supermax_schedule[4] || '-'}</td>
                    <td className="text-[#bf5af2] font-bold">4-5 лет, Только родной клуб</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[#303030]">
              <button onClick={() => setShowGuide(false)} className="w-full py-3 bg-[#3390ec] text-white rounded-xl font-bold">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

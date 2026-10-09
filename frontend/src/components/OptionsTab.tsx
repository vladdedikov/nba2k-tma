import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

export default function OptionsTab({ role }: { role: string }) {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'PO' | 'TO'>('PO');

  const fetchOptions = async () => {
    try {
      const res = await fetch('/api/offseason/options');
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const handleResolve = async (id: string, decision: 'ACCEPT' | 'DECLINE') => {
    if (!confirm(`Вы уверены, что хотите ${decision === 'ACCEPT' ? 'принять' : 'отклонить'} опцию?`)) return;
    try {
      await fetch(`/api/offseason/options/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({ decision })
      });
      fetchOptions();
    } catch (e) {
      alert('Ошибка при сохранении решения');
    }
  };

  if (loading) return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3390ec] mb-4"></div>
      <div className="text-sm font-bold">Загрузка опций...</div>
    </div>
  );

  const poPlayers = players.filter(p => p.option_type === 'PLAYER_OPTION');
  const toPlayers = players.filter(p => p.option_type === 'TEAM_OPTION');

  const formatMoney = (amount: number) => `$${(amount / 1000000).toFixed(1)}M`;

  return (
    <div className="flex flex-col h-full bg-[#181818] pb-[100px]">
      <div className="flex bg-[#212121] p-2 gap-2 shadow-sm sticky top-0 z-10 border-b border-[#303030]">
        <button onClick={() => setTab('PO')} className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors ${tab === 'PO' ? 'bg-[#3390ec] text-white' : 'text-[#8e8e93] hover:bg-[#303030]'}`}>
          Опции игроков (PO)
        </button>
        <button onClick={() => setTab('TO')} className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors ${tab === 'TO' ? 'bg-[#3390ec] text-white' : 'text-[#8e8e93] hover:bg-[#303030]'}`}>
          Опции команды (TO)
        </button>
      </div>

      <div className="p-4 space-y-4">
        {tab === 'PO' && (
          <div>
            <div className="text-[13px] text-[#8e8e93] mb-4">Администратор решает, принимает ли игрок свою опцию.</div>
            <div className="space-y-3">
              {poPlayers.length === 0 ? <div className="text-center text-[#8e8e93] py-10">Нет активных PO</div> : poPlayers.map(p => (
                <div key={p.id} className="bg-[#212121] p-4 rounded-2xl shadow-sm border border-[#303030]">
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-bold text-white text-[15px]">{p.name} <span className="text-[#8e8e93] text-[12px] ml-1">({p.team?.name})</span></div>
                    <div className="font-bold text-[#ff9f0a]">{formatMoney(p.salary)}</div>
                  </div>
                  <div className="text-[12px] text-[#8e8e93] mb-3">Опция игрока (PO) на {p.contract_years_left} год</div>
                  {role === 'ADMIN' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleResolve(p.id, 'ACCEPT')} className="flex-1 py-2 bg-[#34c759]/10 text-[#34c759] font-bold rounded-lg text-[12px] flex justify-center items-center gap-1 active:scale-95"><Check width="14" height="14"/> Принять опцию</button>
                      <button onClick={() => handleResolve(p.id, 'DECLINE')} className="flex-1 py-2 bg-[#ff3b30]/10 text-[#ff3b30] font-bold rounded-lg text-[12px] flex justify-center items-center gap-1 active:scale-95"><X width="14" height="14"/> Отказаться (СА)</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'TO' && (
          <div>
            <div className="text-[13px] text-[#8e8e93] mb-4">Владелец команды (или Админ) решает, продлевать ли контракт игрока.</div>
            <div className="space-y-3">
              {toPlayers.length === 0 ? <div className="text-center text-[#8e8e93] py-10">Нет активных TO</div> : toPlayers.map(p => (
                <div key={p.id} className="bg-[#212121] p-4 rounded-2xl shadow-sm border border-[#303030]">
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-bold text-white text-[15px]">{p.name} <span className="text-[#8e8e93] text-[12px] ml-1">({p.team?.name})</span></div>
                    <div className="font-bold text-[#34c759]">{formatMoney(p.salary)}</div>
                  </div>
                  <div className="text-[12px] text-[#8e8e93] mb-3">Опция команды (TO) на {p.contract_years_left} год</div>
                  {role === 'ADMIN' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleResolve(p.id, 'ACCEPT')} className="flex-1 py-2 bg-[#34c759]/10 text-[#34c759] font-bold rounded-lg text-[12px] flex justify-center items-center gap-1 active:scale-95"><Check width="14" height="14"/> Оставить в команде</button>
                      <button onClick={() => handleResolve(p.id, 'DECLINE')} className="flex-1 py-2 bg-[#ff3b30]/10 text-[#ff3b30] font-bold rounded-lg text-[12px] flex justify-center items-center gap-1 active:scale-95"><X width="14" height="14"/> Отчислить (СА)</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

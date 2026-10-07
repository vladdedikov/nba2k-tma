import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, ArrowRightLeft } from 'lucide-react';

export default function TradeMachineTab() {
  const [subTab, setSubTab] = useState<'BUILDER' | 'OFFERS'>('BUILDER');
  
  const [teams, setTeams] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  
  const [myTeamId, setMyTeamId] = useState<string>('');
  const [partnerTeamId, setPartnerTeamId] = useState<string>('');
  
  const [selectedMyPlayers, setSelectedMyPlayers] = useState<Set<string>>(new Set());
  const [selectedPartnerPlayers, setSelectedPartnerPlayers] = useState<Set<string>>(new Set());
  const [selectedMyPicks, setSelectedMyPicks] = useState<Set<string>>(new Set());
  const [selectedPartnerPicks, setSelectedPartnerPicks] = useState<Set<string>>(new Set());
  
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [teamsRes, setRes, offRes] = await Promise.all([
        fetch('http://localhost:3000/teams'),
        fetch('http://localhost:3000/league/settings'),
        fetch('http://localhost:3000/trades')
      ]);
      const teamsData = await teamsRes.json();
      const setData = await setRes.json();
      const offData = await offRes.json();
      
      const safeTeams = Array.isArray(teamsData) ? teamsData : (teamsData.teams || []);
      
      setTeams(safeTeams);
      setSettings(setData);
      setOffers(offData);
      if (safeTeams.length >= 2 && !myTeamId) {
        setMyTeamId(safeTeams[0].id);
        setPartnerTeamId(safeTeams[1].id);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatMoney = (amount: number) => `$${(amount / 1000000).toFixed(1)}M`;

  // Validation Logic
  const safeTeamsArray = Array.isArray(teams) ? teams : [];
  const myTeam = safeTeamsArray.find(t => t.id === myTeamId);
  const partnerTeam = safeTeamsArray.find(t => t.id === partnerTeamId);

  const getPlayersBySet = (team: any, ids: Set<string>) => (team?.players || []).filter((p: any) => ids.has(p.id));
  const getPicksBySet = (team: any, ids: Set<string>) => (team?.current_picks || team?.currentPicks || []).filter((p: any) => ids.has(p.id));

  const myOutgoingPlayers = getPlayersBySet(myTeam, selectedMyPlayers);
  const myIncomingPlayers = getPlayersBySet(partnerTeam, selectedPartnerPlayers);

  const myOutgoingSalary = myOutgoingPlayers.reduce((sum: number, p: any) => sum + p.salary, 0);
  const myIncomingSalary = myIncomingPlayers.reduce((sum: number, p: any) => sum + p.salary, 0);

  const partnerOutgoingSalary = myIncomingSalary;
  const partnerIncomingSalary = myOutgoingSalary;

  const getTeamPayroll = (team: any) => (team?.players || []).reduce((sum: number, p: any) => sum + p.salary, 0);
  const myPayroll = getTeamPayroll(myTeam);
  const partnerPayroll = getTeamPayroll(partnerTeam);

  const safeSoftCap = settings?.soft_cap ?? 140000000;
  const safeFirstApron = settings?.first_apron ?? 178000000;

  const validateSide = (payroll: number, outSal: number, inSal: number) => {
    const postTrade = payroll - outSal + inSal;
    if (postTrade <= safeSoftCap) return { valid: true };
    if (payroll < safeFirstApron) {
      if (inSal <= outSal * 1.25 + 250000) return { valid: true };
      return { valid: false, err: `Превышение: макс $${((outSal * 1.25 + 250000)/1000000).toFixed(1)}M` };
    } else {
      if (inSal <= outSal) return { valid: true };
      return { valid: false, err: `Нельзя принять больше $${(outSal/1000000).toFixed(1)}M` };
    }
  };

  const myValidation = validateSide(myPayroll, myOutgoingSalary, myIncomingSalary);
  const partnerValidation = validateSide(partnerPayroll, partnerOutgoingSalary, partnerIncomingSalary);
  const isValid = myValidation.valid && partnerValidation.valid;

  const toggleSet = (set: Set<string>, id: string, setter: any) => {
    const newSet = new Set(set);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setter(newSet);
  };

  const handleSendOffer = async () => {
    if (!isValid) return alert('Обмен невалиден');
    try {
      await fetch('http://localhost:3000/trades/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_team_id: myTeamId,
          receiver_team_id: partnerTeamId,
          sent_player_ids: Array.from(selectedMyPlayers),
          received_player_ids: Array.from(selectedPartnerPlayers),
          sent_pick_ids: Array.from(selectedMyPicks),
          received_pick_ids: Array.from(selectedPartnerPicks),
          message
        })
      });
      alert('Оффер отправлен!');
      setSelectedMyPlayers(new Set());
      setSelectedPartnerPlayers(new Set());
      setSelectedMyPicks(new Set());
      setSelectedPartnerPicks(new Set());
      setMessage('');
      fetchData();
      setSubTab('OFFERS');
    } catch (e) {
      alert('Ошибка');
    }
  };

  const respondToOffer = async (id: string, action: string) => {
    try {
      const res = await fetch(`http://localhost:3000/trades/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else alert('Успешно!');
      fetchData();
    } catch (e) {
      alert('Ошибка');
    }
  };

  const isTradeDeadline = settings?.current_stage === 'TRADE_DEADLINE';

  if (loading) return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3390ec] mb-4"></div>
      <div className="text-sm font-bold">Загрузка лиги...</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#181818] pb-[100px]">
      <div className="flex bg-[#212121] p-2 gap-2 shadow-sm sticky top-0 z-10 border-b border-[#303030]">
        <button onClick={() => setSubTab('BUILDER')} className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors ${subTab === 'BUILDER' ? 'bg-[#3390ec] text-white' : 'text-[#8e8e93] hover:bg-[#303030]'}`}>
          Конструктор
        </button>
        <button onClick={() => setSubTab('OFFERS')} className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors ${subTab === 'OFFERS' ? 'bg-[#3390ec] text-white' : 'text-[#8e8e93] hover:bg-[#303030]'}`}>
          Офферы лиги
        </button>
      </div>

      {isTradeDeadline && (
        <div className="p-4 bg-[#ff3b30]/10 border-b border-[#ff3b30]/20 text-[#ff3b30] text-[13px] font-bold text-center flex flex-col items-center gap-1 shadow-sm">
          <span className="text-[16px]">🔒</span>
          Трейд-дедлайн наступил! Обмены заморожены до старта межсезонья.
        </div>
      )}

      <div className="p-4">
        {subTab === 'BUILDER' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[12px] text-[#8e8e93] font-bold mb-1 block">Моя команда</label>
                <select value={myTeamId} onChange={e => setMyTeamId(e.target.value)} className="w-full p-2 bg-[#212121] border border-[#303030] rounded-xl text-[14px] text-white font-bold outline-none">
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[12px] text-[#8e8e93] font-bold mb-1 block">Команда партнера</label>
                <select value={partnerTeamId} onChange={e => setPartnerTeamId(e.target.value)} className="w-full p-2 bg-[#212121] border border-[#303030] rounded-xl text-[14px] text-white font-bold outline-none">
                  {teams.filter(t => t.id !== myTeamId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              {/* My Team Column */}
              <div className="flex-1 space-y-2">
                <div className="font-bold text-center border-b border-[#303030] pb-2 text-[13px]">Отдаем</div>
                <div className="h-[250px] overflow-y-auto space-y-1 pr-1">
                  {(myTeam?.players || []).map((p: any) => {
                    const restricted = p.is_trade_restricted;
                    return (
                      <div key={p.id} onClick={() => !isTradeDeadline && !restricted && toggleSet(selectedMyPlayers, p.id, setSelectedMyPlayers)} className={`p-2 rounded-lg border text-[12px] transition-colors ${(isTradeDeadline || restricted) ? 'cursor-not-allowed opacity-50 bg-[#212121] border-transparent' : 'cursor-pointer'} ${selectedMyPlayers.has(p.id) ? 'bg-[#3390ec]/20 border-[#3390ec]' : 'bg-[#212121] border-transparent'}`}>
                        <div className="font-bold">{restricted && '🔒 '}{p.name}</div>
                        <div className="text-[#8e8e93]">{formatMoney(p.salary)}</div>
                      </div>
                    );
                  })}
                  {(myTeam?.current_picks || myTeam?.currentPicks || []).map((p: any) => (
                    <div key={p.id} onClick={() => !isTradeDeadline && toggleSet(selectedMyPicks, p.id, setSelectedMyPicks)} className={`p-2 rounded-lg border text-[12px] transition-colors ${isTradeDeadline ? 'cursor-not-allowed opacity-50 bg-[#212121] border-transparent' : 'cursor-pointer'} ${selectedMyPicks.has(p.id) ? 'bg-[#3390ec]/20 border-[#3390ec]' : 'bg-[#212121] border-transparent'}`}>
                      <div className="font-bold">Пик {p.year} R{p.round}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-[#212121] p-2 rounded-xl text-center text-[12px] shadow-sm">
                  <div className="text-[#8e8e93]">Уходит</div>
                  <div className="font-bold text-[#ff3b30]">{formatMoney(myOutgoingSalary)}</div>
                  <div className="text-[#8e8e93] mt-1">Приходит</div>
                  <div className="font-bold text-[#34c759]">{formatMoney(myIncomingSalary)}</div>
                  <div className="mt-2 flex justify-center">
                    {myValidation.valid ? <CheckCircle2 width="20" height="20" className="text-[#34c759]" style={{ minWidth: 20, minHeight: 20, maxWidth: 20, maxHeight: 20 }}/> : <div className="text-[10px] text-[#ff3b30] leading-tight">{myValidation.err}</div>}
                  </div>
                </div>
              </div>

              {/* Partner Team Column */}
              <div className="flex-1 space-y-2">
                <div className="font-bold text-center border-b border-[#303030] pb-2 text-[13px]">Получаем</div>
                <div className="h-[250px] overflow-y-auto space-y-1 pr-1">
                  {(partnerTeam?.players || []).map((p: any) => {
                    const restricted = p.is_trade_restricted;
                    return (
                      <div key={p.id} onClick={() => !isTradeDeadline && !restricted && toggleSet(selectedPartnerPlayers, p.id, setSelectedPartnerPlayers)} className={`p-2 rounded-lg border text-[12px] transition-colors ${(isTradeDeadline || restricted) ? 'cursor-not-allowed opacity-50 bg-[#212121] border-transparent' : 'cursor-pointer'} ${selectedPartnerPlayers.has(p.id) ? 'bg-[#3390ec]/20 border-[#3390ec]' : 'bg-[#212121] border-transparent'}`}>
                        <div className="font-bold">{restricted && '🔒 '}{p.name}</div>
                        <div className="text-[#8e8e93]">{formatMoney(p.salary)}</div>
                      </div>
                    );
                  })}
                  {(partnerTeam?.current_picks || partnerTeam?.currentPicks || []).map((p: any) => (
                    <div key={p.id} onClick={() => !isTradeDeadline && toggleSet(selectedPartnerPicks, p.id, setSelectedPartnerPicks)} className={`p-2 rounded-lg border text-[12px] transition-colors ${isTradeDeadline ? 'cursor-not-allowed opacity-50 bg-[#212121] border-transparent' : 'cursor-pointer'} ${selectedPartnerPicks.has(p.id) ? 'bg-[#3390ec]/20 border-[#3390ec]' : 'bg-[#212121] border-transparent'}`}>
                      <div className="font-bold">Пик {p.year} R{p.round}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-[#212121] p-2 rounded-xl text-center text-[12px] shadow-sm">
                  <div className="text-[#8e8e93]">Уходит</div>
                  <div className="font-bold text-[#ff3b30]">{formatMoney(partnerOutgoingSalary)}</div>
                  <div className="text-[#8e8e93] mt-1">Приходит</div>
                  <div className="font-bold text-[#34c759]">{formatMoney(partnerIncomingSalary)}</div>
                  <div className="mt-2 flex justify-center">
                    {partnerValidation.valid ? <CheckCircle2 width="20" height="20" className="text-[#34c759]" style={{ minWidth: 20, minHeight: 20, maxWidth: 20, maxHeight: 20 }}/> : <div className="text-[10px] text-[#ff3b30] leading-tight">{partnerValidation.err}</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#303030]">
              <textarea 
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Комментарий к офферу (опционально)..."
                disabled={isTradeDeadline}
                className="w-full p-3 bg-[#212121] border border-[#303030] rounded-xl text-[13px] text-white outline-none mb-3 resize-none h-[80px] disabled:opacity-50"
              />
              <button 
                onClick={handleSendOffer}
                disabled={!isValid || isTradeDeadline || (selectedMyPlayers.size===0 && selectedPartnerPlayers.size===0 && selectedMyPicks.size===0 && selectedPartnerPicks.size===0)}
                className={`w-full py-3.5 rounded-xl font-bold transition-transform ${(!isValid || isTradeDeadline || (selectedMyPlayers.size===0 && selectedPartnerPlayers.size===0 && selectedMyPicks.size===0 && selectedPartnerPicks.size===0)) ? 'bg-[#303030] text-[#8e8e93]' : 'bg-[#3390ec] text-white hover:bg-[#2b7bc4] active:scale-[0.98]'}`}
              >
                {isTradeDeadline ? 'Обмены заморожены' : 'Отправить оффер'}
              </button>
            </div>
          </div>
        )}

        {subTab === 'OFFERS' && (
          <div className="space-y-4">
            {offers.length === 0 ? (
              <div className="text-center text-[#8e8e93] py-10 bg-[#212121] rounded-xl">Нет активных предложений</div>
            ) : (
              offers.map(o => (
                <OfferCard 
                  key={o.id} 
                  offer={o} 
                  allPlayers={safeTeamsArray.flatMap((t: any) => t.players || [])} 
                  allPicks={safeTeamsArray.flatMap((t: any) => t.currentPicks || t.current_picks || [])}
                  respondToOffer={respondToOffer} 
                  isTradeDeadline={isTradeDeadline}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OfferCard({ offer, allPlayers, allPicks, respondToOffer, isTradeDeadline }: any) {
  const [expanded, setExpanded] = useState(offer.status === 'PENDING');

  const getP = (id: string) => allPlayers.find((p: any) => p.id === id) || { name: 'Неизвестный игрок', overall_rating: 0, salary: 0 };
  const getPk = (id: string) => allPicks.find((p: any) => p.id === id) || { year: '?', round: '?' };

  const teamA = offer.sender_team;
  const teamB = offer.receiver_team;

  // teamA sends to teamB -> teamB receives
  // teamB sends to teamA -> teamA receives
  const aReceivesPlayers = offer.received_player_ids.map(getP);
  const aReceivesPicks = offer.received_pick_ids.map(getPk);
  
  const bReceivesPlayers = offer.sent_player_ids.map(getP);
  const bReceivesPicks = offer.sent_pick_ids.map(getPk);

  const aReceivesSalary = aReceivesPlayers.reduce((sum: number, p: any) => sum + (p.salary || 0), 0);
  const bReceivesSalary = bReceivesPlayers.reduce((sum: number, p: any) => sum + (p.salary || 0), 0);

  const formatMoney = (amount: number) => `$${(amount / 1000000).toFixed(1)}M`;
  const dateStr = new Date(offer.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  
  const statusBadge = {
    PENDING: { text: 'Ожидает', classes: 'bg-[#ff9f0a]/20 text-[#ff9f0a]' },
    ACCEPTED: { text: 'Принято', classes: 'bg-[#34c759]/20 text-[#34c759]' },
    REJECTED: { text: 'Отклонено', classes: 'bg-[#ff3b30]/20 text-[#ff3b30]' },
  }[offer.status as string] || { text: offer.status, classes: 'bg-[#303030] text-[#8e8e93]' };

  const getCompactPreview = (players: any[], picks: any[]) => {
    const items = [];
    if (players[0]) items.push(players[0].name);
    if (players[1]) items.push(players[1].name);
    if (items.length === 0 && picks[0]) items.push(`Пик ${picks[0].year} R${picks[0].round}`);
    if (players.length + picks.length > items.length) items.push(`еще ${players.length + picks.length - items.length}`);
    return items.join(', ') || 'Ничего';
  };

  return (
    <div className="bg-[#212121] rounded-2xl shadow-sm border border-[#303030] overflow-hidden">
      {/* Header */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-4 cursor-pointer hover:bg-[#2a2a2a] transition-colors"
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="font-bold text-[13px] text-white truncate">{teamA.name}</span>
            </div>
            <ArrowRightLeft width="14" height="14" className="text-[#8e8e93] shrink-0" style={{ minWidth: 14, minHeight: 14, maxWidth: 14, maxHeight: 14 }} />
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
              <span className="font-bold text-[13px] text-white truncate">{teamB.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <div className={`text-[10px] font-bold px-2 py-1 rounded ${statusBadge.classes}`}>
              {statusBadge.text}
            </div>
            {expanded ? <ChevronUp width="16" height="16" className="text-[#8e8e93]" style={{ minWidth: 16, minHeight: 16 }} /> : <ChevronDown width="16" height="16" className="text-[#8e8e93]" style={{ minWidth: 16, minHeight: 16 }} />}
          </div>
        </div>

        {/* Compact Preview (only if collapsed) */}
        {!expanded && (
          <div className="flex justify-between items-center text-[12px] text-[#8e8e93] bg-[#181818] p-2 rounded-lg">
            <div className="truncate flex-1 pr-2">{getCompactPreview(aReceivesPlayers, aReceivesPicks)}</div>
            <ArrowRightLeft width="12" height="12" className="shrink-0 opacity-50" />
            <div className="truncate flex-1 pl-2 text-right">{getCompactPreview(bReceivesPlayers, bReceivesPicks)}</div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#303030] pt-4">
          <div className="flex flex-col gap-4">
            
            {/* Block 1: Team A Receives */}
            <div className="bg-[#181818] rounded-xl p-3">
              <div className="text-[12px] font-bold text-[#3390ec] mb-2">{teamA.name} получает:</div>
              <div className="space-y-1.5">
                {aReceivesPlayers.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[13px]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center bg-[#303030] rounded text-[10px] font-bold text-[#8e8e93]">{p.overall_rating}</span>
                      <span className="text-white">{p.name}</span>
                    </div>
                    <span className="text-[#8e8e93]">{formatMoney(p.salary || 0)}</span>
                  </div>
                ))}
                {aReceivesPicks.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[13px]">
                    <span className="text-white">Пик {p.year} Раунд {p.round}</span>
                    <span className="text-[#8e8e93] text-[10px]">DRAFT</span>
                  </div>
                ))}
                {aReceivesPlayers.length === 0 && aReceivesPicks.length === 0 && (
                  <div className="text-[#8e8e93] text-[12px] italic">Ничего</div>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-[#303030] flex justify-between items-center">
                <span className="text-[11px] text-[#8e8e93]">Сумма зарплат:</span>
                <span className="font-bold text-[13px] text-[#34c759]">{formatMoney(aReceivesSalary)}</span>
              </div>
            </div>

            {/* Block 2: Team B Receives */}
            <div className="bg-[#181818] rounded-xl p-3">
              <div className="text-[12px] font-bold text-[#3390ec] mb-2">{teamB.name} получает:</div>
              <div className="space-y-1.5">
                {bReceivesPlayers.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[13px]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center bg-[#303030] rounded text-[10px] font-bold text-[#8e8e93]">{p.overall_rating}</span>
                      <span className="text-white">{p.name}</span>
                    </div>
                    <span className="text-[#8e8e93]">{formatMoney(p.salary || 0)}</span>
                  </div>
                ))}
                {bReceivesPicks.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[13px]">
                    <span className="text-white">Пик {p.year} Раунд {p.round}</span>
                    <span className="text-[#8e8e93] text-[10px]">DRAFT</span>
                  </div>
                ))}
                {bReceivesPlayers.length === 0 && bReceivesPicks.length === 0 && (
                  <div className="text-[#8e8e93] text-[12px] italic">Ничего</div>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-[#303030] flex justify-between items-center">
                <span className="text-[11px] text-[#8e8e93]">Сумма зарплат:</span>
                <span className="font-bold text-[13px] text-[#34c759]">{formatMoney(bReceivesSalary)}</span>
              </div>
            </div>

          </div>

          {offer.message && (
            <div className="mt-3 text-[12px] italic text-[#8e8e93] bg-[#181818] p-3 rounded-xl border border-[#303030]/50">
              «{offer.message}»
            </div>
          )}
          <div className="text-[10px] text-[#8e8e93] mt-2 text-right">
            Создано: {dateStr}
          </div>
          
          {offer.status === 'PENDING' && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-[#303030]">
              <button 
                disabled={isTradeDeadline}
                onClick={(e) => { e.stopPropagation(); respondToOffer(offer.id, 'ACCEPT'); }} 
                className={`flex-1 py-3 font-bold rounded-xl text-[13px] transition-transform ${isTradeDeadline ? 'bg-[#303030] text-[#8e8e93]' : 'bg-[#34c759] text-white hover:bg-[#2eb050] active:scale-[0.98]'}`}
              >
                {isTradeDeadline ? 'Дедлайн истек' : 'Принять'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); respondToOffer(offer.id, 'REJECT'); }} className="flex-1 py-3 bg-[#ff3b30]/10 text-[#ff3b30] font-bold rounded-xl text-[13px] hover:bg-[#ff3b30]/20 active:scale-[0.98] transition-transform">Отклонить</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

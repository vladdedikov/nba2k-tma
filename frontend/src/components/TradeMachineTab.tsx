import { useState, useEffect } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ArrowRightLeft, Inbox, Send, Globe, AlertCircle } from 'lucide-react';

export default function TradeMachineTab({ role = 'PLAYER', myTeamId: propMyTeamId = '' }: { role?: 'PLAYER' | 'ADMIN', myTeamId?: string }) {
  const [subTab, setSubTab] = useState<'BUILDER' | 'OFFERS'>('BUILDER');
  const [offersFilter, setOffersFilter] = useState<'ALL' | 'INCOMING' | 'OUTGOING'>(role === 'ADMIN' ? 'ALL' : 'INCOMING');
  
  const [teams, setTeams] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  
  const [myTeamId, setMyTeamId] = useState<string>(propMyTeamId || '');
  const [partnerTeamId, setPartnerTeamId] = useState<string>('');
  
  const [selectedMyPlayers, setSelectedMyPlayers] = useState<Set<string>>(new Set());
  const [selectedPartnerPlayers, setSelectedPartnerPlayers] = useState<Set<string>>(new Set());
  const [selectedMyPicks, setSelectedMyPicks] = useState<Set<string>>(new Set());
  const [selectedPartnerPicks, setSelectedPartnerPicks] = useState<Set<string>>(new Set());
  
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propMyTeamId) {
      setMyTeamId(propMyTeamId);
    }
  }, [propMyTeamId]);

  const fetchData = async () => {
    try {
      const activeMy = propMyTeamId || myTeamId || '';
      const [teamsRes, setRes, offRes] = await Promise.all([
        fetch('/api/teams'),
        fetch('/api/league/settings'),
        fetch('/api/trades', {
          headers: {
            'x-user-role': role,
            'x-user-team-id': activeMy
          }
        })
      ]);
      const teamsData = await teamsRes.json();
      const setData = await setRes.json();
      const offData = await offRes.json();
      
      const safeTeams = Array.isArray(teamsData) ? teamsData : (teamsData.teams || []);
      
      setTeams(safeTeams);
      setSettings(setData);
      setOffers(Array.isArray(offData) ? offData : []);
      if (safeTeams.length >= 2) {
        const initialMy = propMyTeamId || safeTeams[0].id;
        setMyTeamId(initialMy);
        const other = safeTeams.find((t: any) => t.id !== initialMy);
        if (other && !partnerTeamId) setPartnerTeamId(other.id);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [role, propMyTeamId]);

  const formatMoney = (amount: number) => `$${(amount / 1000000).toFixed(1)}M`;

  // Validation Logic
  const safeTeamsArray = Array.isArray(teams) ? teams : [];
  const effectiveMyTeamId = (role !== 'ADMIN' && propMyTeamId) ? propMyTeamId : myTeamId;
  const myTeam = safeTeamsArray.find(t => t.id === effectiveMyTeamId);
  const partnerTeam = safeTeamsArray.find(t => t.id === partnerTeamId);

  const getPlayersBySet = (team: any, ids: Set<string>) => (team?.players || []).filter((p: any) => ids.has(p.id));
  const myOutgoingPlayers = getPlayersBySet(myTeam, selectedMyPlayers);
  const partnerOutgoingPlayers = getPlayersBySet(partnerTeam, selectedPartnerPlayers);

  const myOutgoingSalary = myOutgoingPlayers.reduce((sum: number, p: any) => sum + p.salary, 0);
  const myIncomingSalary = partnerOutgoingPlayers.reduce((sum: number, p: any) => sum + p.salary, 0);

  const partnerOutgoingSalary = myIncomingSalary;
  const partnerIncomingSalary = myOutgoingSalary;

  const validateTeamTrade = (outgoingSalary: number, incomingSalary: number, currentCap: number) => {
    const softCap = settings?.soft_cap || 140000000;
    const firstApron = settings?.first_apron || 178000000;
    const secondApron = settings?.second_apron || 189000000;

    if (outgoingSalary === 0 && incomingSalary === 0) return { valid: true };
    const newCap = currentCap - outgoingSalary + incomingSalary;

    // Hard Cap Rule: Second Apron violation
    if (newCap > secondApron) {
      return { valid: false, err: `Превышен 2-й эйпрон (${formatMoney(secondApron)})! Обмен заблокирован правилами CBA.` };
    }

    // Under soft cap
    if (newCap <= softCap) return { valid: true };

    // Taxpayer (Between 1st and 2nd apron)
    if (newCap > firstApron) {
      if (incomingSalary > outgoingSalary * 1.0) {
        return { valid: false, err: `Команда выше 1-го эйпрона не может принимать больше 100% исходящей зарплаты (исходит ${formatMoney(outgoingSalary)}, заходит ${formatMoney(incomingSalary)}).` };
      }
      return { valid: true };
    }

    // Standard Cap (100% to 1st apron)
    let maxAllowed = 0;
    if (outgoingSalary <= 7500000) maxAllowed = outgoingSalary * 2.0;
    else if (outgoingSalary <= 29000000) maxAllowed = outgoingSalary + 7500000;
    else maxAllowed = outgoingSalary * 1.25;

    if (incomingSalary > maxAllowed) {
      return { valid: false, err: `Превышен лимит зарплат по 125% правилу (макс. ${formatMoney(maxAllowed)}).` };
    }

    return { valid: true };
  };

  const myCurrentCap = (myTeam?.players || []).reduce((sum: number, p: any) => sum + p.salary, 0);
  const partnerCurrentCap = (partnerTeam?.players || []).reduce((sum: number, p: any) => sum + p.salary, 0);

  const myValidation = validateTeamTrade(myOutgoingSalary, myIncomingSalary, myCurrentCap);
  const partnerValidation = validateTeamTrade(partnerOutgoingSalary, partnerIncomingSalary, partnerCurrentCap);

  const isValid = myValidation.valid && partnerValidation.valid;
  const isTradeDeadline = settings?.current_stage === 'TRADE_DEADLINE';

  const toggleSet = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const newSet = new Set(set);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setter(newSet);
  };

  const handleSendOffer = async () => {
    if (role !== 'ADMIN' && !propMyTeamId) return alert('Зрители без команды не могут отправлять трейды!');
    if (isTradeDeadline) return alert('Дедлайн наступил! Обмены закрыты на время плей-офф.');
    if (!isValid) return alert('Обмен невалиден');
    try {
      const res = await fetch('/api/trades/offer', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': role,
          'x-user-team-id': effectiveMyTeamId
        },
        body: JSON.stringify({
          sender_team_id: effectiveMyTeamId,
          receiver_team_id: partnerTeamId,
          sent_player_ids: Array.from(selectedMyPlayers),
          received_player_ids: Array.from(selectedPartnerPlayers),
          sent_pick_ids: Array.from(selectedMyPicks),
          received_pick_ids: Array.from(selectedPartnerPicks),
          message
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || 'Ошибка отправки трейда');
        return;
      }
      alert('Оффер успешно отправлен!');
      setSelectedMyPlayers(new Set());
      setSelectedPartnerPlayers(new Set());
      setSelectedMyPicks(new Set());
      setSelectedPartnerPicks(new Set());
      setMessage('');
      fetchData();
      setSubTab('OFFERS');
      setOffersFilter('OUTGOING');
    } catch (e) {
      alert('Ошибка при отправке трейда');
    }
  };

  const respondToOffer = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/trades/${id}/respond`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': role,
          'x-user-team-id': effectiveMyTeamId
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else alert('Успешно!');
      fetchData();
    } catch (e) {
      alert('Ошибка ответа на оффер');
    }
  };

  if (loading) return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3390ec] mb-4"></div>
      <div className="text-sm font-bold">Загрузка лиги...</div>
    </div>
  );

  // Offers filtering logic
  const incomingOffers = offers.filter(o => o.receiver_team_id === effectiveMyTeamId);
  const outgoingOffers = offers.filter(o => o.sender_team_id === effectiveMyTeamId);

  const displayedOffers = offersFilter === 'INCOMING'
    ? incomingOffers
    : offersFilter === 'OUTGOING'
    ? outgoingOffers
    : offers;

  return (
    <div className="flex flex-col h-full bg-[#181818] overflow-y-auto pb-44 relative">
      
      {/* Banners */}
      {isTradeDeadline && (
        <div className="bg-[#ff3b30]/10 border-b border-[#ff3b30]/20 p-2.5 text-center text-[#ff3b30] text-[12px] font-bold">
          🚨 Дедлайн наступил! Обмены игроков и пиков заморожены до межсезонья.
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex p-2 bg-[#212121] border-b border-[#303030] gap-2 sticky top-0 z-20 shadow-md">
        <button 
          onClick={() => setSubTab('BUILDER')} 
          className={`flex-1 py-2 text-center text-[13px] font-bold rounded-xl transition-all ${subTab === 'BUILDER' ? 'bg-[#3390ec] text-white shadow-md shadow-[#3390ec]/20' : 'text-[#8e8e93] hover:text-white'}`}
        >
          🔄 Конструктор обмена
        </button>
        <button 
          onClick={() => setSubTab('OFFERS')} 
          className={`flex-1 py-2 text-center text-[13px] font-bold rounded-xl transition-all relative ${subTab === 'OFFERS' ? 'bg-[#3390ec] text-white shadow-md shadow-[#3390ec]/20' : 'text-[#8e8e93] hover:text-white'}`}
        >
          <span>Офферы лиги</span>
          {incomingOffers.filter(o => o.status === 'PENDING').length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-[#ff3b30] text-white rounded-full font-black animate-pulse">
              {incomingOffers.filter(o => o.status === 'PENDING').length}
            </span>
          )}
        </button>
      </div>

      <div className="p-4 flex-1">
        {subTab === 'BUILDER' && (
          <div className="space-y-4">
            
            {/* Two Teams Side-by-Side Builder */}
            <div className="grid grid-cols-2 gap-3">
              
              {/* My Team */}
              <div className="flex flex-col gap-2">
                <div className="bg-[#212121] p-2 rounded-xl">
                  {role === 'ADMIN' ? (
                    <select 
                      value={myTeamId} 
                      onChange={e => setMyTeamId(e.target.value)} 
                      className="w-full bg-[#181818] border border-[#303030] p-2 rounded-lg text-white font-bold text-[12px] outline-none"
                    >
                      {safeTeamsArray.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2 text-white font-bold text-[12px] truncate">
                      {myTeam?.name || 'Моя команда'}
                    </div>
                  )}
                  <div className="text-[10px] text-[#8e8e93] mt-1 text-center font-semibold">
                    Платежка: {formatMoney(myCurrentCap)}
                  </div>
                </div>

                <div className="h-[250px] overflow-y-auto space-y-1 pr-1 bg-[#181818] p-1.5 rounded-xl border border-[#303030]">
                  {(myTeam?.players || []).map((p: any) => {
                    const restricted = p.is_trade_restricted;
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => !isTradeDeadline && !restricted && toggleSet(selectedMyPlayers, p.id, setSelectedMyPlayers)} 
                        className={`p-2 rounded-lg border text-[12px] transition-colors ${(isTradeDeadline || restricted) ? 'cursor-not-allowed opacity-50 bg-[#212121] border-transparent' : 'cursor-pointer'} ${selectedMyPlayers.has(p.id) ? 'bg-[#3390ec]/20 border-[#3390ec]' : 'bg-[#212121] border-transparent hover:bg-[#252525]'}`}
                      >
                        <div className="font-bold">{restricted && '🔒 '}{p.name}</div>
                        <div className="text-[#8e8e93] text-[11px]">{formatMoney(p.salary)}</div>
                      </div>
                    );
                  })}
                  {(myTeam?.draft_picks || myTeam?.picks || []).map((p: any) => (
                    <div 
                      key={p.id} 
                      onClick={() => !isTradeDeadline && toggleSet(selectedMyPicks, p.id, setSelectedMyPicks)} 
                      className={`p-2 rounded-lg border text-[12px] transition-colors ${isTradeDeadline ? 'cursor-not-allowed opacity-50 bg-[#212121] border-transparent' : 'cursor-pointer'} ${selectedMyPicks.has(p.id) ? 'bg-[#3390ec]/20 border-[#3390ec]' : 'bg-[#212121] border-transparent hover:bg-[#252525]'}`}
                    >
                      <div className="font-bold">🎟 {p.year}: {p.name}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#212121] p-2.5 rounded-xl text-center text-[12px] shadow-sm border border-[#303030]">
                  <div className="text-[#8e8e93] text-[11px]">Уходит</div>
                  <div className="font-bold text-[#ff3b30]">{formatMoney(myOutgoingSalary)}</div>
                  <div className="text-[#8e8e93] text-[11px] mt-1">Приходит</div>
                  <div className="font-bold text-[#34c759]">{formatMoney(myIncomingSalary)}</div>
                  <div className="mt-2 flex justify-center">
                    {myValidation.valid ? <CheckCircle2 width="20" height="20" className="text-[#34c759]"/> : <div className="text-[10px] text-[#ff3b30] leading-tight font-semibold">{myValidation.err}</div>}
                  </div>
                </div>
              </div>

              {/* Partner Team */}
              <div className="flex flex-col gap-2">
                <div className="bg-[#212121] p-2 rounded-xl border border-[#303030]">
                  <select 
                    value={partnerTeamId} 
                    onChange={e => setPartnerTeamId(e.target.value)} 
                    className="w-full bg-[#181818] border border-[#303030] p-2 rounded-lg text-white font-bold text-[12px] outline-none"
                  >
                    {safeTeamsArray.filter((t: any) => t.id !== effectiveMyTeamId).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <div className="text-[10px] text-[#8e8e93] mt-1 text-center font-semibold">
                    Платежка: {formatMoney(partnerCurrentCap)}
                  </div>
                </div>

                <div className="h-[250px] overflow-y-auto space-y-1 pr-1 bg-[#181818] p-1.5 rounded-xl border border-[#303030]">
                  {(partnerTeam?.players || []).map((p: any) => {
                    const restricted = p.is_trade_restricted;
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => !isTradeDeadline && !restricted && toggleSet(selectedPartnerPlayers, p.id, setSelectedPartnerPlayers)} 
                        className={`p-2 rounded-lg border text-[12px] transition-colors ${(isTradeDeadline || restricted) ? 'cursor-not-allowed opacity-50 bg-[#212121] border-transparent' : 'cursor-pointer'} ${selectedPartnerPlayers.has(p.id) ? 'bg-[#3390ec]/20 border-[#3390ec]' : 'bg-[#212121] border-transparent hover:bg-[#252525]'}`}
                      >
                        <div className="font-bold">{restricted && '🔒 '}{p.name}</div>
                        <div className="text-[#8e8e93] text-[11px]">{formatMoney(p.salary)}</div>
                      </div>
                    );
                  })}
                  {(partnerTeam?.draft_picks || partnerTeam?.picks || []).map((p: any) => (
                    <div 
                      key={p.id} 
                      onClick={() => !isTradeDeadline && toggleSet(selectedPartnerPicks, p.id, setSelectedPartnerPicks)} 
                      className={`p-2 rounded-lg border text-[12px] transition-colors ${isTradeDeadline ? 'cursor-not-allowed opacity-50 bg-[#212121] border-transparent' : 'cursor-pointer'} ${selectedPartnerPicks.has(p.id) ? 'bg-[#3390ec]/20 border-[#3390ec]' : 'bg-[#212121] border-transparent hover:bg-[#252525]'}`}
                    >
                      <div className="font-bold">🎟 {p.year}: {p.name}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#212121] p-2.5 rounded-xl text-center text-[12px] shadow-sm border border-[#303030]">
                  <div className="text-[#8e8e93] text-[11px]">Уходит</div>
                  <div className="font-bold text-[#ff3b30]">{formatMoney(partnerOutgoingSalary)}</div>
                  <div className="text-[#8e8e93] text-[11px] mt-1">Приходит</div>
                  <div className="font-bold text-[#34c759]">{formatMoney(partnerIncomingSalary)}</div>
                  <div className="mt-2 flex justify-center">
                    {partnerValidation.valid ? <CheckCircle2 width="20" height="20" className="text-[#34c759]"/> : <div className="text-[10px] text-[#ff3b30] leading-tight font-semibold">{partnerValidation.err}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Mobile-Friendly Bottom Bar for TMA */}
            <div className="sticky bottom-0 bg-[#212121]/95 backdrop-blur-md p-4 -mx-4 -mb-4 border-t border-[#303030] shadow-2xl z-30 space-y-2.5 mt-4">
              <textarea 
                value={message} 
                onChange={e => setMessage(e.target.value)}
                placeholder="Комментарий к офферу (опционально)..."
                disabled={isTradeDeadline}
                className="w-full p-2.5 bg-[#181818] border border-[#303030] rounded-xl text-[12px] text-white outline-none focus:border-[#3390ec] resize-none h-[60px] disabled:opacity-50"
              />
              <button 
                onClick={handleSendOffer}
                disabled={!isValid || isTradeDeadline || (role !== 'ADMIN' && !propMyTeamId) || (selectedMyPlayers.size===0 && selectedPartnerPlayers.size===0 && selectedMyPicks.size===0 && selectedPartnerPicks.size===0)}
                className={`w-full py-3.5 rounded-xl font-black text-[13px] transition-all flex items-center justify-center gap-2 shadow-lg ${
                  (!isValid || isTradeDeadline || (role !== 'ADMIN' && !propMyTeamId) || (selectedMyPlayers.size===0 && selectedPartnerPlayers.size===0 && selectedMyPicks.size===0 && selectedPartnerPicks.size===0))
                    ? 'bg-[#303030] text-[#8e8e93] cursor-not-allowed opacity-70'
                    : 'bg-[#3390ec] hover:bg-[#2b7bc4] text-white active:scale-[0.98] shadow-[#3390ec]/25 cursor-pointer'
                }`}
              >
                <span>🚀 {isTradeDeadline ? 'Обмены заморожены (Дедлайн)' : (role !== 'ADMIN' && !propMyTeamId) ? 'Только для менеджеров команд' : 'Отправить предложение обмена'}</span>
              </button>
            </div>
          </div>
        )}

        {subTab === 'OFFERS' && (
          <div className="space-y-4">
            
            {/* Offer Privacy & Sub-Navigation Tabs */}
            <div className="flex bg-[#212121] p-1.5 rounded-xl border border-[#303030] gap-1 text-[12px] font-bold">
              {role === 'ADMIN' && (
                <button
                  onClick={() => setOffersFilter('ALL')}
                  className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                    offersFilter === 'ALL' ? 'bg-[#3390ec] text-white' : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Все ({offers.length})</span>
                </button>
              )}

              <button
                onClick={() => setOffersFilter('INCOMING')}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                  offersFilter === 'INCOMING' ? 'bg-[#3390ec] text-white' : 'text-[#8e8e93] hover:text-white'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>📥 Входящие ({incomingOffers.length})</span>
              </button>

              <button
                onClick={() => setOffersFilter('OUTGOING')}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                  offersFilter === 'OUTGOING' ? 'bg-[#3390ec] text-white' : 'text-[#8e8e93] hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>📤 Исходящие ({outgoingOffers.length})</span>
              </button>
            </div>

            {/* Trade Offers List */}
            {displayedOffers.length === 0 ? (
              <div className="text-center text-[#8e8e93] py-12 bg-[#212121] rounded-2xl border border-[#303030] space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto opacity-40 text-[#8e8e93]" />
                <div className="text-[13px] font-bold text-white">
                  {offersFilter === 'INCOMING' ? 'Нет входящих предложений' : offersFilter === 'OUTGOING' ? 'Нет исходящих предложений' : 'Нет активных предложений'}
                </div>
                <div className="text-[11px] text-[#8e8e93]">
                  {role !== 'ADMIN' && !propMyTeamId ? 'Вы находитесь в статусе зрителя.' : 'Переговоры команд конфиденциальны.'}
                </div>
              </div>
            ) : (
              displayedOffers.map(o => (
                <OfferCard 
                  key={o.id} 
                  offer={o} 
                  currentTeamId={effectiveMyTeamId}
                  role={role}
                  allPlayers={safeTeamsArray.flatMap((t: any) => t.players || [])} 
                  allPicks={safeTeamsArray.flatMap((t: any) => t.draft_picks || t.picks || [])}
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

function OfferCard({ offer, currentTeamId, role, allPlayers, allPicks, respondToOffer, isTradeDeadline }: any) {
  const [expanded, setExpanded] = useState(offer.status === 'PENDING');

  const getP = (id: string) => allPlayers.find((p: any) => p.id === id) || { name: 'Неизвестный игрок', overall_rating: 0, salary: 0 };
  const getPk = (id: string) => allPicks.find((p: any) => p.id === id) || { year: '?', name: 'Пик' };

  const teamA = offer.sender_team;
  const teamB = offer.receiver_team;

  const isIncomingForMe = currentTeamId === offer.receiver_team_id;
  const isOutgoingForMe = currentTeamId === offer.sender_team_id;

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
    if (items.length === 0 && picks[0]) items.push(`${picks[0].year}: ${picks[0].name}`);
    if (players.length + picks.length > items.length) items.push(`еще ${players.length + picks.length - items.length}`);
    return items.join(', ') || 'Ничего';
  };

  const canRespond = offer.status === 'PENDING' && (role === 'ADMIN' || isIncomingForMe);

  return (
    <div className="bg-[#212121] rounded-2xl shadow-sm border border-[#303030] overflow-hidden">
      {/* Direction Pill Header */}
      <div className="px-4 pt-3 flex justify-between items-center text-[11px] font-bold">
        {isIncomingForMe ? (
          <span className="text-[#34c759] flex items-center gap-1 bg-[#34c759]/10 px-2 py-0.5 rounded-md border border-[#34c759]/20">
            <span>📥 Входящее предложение от {teamA?.name}</span>
          </span>
        ) : isOutgoingForMe ? (
          <span className="text-[#3390ec] flex items-center gap-1 bg-[#3390ec]/10 px-2 py-0.5 rounded-md border border-[#3390ec]/20">
            <span>📤 Исходящее предложение в {teamB?.name}</span>
          </span>
        ) : (
          <span className="text-[#8e8e93] flex items-center gap-1 bg-[#181818] px-2 py-0.5 rounded-md border border-[#303030]">
            <span>⚖️ {teamA?.name} ➔ {teamB?.name}</span>
          </span>
        )}

        <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusBadge.classes}`}>
          {statusBadge.text}
        </div>
      </div>

      {/* Main Bar */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-4 pt-2 cursor-pointer hover:bg-[#2a2a2a] transition-colors"
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 flex-1">
            <span className="font-black text-[13px] text-white truncate">{teamA?.name}</span>
            <ArrowRightLeft width="12" height="12" className="text-[#8e8e93] shrink-0" />
            <span className="font-black text-[13px] text-white truncate">{teamB?.name}</span>
          </div>

          <div className="text-[#8e8e93] ml-2">
            {expanded ? <ChevronUp width="16" height="16" /> : <ChevronDown width="16" height="16" />}
          </div>
        </div>

        {/* Compact Preview (only if collapsed) */}
        {!expanded && (
          <div className="flex justify-between items-center text-[11px] text-[#8e8e93] bg-[#181818] p-2 rounded-lg">
            <div className="truncate flex-1 pr-2">{getCompactPreview(aReceivesPlayers, aReceivesPicks)}</div>
            <ArrowRightLeft width="10" height="10" className="shrink-0 opacity-50" />
            <div className="truncate flex-1 pl-2 text-right">{getCompactPreview(bReceivesPlayers, bReceivesPicks)}</div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#303030] pt-4">
          <div className="flex flex-col gap-3">
            
            {/* Block 1: Team A Receives */}
            <div className="bg-[#181818] rounded-xl p-3 border border-[#303030]/60">
              <div className="text-[12px] font-bold text-[#3390ec] mb-2">{teamA?.name} получает:</div>
              <div className="space-y-1.5">
                {aReceivesPlayers.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center bg-[#303030] rounded text-[10px] font-bold text-[#8e8e93]">{p.overall_rating}</span>
                      <span className="text-white font-medium">{p.name}</span>
                    </div>
                    <span className="text-[#8e8e93]">{formatMoney(p.salary || 0)}</span>
                  </div>
                ))}
                {aReceivesPicks.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[12px]">
                    <span className="text-white font-medium">🎟 {p.year}: {p.name}</span>
                    <span className="text-[#8e8e93] text-[10px]">DRAFT</span>
                  </div>
                ))}
                {aReceivesPlayers.length === 0 && aReceivesPicks.length === 0 && (
                  <div className="text-[#8e8e93] text-[12px] italic">Ничего</div>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-[#303030] flex justify-between items-center">
                <span className="text-[11px] text-[#8e8e93]">Сумма зарплат:</span>
                <span className="font-bold text-[12px] text-[#34c759]">{formatMoney(aReceivesSalary)}</span>
              </div>
            </div>

            {/* Block 2: Team B Receives */}
            <div className="bg-[#181818] rounded-xl p-3 border border-[#303030]/60">
              <div className="text-[12px] font-bold text-[#3390ec] mb-2">{teamB?.name} получает:</div>
              <div className="space-y-1.5">
                {bReceivesPlayers.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center bg-[#303030] rounded text-[10px] font-bold text-[#8e8e93]">{p.overall_rating}</span>
                      <span className="text-white font-medium">{p.name}</span>
                    </div>
                    <span className="text-[#8e8e93]">{formatMoney(p.salary || 0)}</span>
                  </div>
                ))}
                {bReceivesPicks.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[12px]">
                    <span className="text-white font-medium">🎟 {p.year}: {p.name}</span>
                    <span className="text-[#8e8e93] text-[10px]">DRAFT</span>
                  </div>
                ))}
                {bReceivesPlayers.length === 0 && bReceivesPicks.length === 0 && (
                  <div className="text-[#8e8e93] text-[12px] italic">Ничего</div>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-[#303030] flex justify-between items-center">
                <span className="text-[11px] text-[#8e8e93]">Сумма зарплат:</span>
                <span className="font-bold text-[12px] text-[#34c759]">{formatMoney(bReceivesSalary)}</span>
              </div>
            </div>

          </div>

          {offer.message && (
            <div className="mt-3 text-[12px] italic text-[#e0e0e0] bg-[#181818] p-3 rounded-xl border border-[#303030]/50">
              «{offer.message}»
            </div>
          )}
          <div className="text-[10px] text-[#8e8e93] mt-2 text-right">
            Создано: {dateStr}
          </div>
          
          {canRespond && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-[#303030]">
              <button 
                disabled={isTradeDeadline}
                onClick={(e) => { e.stopPropagation(); respondToOffer(offer.id, 'ACCEPT'); }} 
                className={`flex-1 py-3 font-bold rounded-xl text-[13px] transition-transform ${isTradeDeadline ? 'bg-[#303030] text-[#8e8e93]' : 'bg-[#34c759] text-white hover:bg-[#2eb050] active:scale-[0.98]'}`}
              >
                {isTradeDeadline ? 'Дедлайн истек' : 'Принять'}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); respondToOffer(offer.id, 'REJECT'); }} 
                className="flex-1 py-3 bg-[#ff3b30]/15 text-[#ff3b30] hover:bg-[#ff3b30]/25 font-bold rounded-xl text-[13px] active:scale-[0.98] transition-transform"
              >
                Отклонить
              </button>
            </div>
          )}

          {offer.status === 'PENDING' && !canRespond && isOutgoingForMe && (
            <div className="mt-3 py-2 text-center text-[12px] font-bold text-[#8e8e93] bg-[#181818] rounded-xl border border-[#303030]">
              ⏳ Ожидание ответа от {teamB?.name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

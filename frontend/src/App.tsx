import { useState, useEffect } from 'react';
import { Users, Replace, UserPlus, Rss, Settings, ChevronDown } from 'lucide-react';
import RostersTab from './components/RostersTab';
import SettingsTab from './components/SettingsTab';
import TradeMachineTab from './components/TradeMachineTab';
import FeedTab from './components/FeedTab';
import OptionsTab from './components/OptionsTab';
import DraftTab from './components/DraftTab';
import FreeAgencyTab from './components/FreeAgencyTab';

function App() {
  const [activeTab, setActiveTab] = useState('rosters');
  const [activeRole, setActiveRole] = useState<'PLAYER' | 'ADMIN'>('PLAYER');
  const [settings, setSettings] = useState<any>(null);
  const [isStageMenuOpen, setIsStageMenuOpen] = useState(false);
  const [myTeamId, setMyTeamId] = useState<string>('');

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:3000/league/settings');
      const data = await res.json();
      setSettings(data);
      
      const teamsRes = await fetch('http://localhost:3000/teams');
      const teamsData = await teamsRes.json();
      const safeTeams = Array.isArray(teamsData) ? teamsData : (teamsData.teams || []);
      if (safeTeams.length > 0) setMyTeamId(safeTeams[0].id); // MOCK: assigning user to first team
    } catch (e) {}
  };

  useEffect(() => {
    fetchSettings();
  }, [activeTab]);

  const toggleRole = () => {
    setActiveRole(prev => prev === 'PLAYER' ? 'ADMIN' : 'PLAYER');
  };

  const changeStage = async (stage: string) => {
    if (activeRole !== 'ADMIN') return;
    try {
      await fetch('http://localhost:3000/admin/league/stage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-role': activeRole },
        body: JSON.stringify({ stage })
      });
      setIsStageMenuOpen(false);
      fetchSettings();
    } catch (e) {
      alert('Ошибка');
    }
  };

  const finishSeason = async () => {
    if (activeRole !== 'ADMIN') return;
    if (!confirm('Вы уверены, что хотите завершить текущий сезон?')) return;
    try {
      await fetch('http://localhost:3000/admin/season/advance', {
        method: 'POST',
        headers: { 'x-user-role': activeRole }
      });
      setIsStageMenuOpen(false);
      fetchSettings();
      alert('Сезон успешно завершен! Сброс контрактов и рынка произведен.');
    } catch (e) {
      alert('Ошибка');
    }
  };

  const STAGES: Record<string, string> = {
    'DRAFT': 'Драфт',
    'OFFSEASON_OPTIONS': 'Опции контрактов',
    'FREE_AGENCY': 'Рынок СА',
    'REGULAR_SEASON_START': 'Старт сезона',
    'TRADE_RESTRICTIONS_LIFTED': '2 месяца сезона',
    'TRADE_DEADLINE': 'Дедлайн'
  };

  const currentStageName = settings ? (STAGES[settings.current_stage] || 'Сезон') : 'Загрузка...';

  const getStageBadgeStyle = (stage: string) => {
    if (stage === 'TRADE_DEADLINE') return 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]';
    if (stage === 'OFFSEASON_OPTIONS' || stage === 'DRAFT') return 'bg-[#ff9f0a]/10 border-[#ff9f0a]/30 text-[#ff9f0a]';
    if (stage === 'FREE_AGENCY') return 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]';
    if (stage === 'SEASON_END') return 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]';
    return 'bg-[#181818] border-[#303030] text-[#3390ec]';
  };

  return (
    <div className="flex flex-col h-screen bg-[#181818] text-white overflow-hidden">
      {/* Header */}
      <div className="pt-4 pb-3 px-4 bg-[#212121] flex flex-col shadow-md z-20 sticky top-0 border-b border-[#303030]">
        <div className="flex justify-between items-center mb-3">
          <div className="font-bold text-lg">NBA2K TMA</div>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleRole}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#303030] rounded-lg text-[13px] font-semibold hover:bg-[#3a3a3c] transition-colors"
            >
              {activeRole === 'PLAYER' ? '👤 Игрок' : '👑 Админ'}
            </button>
            {activeRole === 'ADMIN' && (
              <button 
                onClick={() => setActiveTab('settings')}
                className={`p-1.5 rounded-lg transition-colors ${activeTab === 'settings' ? 'text-[#3390ec] bg-[#3390ec]/10' : 'text-[#8e8e93] hover:text-white'}`}
              >
                <Settings width="20" height="20" style={{ minWidth: 20, minHeight: 20 }} />
              </button>
            )}
          </div>
        </div>
        
        {/* Stage Badge */}
        <div className="relative">
          <button 
            onClick={() => activeRole === 'ADMIN' && setIsStageMenuOpen(!isStageMenuOpen)}
            className={`flex items-center justify-between w-full p-2.5 rounded-xl border ${getStageBadgeStyle(settings?.current_stage)} font-bold text-[13px] transition-colors`}
          >
            <span>Этап: {currentStageName}</span>
            {activeRole === 'ADMIN' && <ChevronDown width="16" height="16" className="opacity-70" />}
          </button>
          
          {isStageMenuOpen && activeRole === 'ADMIN' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#212121] border border-[#303030] rounded-xl shadow-xl flex flex-col p-1 z-50">
              {Object.entries(STAGES).map(([key, label]) => (
                <button 
                  key={key} 
                  onClick={() => changeStage(key)}
                  className={`text-left p-3 text-[13px] font-bold rounded-lg transition-colors ${settings?.current_stage === key ? 'bg-[#3390ec]/10 text-[#3390ec]' : 'text-white hover:bg-[#303030]'}`}
                >
                  {label}
                </button>
              ))}
              <div className="h-px bg-[#303030] my-1"></div>
              <button onClick={finishSeason} className="text-left p-3 text-[13px] font-bold rounded-lg text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors">
                🏁 Завершить сезон
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-[76px]">
        {settings?.current_stage === 'OFFSEASON_OPTIONS' && activeTab === 'rosters' ? (
          <div className="p-4 bg-[#ff9f0a]/10 border-b border-[#ff9f0a]/20 flex justify-between items-center">
            <div className="text-[12px] font-bold text-[#ff9f0a]">Время решать опции контрактов!</div>
            <button onClick={() => setActiveTab('options')} className="bg-[#ff9f0a] text-black px-3 py-1.5 rounded-lg text-[12px] font-bold active:scale-95 transition-transform">Перейти</button>
          </div>
        ) : null}

        {settings?.current_stage === 'DRAFT' && activeTab === 'rosters' ? (
          <div className="p-4 bg-[#ff9f0a]/10 border-b border-[#ff9f0a]/20 flex justify-between items-center">
            <div className="text-[12px] font-bold text-[#ff9f0a]">Драфт новичков активен!</div>
            <button onClick={() => setActiveTab('draft')} className="bg-[#ff9f0a] text-black px-3 py-1.5 rounded-lg text-[12px] font-bold active:scale-95 transition-transform">В Draft Room</button>
          </div>
        ) : null}

        {settings?.current_stage === 'FREE_AGENCY' && activeTab === 'rosters' ? (
          <div className="p-4 bg-[#34c759]/10 border-b border-[#34c759]/20 flex justify-between items-center">
            <div className="text-[12px] font-bold text-[#34c759]">Рынок СА открыт!</div>
            <button onClick={() => setActiveTab('fa')} className="bg-[#34c759] text-black px-3 py-1.5 rounded-lg text-[12px] font-bold active:scale-95 transition-transform">Перейти</button>
          </div>
        ) : null}

        {activeTab === 'rosters' && <RostersTab role={activeRole} />}
        {activeTab === 'options' && <OptionsTab role={activeRole} />}
        {activeTab === 'draft' && <DraftTab role={activeRole} myTeamId={myTeamId} />}
        {activeTab === 'trade' && <TradeMachineTab />}
        {activeTab === 'fa' && <FreeAgencyTab role={activeRole} myTeamId={myTeamId} />}
        {activeTab === 'feed' && <FeedTab />}
        {activeTab === 'settings' && activeRole === 'ADMIN' && <SettingsTab role={activeRole} />}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 w-full bg-[#212121] flex justify-around pb-6 pt-2 z-10 border-t border-[#303030]">
        <NavButton id="rosters" icon={<Users width="24" height="24" style={{ minWidth: 24, minHeight: 24 }} />} label="Составы" active={activeTab === 'rosters' || activeTab === 'options' || activeTab === 'draft'} onClick={() => setActiveTab('rosters')} />
        <NavButton id="trade" icon={<Replace width="24" height="24" style={{ minWidth: 24, minHeight: 24 }} />} label="Обмены" active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} />
        <NavButton id="fa" icon={<UserPlus width="24" height="24" style={{ minWidth: 24, minHeight: 24 }} />} label="Свободные" active={activeTab === 'fa'} onClick={() => setActiveTab('fa')} />
        <NavButton id="feed" icon={<Rss width="24" height="24" style={{ minWidth: 24, minHeight: 24 }} />} label="Инсайды" active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} />
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { id?: string, icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center p-2 w-full transition-colors ${active ? 'text-[#3390ec]' : 'text-[#8e8e93] hover:text-[#aaaaaa]'}`}>
      <div className="mb-1 flex justify-center items-center h-6 w-6">{icon}</div>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

export default App;

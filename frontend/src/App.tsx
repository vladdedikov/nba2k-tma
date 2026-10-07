import { useState, useEffect } from 'react';
import { Users, Replace, UserPlus, Rss, Settings, ChevronDown } from 'lucide-react';
import RostersTab from './components/RostersTab';
import SettingsTab from './components/SettingsTab';
import TradeMachineTab from './components/TradeMachineTab';
import FeedTab from './components/FeedTab';
import OptionsTab from './components/OptionsTab';

function App() {
  const [activeTab, setActiveTab] = useState('rosters');
  const [activeRole, setActiveRole] = useState<'PLAYER' | 'ADMIN'>('PLAYER');
  const [settings, setSettings] = useState<any>(null);
  const [isStageMenuOpen, setIsStageMenuOpen] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:3000/league/settings');
      const data = await res.json();
      setSettings(data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchSettings();
  }, [activeTab]); // re-fetch on tab change as well to keep it somewhat fresh

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

  const advanceYear = async () => {
    if (activeRole !== 'ADMIN') return;
    if (!confirm('ВНИМАНИЕ! Это действие сдвинет контракты всех игроков на 1 год вперед и сделает истекающих игроков свободными агентами. Продолжить?')) return;
    try {
      await fetch('http://localhost:3000/admin/season/advance-year', {
        method: 'POST',
        headers: { 'x-user-role': activeRole }
      });
      setIsStageMenuOpen(false);
      fetchSettings();
      alert('Сезон успешно переведен на следующий год!');
    } catch (e) {
      alert('Ошибка');
    }
  };

  const STAGES: Record<string, string> = {
    'REGULAR_SEASON': '🏀 Регулярный сезон',
    'OFFSEASON_OPTIONS': '📋 Межсезонье: Опции',
    'DRAFT': '🎟 Драфт',
    'FREE_AGENCY': '💼 Рынок СА'
  };

  const currentStageName = settings ? (STAGES[settings.current_stage] || 'Сезон') : 'Загрузка...';

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
            className={`flex items-center justify-between w-full p-2.5 rounded-xl border ${settings?.current_stage === 'OFFSEASON_OPTIONS' ? 'bg-[#ff9f0a]/10 border-[#ff9f0a]/30 text-[#ff9f0a]' : 'bg-[#181818] border-[#303030] text-[#3390ec]'} font-bold text-[13px] transition-colors`}
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
              <button onClick={advanceYear} className="text-left p-3 text-[13px] font-bold rounded-lg text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors">
                ⏩ Завершить сезон (Advance Year)
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

        {activeTab === 'rosters' && <RostersTab role={activeRole} />}
        {activeTab === 'options' && <OptionsTab role={activeRole} />}
        {activeTab === 'trade' && <TradeMachineTab />}
        {activeTab === 'fa' && <div className="p-4 flex h-full items-center justify-center text-[#8e8e93]">Свободные агенты (В разработке)</div>}
        {activeTab === 'feed' && <FeedTab />}
        {activeTab === 'settings' && activeRole === 'ADMIN' && <SettingsTab role={activeRole} />}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 w-full bg-[#212121] flex justify-around pb-6 pt-2 z-10 border-t border-[#303030]">
        <NavButton id="rosters" icon={<Users width="24" height="24" style={{ minWidth: 24, minHeight: 24 }} />} label="Составы" active={activeTab === 'rosters' || activeTab === 'options'} onClick={() => setActiveTab('rosters')} />
        <NavButton id="trade" icon={<Replace width="24" height="24" style={{ minWidth: 24, minHeight: 24 }} />} label="Обмены" active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} />
        <NavButton id="fa" icon={<UserPlus width="24" height="24" style={{ minWidth: 24, minHeight: 24 }} />} label="Свободные" active={activeTab === 'fa'} onClick={() => setActiveTab('fa')} />
        <NavButton id="feed" icon={<Rss width="24" height="24" style={{ minWidth: 24, minHeight: 24 }} />} label="Инсайды" active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} />
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center p-2 w-full transition-colors ${active ? 'text-[#3390ec]' : 'text-[#8e8e93] hover:text-[#aaaaaa]'}`}>
      <div className="mb-1 flex justify-center items-center h-6 w-6">{icon}</div>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

export default App;

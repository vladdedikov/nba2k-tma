import { useState, useEffect } from 'react';
import { Users, Replace, UserPlus, Rss, Settings } from 'lucide-react';
import RostersTab from './components/RostersTab';

import SettingsTab from './components/SettingsTab';

function App() {
  const [activeTab, setActiveTab] = useState('rosters');
  const [activeRole, setActiveRole] = useState<'PLAYER' | 'ADMIN'>('PLAYER');

  const toggleRole = () => {
    setActiveRole(prev => prev === 'PLAYER' ? 'ADMIN' : 'PLAYER');
  };

  return (
    <div className="flex flex-col h-screen bg-[#181818] text-white overflow-hidden">
      {/* Header */}
      <div className="pt-4 pb-3 px-4 bg-[#212121] flex justify-between items-center shadow-md z-10 sticky top-0">
        <div className="font-bold text-lg">NBA2K TMA</div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleRole}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#303030] rounded-lg text-sm font-semibold hover:bg-[#3a3a3c] transition-colors"
          >
            {activeRole === 'PLAYER' ? '👤 Игрок' : '👑 Админ'}
          </button>
          {activeRole === 'ADMIN' && (
            <button 
              onClick={() => setActiveTab('settings')}
              className={`p-1.5 rounded-lg transition-colors ${activeTab === 'settings' ? 'text-[#3390ec] bg-[#3390ec]/10' : 'text-[#8e8e93] hover:text-white'}`}
            >
              <Settings width="20" height="20" style={{ minWidth: 20, minHeight: 20, maxWidth: 20, maxHeight: 20 }} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-[76px]">
        {activeTab === 'rosters' && <RostersTab role={activeRole} />}
        {activeTab === 'trade' && <div className="p-4 flex h-full items-center justify-center text-[#8e8e93]">Trade Machine (В разработке)</div>}
        {activeTab === 'fa' && <div className="p-4 flex h-full items-center justify-center text-[#8e8e93]">Свободные агенты (В разработке)</div>}
        {activeTab === 'feed' && <div className="p-4 flex h-full items-center justify-center text-[#8e8e93]">Инсайды (В разработке)</div>}
        {activeTab === 'settings' && activeRole === 'ADMIN' && <SettingsTab role={activeRole} />}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 w-full bg-[#212121] flex justify-around pb-6 pt-2 z-10 border-t border-[#303030]">
        <NavButton id="rosters" icon={<Users width="24" height="24" style={{ minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24 }} />} label="Составы" active={activeTab === 'rosters'} onClick={() => setActiveTab('rosters')} />
        <NavButton id="trade" icon={<Replace width="24" height="24" style={{ minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24 }} />} label="Обмены" active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} />
        <NavButton id="fa" icon={<UserPlus width="24" height="24" style={{ minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24 }} />} label="Свободные" active={activeTab === 'fa'} onClick={() => setActiveTab('fa')} />
        <NavButton id="feed" icon={<Rss width="24" height="24" style={{ minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24 }} />} label="Инсайды" active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} />
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

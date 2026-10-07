import { useState, useEffect } from 'react';

export default function SettingsTab({ role }: { role: string }) {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/league/settings')
      .then(res => res.json())
      .then(data => {
        setSettings({
          soft_cap: data.soft_cap / 1000000,
          luxury_tax: data.luxury_tax / 1000000,
          first_apron: data.first_apron / 1000000,
          second_apron: data.second_apron / 1000000,
          hard_cap: data.hard_cap / 1000000
        });
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'ADMIN') return;
    try {
      await fetch('http://localhost:3000/admin/league/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-role': role },
        body: JSON.stringify({
          soft_cap: settings.soft_cap * 1000000,
          luxury_tax: settings.luxury_tax * 1000000,
          first_apron: settings.first_apron * 1000000,
          second_apron: settings.second_apron * 1000000,
          hard_cap: settings.hard_cap * 1000000
        })
      });
      alert('Настройки сохранены!');
    } catch (err) {
      alert('Ошибка при сохранении');
    }
  };

  if (loading || !settings) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3390ec]"></div></div>;

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-xl font-bold mb-4">Настройки лиги</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5">Soft Cap ($M)</label>
          <input required type="number" step="0.1" value={settings.soft_cap} onChange={e => setSettings({...settings, soft_cap: Number(e.target.value)})} className="w-full p-3 bg-[#212121] border border-[#303030] rounded-xl text-white outline-none focus:border-[#3390ec]" />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5">Luxury Tax ($M)</label>
          <input required type="number" step="0.1" value={settings.luxury_tax} onChange={e => setSettings({...settings, luxury_tax: Number(e.target.value)})} className="w-full p-3 bg-[#212121] border border-[#303030] rounded-xl text-white outline-none focus:border-[#3390ec]" />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5">1st Apron ($M)</label>
          <input required type="number" step="0.1" value={settings.first_apron} onChange={e => setSettings({...settings, first_apron: Number(e.target.value)})} className="w-full p-3 bg-[#212121] border border-[#303030] rounded-xl text-white outline-none focus:border-[#3390ec]" />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5">2nd Apron ($M)</label>
          <input required type="number" step="0.1" value={settings.second_apron} onChange={e => setSettings({...settings, second_apron: Number(e.target.value)})} className="w-full p-3 bg-[#212121] border border-[#303030] rounded-xl text-white outline-none focus:border-[#3390ec]" />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-[#8e8e93] mb-1.5">Hard Cap ($M)</label>
          <input required type="number" step="0.1" value={settings.hard_cap} onChange={e => setSettings({...settings, hard_cap: Number(e.target.value)})} className="w-full p-3 bg-[#212121] border border-[#303030] rounded-xl text-white outline-none focus:border-[#3390ec]" />
        </div>
        <button type="submit" className="w-full bg-[#3390ec] text-white py-3.5 rounded-xl font-bold mt-4 hover:bg-[#2b7bc4] active:scale-[0.98] transition-transform">
          Сохранить настройки
        </button>
      </form>
    </div>
  );
}

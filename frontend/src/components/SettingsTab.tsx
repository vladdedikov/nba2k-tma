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
          hard_cap: data.hard_cap / 1000000,
          min_salary_schedule: data.min_salary_schedule || [1.15, 1.25, 1.35, 1.45, 1.55],
          tax_mle_schedule: data.tax_mle_schedule || [5.3, 5.6, 5.9],
          full_mle_schedule: data.full_mle_schedule || [12.9, 13.6, 14.3, 15.0],
          rookie_max_schedule: data.rookie_max_schedule || [35.5, 38.3, 41.1, 44.0],
          medium_max_schedule: data.medium_max_schedule || [42.5, 45.9, 49.3, 52.7, 56.1],
          veteran_max_schedule: data.veteran_max_schedule || [50.0, 54.0, 58.0, 62.0, 66.0],
          supermax_schedule: data.supermax_schedule || [60.0, 64.8, 69.6, 74.4, 79.2]
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
          hard_cap: settings.hard_cap * 1000000,
          min_salary_schedule: settings.min_salary_schedule,
          tax_mle_schedule: settings.tax_mle_schedule,
          full_mle_schedule: settings.full_mle_schedule,
          rookie_max_schedule: settings.rookie_max_schedule,
          medium_max_schedule: settings.medium_max_schedule,
          veteran_max_schedule: settings.veteran_max_schedule,
          supermax_schedule: settings.supermax_schedule
        })
      });
      alert('Настройки успешно сохранены!');
    } catch (err) {
      alert('Ошибка при сохранении');
    }
  };

  const handleArrayChange = (field: string, index: number, value: string) => {
    const newArr = [...settings[field]];
    newArr[index] = parseFloat(value) || 0;
    setSettings({ ...settings, [field]: newArr });
  };

  const renderScheduleInputs = (label: string, field: string, badge?: string, maxYears = 5) => {
    return (
      <div className="mb-4">
        <label className="block text-[13px] font-bold text-[#8e8e93] mb-2">
          {label} {badge && <span className="text-[#ff9f0a] font-normal">{badge}</span>}
        </label>
        <div className="flex gap-2 flex-wrap">
          {settings[field].slice(0, maxYears).map((val: number, idx: number) => (
            <div key={idx} className="flex-1 min-w-[60px]">
              <div className="text-[10px] text-[#8e8e93] mb-1">Год {idx + 1}</div>
              <input 
                required type="number" step="0.1" 
                value={val} onChange={e => handleArrayChange(field, idx, e.target.value)} 
                className="w-full p-2 bg-[#181818] border border-[#303030] rounded-lg text-white outline-none font-bold text-[12px]" 
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading || !settings) return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3390ec] mb-4"></div>
      <div className="text-sm font-bold">Загрузка настроек...</div>
    </div>
  );

  return (
    <div className="p-4 space-y-6 pb-[100px]">
      <h2 className="text-xl font-bold text-white mb-2">Настройки лиги</h2>
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Block 1: Caps and Aprons */}
        <div className="bg-[#212121] p-4 rounded-2xl border border-[#303030]">
          <h3 className="text-[15px] font-bold text-[#3390ec] mb-4">Потолки и апроны лиги ($M)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#8e8e93] mb-1">Soft Cap</label>
              <input required type="number" step="0.1" value={settings.soft_cap} onChange={e => setSettings({...settings, soft_cap: Number(e.target.value)})} className="w-full p-2.5 bg-[#181818] border border-[#303030] rounded-xl text-white outline-none font-bold" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#8e8e93] mb-1">Luxury Tax</label>
              <input required type="number" step="0.1" value={settings.luxury_tax} onChange={e => setSettings({...settings, luxury_tax: Number(e.target.value)})} className="w-full p-2.5 bg-[#181818] border border-[#303030] rounded-xl text-white outline-none font-bold" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#8e8e93] mb-1">1st Apron</label>
              <input required type="number" step="0.1" value={settings.first_apron} onChange={e => setSettings({...settings, first_apron: Number(e.target.value)})} className="w-full p-2.5 bg-[#181818] border border-[#303030] rounded-xl text-white outline-none font-bold" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#8e8e93] mb-1">2nd Apron</label>
              <input required type="number" step="0.1" value={settings.second_apron} onChange={e => setSettings({...settings, second_apron: Number(e.target.value)})} className="w-full p-2.5 bg-[#181818] border border-[#303030] rounded-xl text-white outline-none font-bold" />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] font-bold text-[#ff3b30] mb-1">Hard Cap</label>
              <input required type="number" step="0.1" value={settings.hard_cap} onChange={e => setSettings({...settings, hard_cap: Number(e.target.value)})} className="w-full p-2.5 bg-[#181818] border border-[#303030] rounded-xl text-white outline-none font-bold" />
            </div>
          </div>
        </div>

        {/* Block 2: Exceptions and Maxes */}
        <div className="bg-[#212121] p-4 rounded-2xl border border-[#303030]">
          <h3 className="text-[15px] font-bold text-[#ff9f0a] mb-4">Исключения и Максималки ($M)</h3>
          
          {renderScheduleInputs('Минималка', 'min_salary_schedule', '', 5)}
          <hr className="border-[#303030] my-3" />
          {renderScheduleInputs('Tax MLE', 'tax_mle_schedule', '', 3)}
          <hr className="border-[#303030] my-3" />
          {renderScheduleInputs('Full MLE', 'full_mle_schedule', '', 4)}
          <hr className="border-[#303030] my-3" />
          {renderScheduleInputs('Детский макс', 'rookie_max_schedule', '[Строго 4 года (Только RFA)]', 4)}
          <hr className="border-[#303030] my-3" />
          {renderScheduleInputs('Средний макс', 'medium_max_schedule', '[4-5 лет]', 5)}
          <hr className="border-[#303030] my-3" />
          {renderScheduleInputs('Взрослый макс', 'veteran_max_schedule', '[4-5 лет]', 5)}
          <hr className="border-[#303030] my-3" />
          {renderScheduleInputs('Супермакс', 'supermax_schedule', '[4-5 лет, только родной клуб]', 5)}

        </div>

        <button type="submit" className="w-full bg-[#34c759] text-white py-3.5 rounded-xl font-bold active:scale-[0.98] shadow-lg transition-transform">
          ✅ Сохранить изменения
        </button>
      </form>
    </div>
  );
}

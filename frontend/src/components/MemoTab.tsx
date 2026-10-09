import { useState, useEffect } from 'react';
import { BookOpen, X, Sparkles } from 'lucide-react';

interface MemoTabProps {
  settings?: any;
  onClose?: () => void;
}

export default function MemoTab({ settings: propSettings, onClose }: MemoTabProps) {
  const [settings, setSettings] = useState<any>(propSettings || null);
  const [loading, setLoading] = useState(!propSettings);

  useEffect(() => {
    if (!propSettings) {
      fetch('/api/league/settings')
        .then(r => r.json())
        .then(data => {
          setSettings(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [propSettings]);

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null) return '—';
    if (val >= 100000) return `$${(val / 1000000).toFixed(1)}M`;
    return `$${val.toFixed(val % 1 === 0 ? 1 : 2)}M`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-[#8e8e93]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3390ec] mx-auto mb-3"></div>
        <div>Загрузка параметров контрактов лиги...</div>
      </div>
    );
  }

  const contracts = [
    {
      title: '💵 Минимальный контракт (Minimum)',
      type: 'MIN',
      duration: '1 год + Опция Игрока (PO) на 2-й год (1+1 PO)',
      rules: 'Доступен всем командам без ограничений по жесткому потолку (Apron). Фиксированный срок 1+1 PO.',
      schedule: settings?.min_salary_schedule || [1.15, 1.25, 1.35, 1.45, 1.55],
      maxYears: 2,
      badgeColor: 'border-[#34c759]/30 bg-[#34c759]/10 text-[#34c759]'
    },
    {
      title: '💼 Налоговое исключение среднего уровня (Taxpayer MLE)',
      type: 'TAX_MLE',
      duration: 'Строго 2 года',
      rules: 'Доступно командам в зоне налога на роскошь выше First Apron. Срок строго фиксирован на 2 сезона.',
      schedule: settings?.tax_mle_schedule || [5.3, 5.6, 5.9],
      maxYears: 2,
      badgeColor: 'border-[#ff9f0a]/30 bg-[#ff9f0a]/10 text-[#ff9f0a]'
    },
    {
      title: '🌟 Полное исключение среднего уровня (Non-Taxpayer MLE)',
      type: 'FULL_MLE',
      duration: 'До 4 лет (1–4 года)',
      rules: 'Доступно клубам ниже First Apron. Активация накладывает ограничение жесткого потолка (Hard Cap).',
      schedule: settings?.full_mle_schedule || [12.9, 13.6, 14.3, 15.0],
      maxYears: 4,
      badgeColor: 'border-[#3390ec]/30 bg-[#3390ec]/10 text-[#3390ec]'
    },
    {
      title: '👑 Детский Макс (Rookie Max, 25% кепки)',
      type: 'ROOKIE_MAX',
      duration: 'Строго 4 года',
      rules: 'Доступен ИСКЛЮЧИТЕЛЬНО для игроков со статусом RFA (ограниченно свободные агенты).',
      schedule: settings?.rookie_max_schedule || [35.5, 38.3, 41.1, 44.0],
      maxYears: 4,
      badgeColor: 'border-[#af52de]/30 bg-[#af52de]/10 text-[#af52de]'
    },
    {
      title: '👑 Стандартный Макс (0–6 лет стажа, 25% кепки)',
      type: 'MEDIUM_MAX',
      duration: 'До 4–5 лет',
      rules: 'Для игроков с опытом от 0 до 6 сезонов в NBA.',
      schedule: settings?.medium_max_schedule || [42.5, 45.9, 49.3, 52.7, 56.1],
      maxYears: 5,
      badgeColor: 'border-[#ff3b30]/30 bg-[#ff3b30]/10 text-[#ff3b30]'
    },
    {
      title: '👑 Ветеранский Макс (7–9 лет стажа, 30% кепки)',
      type: 'VETERAN_MAX',
      duration: 'До 4–5 лет',
      rules: 'Для признанных звезд лиги с опытом 7–9 сезонов в NBA.',
      schedule: settings?.veteran_max_schedule || [50.0, 54.0, 58.0, 62.0, 66.0],
      maxYears: 5,
      badgeColor: 'border-[#ff9f0a]/30 bg-[#ff9f0a]/10 text-[#ff9f0a]'
    },
    {
      title: '👑 Супермакс (10+ лет стажа, 35% кепки)',
      type: 'SUPERMAX',
      duration: 'До 4–5 лет',
      rules: 'Максимальный контракт в NBA. Может предложить ТОЛЬКО родная команда игрока.',
      schedule: settings?.supermax_schedule || [60.0, 64.8, 69.6, 74.4, 79.2],
      maxYears: 5,
      badgeColor: 'border-[#ffd60a]/30 bg-[#ffd60a]/10 text-[#ffd60a]'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#181818] text-white">
      {/* Header */}
      <div className="p-4 bg-[#212121] border-b border-[#303030] flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#3390ec]" />
          <div>
            <h2 className="text-[16px] font-extrabold text-white leading-tight">📖 Памятка по контрактам</h2>
            <div className="text-[11px] text-[#8e8e93]">Сетки зарплат, ограничения и правила торгов CBA</div>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-[#8e8e93] hover:text-white bg-[#303030] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 overflow-y-auto pb-24">
        {/* Important Bidding Rules Box */}
        <div className="bg-[#3390ec]/10 border border-[#3390ec]/30 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-[#3390ec] font-bold text-[13px]">
            <Sparkles className="w-4 h-4" />
            <span>Критическое правило оценки предложений (Торги)</span>
          </div>
          <div className="text-[12px] text-[#e0e0e0] space-y-1.5 leading-relaxed">
            <p>
              • <strong className="text-white">Оценка строго по первым 4 годам:</strong> Лидирующий оффер определяется 
              исключительно по общей сумме первых 4 сезонов.
            </p>
            <p>
              • <strong className="text-white">5-й год — удержание:</strong> Если клуб предлагает 5-летний контракт, 
              зарплата за 5-й год гарантирована игроку в будущем, но <span className="text-[#ff9f0a] font-semibold">НЕ учитывается в рыночной оценке оффера</span>.
            </p>
            <p>
              • <strong className="text-white">Опция (PO / TO):</strong> Применяется строго к <span className="text-white font-semibold">последнему году</span> предложенного контракта. При этом сумма последнего года полностью засчитывается в 4-летнюю оценку.
            </p>
          </div>
        </div>

        {/* Contracts Grid */}
        <div className="space-y-3">
          {contracts.map((c, i) => (
            <div key={i} className="bg-[#212121] border border-[#303030] rounded-2xl p-4 space-y-3 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="text-[14px] font-extrabold text-white">
                  {c.title}
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border shrink-0 ${c.badgeColor}`}>
                  {c.duration}
                </span>
              </div>

              <div className="text-[11px] text-[#8e8e93] leading-snug">
                {c.rules}
              </div>

              {/* Salary by year table */}
              <div className="bg-[#181818] border border-[#2c2c2e] rounded-xl p-2.5 overflow-x-auto">
                <div className="grid grid-cols-5 gap-2 min-w-[320px] text-center">
                  {[0, 1, 2, 3, 4].map(idx => {
                    const isAvailableYear = idx < c.maxYears;
                    const val = isAvailableYear ? c.schedule[idx] : null;
                    const isLastYearOption = (idx === c.maxYears - 1) && (c.type === 'MIN');
                    
                    return (
                      <div key={idx} className="flex flex-col items-center">
                        <span className="text-[10px] text-[#8e8e93] font-bold">Год {idx + 1}</span>
                        <span className={`text-[12px] font-extrabold mt-0.5 ${val ? 'text-white' : 'text-[#48484a]'}`}>
                          {formatMoney(val)}
                        </span>
                        {isLastYearOption && (
                          <span className="text-[9px] text-[#34c759] font-bold mt-0.5">(PO)</span>
                        )}
                        {idx === 4 && isAvailableYear && (
                          <span className="text-[8px] text-[#ff9f0a] font-bold mt-0.5">(Удерж.)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

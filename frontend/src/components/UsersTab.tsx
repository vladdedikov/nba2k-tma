import { useState, useEffect } from 'react';
import { Users, Check, RefreshCw, Shield, UserCheck, AlertCircle } from 'lucide-react';

interface UserItem {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  role: string;
  team_id: string | null;
  team?: {
    id: string;
    name: string;
  } | null;
}

interface TeamItem {
  id: string;
  name: string;
  logo_url: string | null;
  budget: number;
  salary_cap: number;
  gm?: UserItem | null;
}

interface UsersTabProps {
  role: 'PLAYER' | 'ADMIN';
  onUpdate?: () => void;
}

export default function UsersTab({ role, onUpdate }: UsersTabProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserByTeam, setSelectedUserByTeam] = useState<Record<string, number | null>>({});
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'x-user-role': role }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTeams(data.teams || []);

        // Initialize local selected user for each team based on current gm
        const initialMap: Record<string, number | null> = {};
        (data.teams || []).forEach((t: TeamItem) => {
          initialMap[t.id] = t.gm ? t.gm.id : null;
        });
        setSelectedUserByTeam(initialMap);
      }
    } catch (e) {
      console.error('Error fetching admin users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAssign = async (teamId: string) => {
    const selectedUserId = selectedUserByTeam[teamId];
    setSavingTeamId(teamId);
    try {
      const res = await fetch('/api/admin/users/assign-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          team_id: selectedUserId ? teamId : null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Назначение успешно обновлено!');
        await fetchData();
        if (onUpdate) onUpdate();
      } else {
        alert(data.error || 'Ошибка при назначении команды');
      }
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка при назначении команды');
    } finally {
      setSavingTeamId(null);
    }
  };

  if (role !== 'ADMIN') {
    return (
      <div className="p-8 text-center text-[#8e8e93]">
        <Shield className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#ff3b30]" />
        <div className="text-white font-bold text-lg mb-1">Доступ ограничен</div>
        <div className="text-[13px]">Только комиссионер лиги имеет доступ к распределению команд.</div>
      </div>
    );
  }

  const assignedCount = teams.filter(t => t.gm).length;

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#34c759] text-black font-extrabold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-[13px] border border-white/20 animate-fade-in">
          <span>✅</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-[#212121] border border-[#303030] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-[#3390ec] font-extrabold text-[16px]">
            <Users className="w-5 h-5" />
            <span>Участники лиги и распределение команд</span>
          </div>
          <div className="text-[#8e8e93] text-[12px] mt-0.5">
            Закрепите каждого зашедшего друга за его клубом NBA. Пользователи без команды останутся зрителями.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-[#181818] border border-[#303030] rounded-xl text-[12px] font-bold text-[#e0e0e0] flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#34c759]" />
            <span>ГМ: <strong className="text-white">{assignedCount}</strong> / {teams.length}</span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-[#303030] hover:bg-[#3a3a3c] rounded-xl text-white transition-colors active:scale-95"
            title="Обновить список"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Summary Bar */}
      <div className="bg-[#181818] border border-[#303030] rounded-xl p-3 flex items-center justify-between text-[12px]">
        <div className="text-[#8e8e93]">
          Всего участников в базе: <strong className="text-white">{users.length}</strong>
        </div>
        <div className="flex items-center gap-2 text-[#8e8e93]">
          <span className="w-2 h-2 rounded-full bg-[#34c759]"></span>
          <span>В игре</span>
          <span className="w-2 h-2 rounded-full bg-[#ff9f0a] ml-2"></span>
          <span>Зритель</span>
        </div>
      </div>

      {/* Teams Table */}
      {loading ? (
        <div className="py-16 text-center text-[#8e8e93]">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2 opacity-50" />
          <div className="text-[13px]">Загрузка участников и команд лиги...</div>
        </div>
      ) : teams.length === 0 ? (
        <div className="py-12 text-center text-[#8e8e93] bg-[#212121] rounded-2xl border border-[#303030]">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <div className="text-[14px] font-bold text-white">Команды не найдены</div>
          <div className="text-[12px] mt-1">Выполните посев данных базы.</div>
        </div>
      ) : (
        <div className="bg-[#212121] border border-[#303030] rounded-2xl overflow-hidden shadow-lg divide-y divide-[#2a2a2a]">
          {teams.map((team) => {
            const currentGm = team.gm;
            const currentSelected = selectedUserByTeam[team.id];
            const isModified = (currentGm ? currentGm.id : null) !== (currentSelected ?? null);
            const isSaving = savingTeamId === team.id;

            return (
              <div 
                key={team.id}
                className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#252525] transition-colors"
              >
                {/* Team Info */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className="w-9 h-9 object-contain shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#303030] flex items-center justify-center text-[12px] font-bold text-white shrink-0">
                      {team.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-[14px] font-extrabold text-white leading-tight">
                      {team.name}
                    </div>
                    <div className="text-[11px] mt-0.5 flex items-center gap-1.5">
                      {currentGm ? (
                        <span className="text-[#34c759] font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]"></span>
                          ГМ: @{currentGm.username || `id${currentGm.telegram_id}`} {currentGm.first_name ? `(${currentGm.first_name})` : ''}
                        </span>
                      ) : (
                        <span className="text-[#8e8e93] font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff9f0a]"></span>
                          Клуб свободен (без ГМ)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assignment Controls */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select
                    value={currentSelected ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setSelectedUserByTeam(prev => ({ ...prev, [team.id]: val }));
                    }}
                    className="flex-1 md:w-[260px] bg-[#181818] border border-[#3a3a3c] focus:border-[#3390ec] text-white rounded-xl px-3 py-2 text-[12px] font-semibold outline-none transition-colors"
                  >
                    <option value="">— Не назначен (Свободно) —</option>
                    {users.map(u => {
                      const isAssignedHere = currentGm?.id === u.id;
                      const isAssignedElsewhere = u.team_id && u.team_id !== team.id;
                      return (
                        <option key={u.id} value={u.id}>
                          @{u.username || `id${u.telegram_id}`} {u.first_name ? `(${u.first_name})` : ''}
                          {isAssignedHere ? ' (текущий ГМ)' : isAssignedElsewhere ? ` [${u.team?.name || 'В другом клубе'}]` : ' [Зритель]'}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    onClick={() => handleAssign(team.id)}
                    disabled={isSaving || !isModified}
                    className={`px-3.5 py-2 rounded-xl text-[12px] font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1.5 ${
                      isModified
                        ? 'bg-[#34c759] hover:bg-[#2fb350] text-black shadow-md shadow-[#34c759]/20'
                        : 'bg-[#2a2a2a] text-[#636366] cursor-not-allowed'
                    }`}
                  >
                    {isSaving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{isSaving ? 'Сохранение...' : 'Закрепить'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

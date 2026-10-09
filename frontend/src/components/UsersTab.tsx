import { useState, useEffect } from 'react';
import { Users, Check, RefreshCw, Shield, UserCheck, AlertCircle, Crown } from 'lucide-react';

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
  const [viewMode, setViewMode] = useState<'USERS' | 'TEAMS'>('USERS');

  // Selected team per user for the users list
  const [selectedTeamByUser, setSelectedTeamByUser] = useState<Record<number, string>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  // Selected user per team for the teams list
  const [selectedUserByTeam, setSelectedUserByTeam] = useState<Record<string, number | null>>({});
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'x-user-role': role }
      });
      if (res.ok) {
        const data = await res.json();
        const loadedUsers = data.users || [];
        const loadedTeams = data.teams || [];
        setUsers(loadedUsers);
        setTeams(loadedTeams);

        // Initialize maps
        const userTeamMap: Record<number, string> = {};
        loadedUsers.forEach((u: UserItem) => {
          userTeamMap[u.id] = u.team_id || '';
        });
        setSelectedTeamByUser(userTeamMap);

        const teamUserMap: Record<string, number | null> = {};
        loadedTeams.forEach((t: TeamItem) => {
          teamUserMap[t.id] = t.gm ? t.gm.id : null;
        });
        setSelectedUserByTeam(teamUserMap);
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

  // Change user's role (ADMIN vs USER)
  const handleSetRole = async (targetUserId: number, newRole: 'ADMIN' | 'USER') => {
    setRoleUpdatingId(targetUserId);
    try {
      const res = await fetch('/api/admin/users/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({
          target_user_id: targetUserId,
          role: newRole
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || 'Ошибка смены роли');
        return;
      }
      setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
      showToast(newRole === 'ADMIN' ? 'Права администратора выданы!' : 'Права администратора отозваны');
      if (onUpdate) onUpdate();
    } catch (e) {
      alert('Сетевая ошибка при изменении роли');
    } finally {
      setRoleUpdatingId(null);
    }
  };

  // Assign team from user row
  const handleAssignUserTeam = async (userId: number) => {
    const targetTeamId = selectedTeamByUser[userId] || null;
    setSavingUserId(userId);
    try {
      const res = await fetch('/api/admin/users/assign-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({
          user_id: userId,
          team_id: targetTeamId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Команда успешно закреплена!');
        await fetchData();
        if (onUpdate) onUpdate();
      } else {
        alert(data.error || 'Ошибка при назначении команды');
      }
    } catch (err) {
      alert('Сетевая ошибка при назначении команды');
    } finally {
      setSavingUserId(null);
    }
  };

  // Assign user from team row
  const handleAssignTeamGM = async (teamId: string) => {
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
        <div className="text-[13px]">Только администраторы лиги имеют доступ к управлению участниками.</div>
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
            Управляйте правами администратора и закрепляйте участников за клубами NBA.
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* View Mode Switcher */}
      <div className="flex bg-[#212121] p-1.5 rounded-2xl border border-[#303030] gap-1 text-[13px] font-bold">
        <button
          onClick={() => setViewMode('USERS')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            viewMode === 'USERS' ? 'bg-[#3390ec] text-white shadow-md shadow-[#3390ec]/20' : 'text-[#8e8e93] hover:text-white'
          }`}
        >
          <Crown className="w-4 h-4" />
          <span>По участникам ({users.length})</span>
        </button>
        <button
          onClick={() => setViewMode('TEAMS')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            viewMode === 'TEAMS' ? 'bg-[#3390ec] text-white shadow-md shadow-[#3390ec]/20' : 'text-[#8e8e93] hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>По командам ({teams.length})</span>
        </button>
      </div>

      {/* VIEW A: BY USERS (With Role Management and Team Selection) */}
      {viewMode === 'USERS' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center text-[#8e8e93]">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2 opacity-50" />
              <div className="text-[13px]">Загрузка участников...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-[#8e8e93] bg-[#212121] rounded-2xl border border-[#303030]">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <div className="text-[14px] font-bold text-white">Участники не найдены</div>
              <div className="text-[12px] mt-1">Ожидайте входа пользователей через Telegram.</div>
            </div>
          ) : (
            <div className="bg-[#212121] border border-[#303030] rounded-2xl overflow-hidden shadow-lg divide-y divide-[#2a2a2a]">
              {users.map((user) => {
                const currentSelectedTeam = selectedTeamByUser[user.id] ?? (user.team_id || '');
                const isTeamModified = currentSelectedTeam !== (user.team_id || '');
                const isSaving = savingUserId === user.id;
                const isRoleUpdating = roleUpdatingId === user.id;
                const isCreator = user.username?.toLowerCase() === 'smthing69else';

                return (
                  <div
                    key={user.id}
                    className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#252525] transition-colors"
                  >
                    {/* User Profile Info */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0 border ${
                        user.role === 'ADMIN' ? 'bg-[#ff9f0a]/20 border-[#ff9f0a]/50 text-[#ff9f0a]' : 'bg-[#303030] border-transparent text-white'
                      }`}>
                        {user.first_name ? user.first_name.slice(0, 1).toUpperCase() : user.username ? user.username.slice(0, 1).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] font-extrabold text-white leading-tight flex items-center gap-1.5 truncate">
                          <span>@{user.username || `id${user.telegram_id}`}</span>
                          {user.first_name && <span className="text-[#8e8e93] text-[12px] font-normal truncate">({user.first_name})</span>}
                        </div>
                        <div className="text-[11px] mt-0.5 flex items-center gap-1.5">
                          {user.team ? (
                            <span className="text-[#34c759] font-bold flex items-center gap-1 truncate">
                              <span>🏀</span>
                              <span>{user.team.name}</span>
                            </span>
                          ) : (
                            <span className="text-[#8e8e93] font-medium flex items-center gap-1">
                              <span>👀</span>
                              <span>Зритель (без команды)</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Team Selection Dropdown */}
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <select
                        value={currentSelectedTeam}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedTeamByUser(prev => ({ ...prev, [user.id]: val }));
                        }}
                        className="flex-1 bg-[#181818] border border-[#3a3a3c] focus:border-[#3390ec] text-white rounded-xl px-2.5 py-2 text-[12px] font-semibold outline-none transition-colors truncate"
                      >
                        <option value="">— Зритель (без команды) —</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.gm && t.gm.id !== user.id ? `(занят @${t.gm.username || 'GM'})` : ''}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleAssignUserTeam(user.id)}
                        disabled={isSaving || !isTeamModified}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1 ${
                          isTeamModified
                            ? 'bg-[#34c759] hover:bg-[#2fb350] text-black shadow-md shadow-[#34c759]/20'
                            : 'bg-[#2a2a2a] text-[#636366] cursor-not-allowed opacity-50'
                        }`}
                        title="Закрепить команду за пользователем"
                      >
                        {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>{isSaving ? '...' : 'Закрепить'}</span>
                      </button>
                    </div>

                    {/* Right: Admin Role Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isCreator ? (
                        <span className="px-3 py-1.5 bg-[#ff9f0a]/20 border border-[#ff9f0a]/50 text-[#ff9f0a] font-extrabold text-[11px] rounded-xl flex items-center gap-1.5 shadow-sm">
                          <span>👑</span>
                          <span>Создатель лиги</span>
                        </span>
                      ) : user.role === 'ADMIN' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1.5 bg-[#ff9f0a]/20 border border-[#ff9f0a]/40 text-[#ff9f0a] font-bold text-[11px] rounded-xl flex items-center gap-1">
                            <span>👑</span>
                            <span>Администратор</span>
                          </span>
                          <button
                            onClick={() => handleSetRole(user.id, 'USER')}
                            disabled={isRoleUpdating}
                            className="px-2.5 py-1.5 bg-[#303030] hover:bg-[#ff3b30]/20 text-[#8e8e93] hover:text-[#ff3b30] font-bold text-[11px] rounded-xl transition-colors active:scale-95"
                          >
                            {isRoleUpdating ? '...' : 'Снять права'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSetRole(user.id, 'ADMIN')}
                          disabled={isRoleUpdating}
                          className="px-3 py-1.5 bg-[#303030] hover:bg-[#3a3a3c] text-[#e0e0e0] hover:text-white font-bold text-[11px] rounded-xl transition-all active:scale-95 flex items-center gap-1 border border-transparent hover:border-[#4a4a4c]"
                        >
                          <span>👑</span>
                          <span>{isRoleUpdating ? 'Сохранение...' : 'Сделать админом'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW B: BY TEAMS */}
      {viewMode === 'TEAMS' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center text-[#8e8e93]">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2 opacity-50" />
              <div className="text-[13px]">Загрузка команд...</div>
            </div>
          ) : teams.length === 0 ? (
            <div className="py-12 text-center text-[#8e8e93] bg-[#212121] rounded-2xl border border-[#303030]">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <div className="text-[14px] font-bold text-white">Команды не найдены</div>
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
                        onClick={() => handleAssignTeamGM(team.id)}
                        disabled={isSaving || !isModified}
                        className={`px-3.5 py-2 rounded-xl text-[12px] font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1.5 ${
                          isModified
                            ? 'bg-[#34c759] hover:bg-[#2fb350] text-black shadow-md shadow-[#34c759]/20'
                            : 'bg-[#2a2a2a] text-[#636366] cursor-not-allowed opacity-50'
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
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Megaphone, Send, RefreshCw } from 'lucide-react';

interface FeedTabProps {
  role?: 'PLAYER' | 'ADMIN';
  myTeamId?: string;
}

export default function FeedTab({ role = 'PLAYER', myTeamId }: FeedTabProps) {
  const [feed, setFeed] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Announcement Form State
  const [isPostingOpen, setIsPostingOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [adminTeamId, setAdminTeamId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchFeed = async () => {
    try {
      const res = await fetch('/api/feed');
      const data = await res.json();
      setFeed(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching feed:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      const safe = Array.isArray(data) ? data : (data.teams || []);
      setTeams(safe);
      if (safe.length > 0 && !adminTeamId) {
        setAdminTeamId(safe[0].id);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchFeed();
    fetchTeams();
  }, []);

  const activePostingTeamId = role === 'ADMIN' ? (adminTeamId || myTeamId) : myTeamId;
  const activePostingTeam = teams.find(t => t.id === activePostingTeamId);
  const canPublish = Boolean(role === 'ADMIN' || myTeamId);

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim()) return;
    if (!activePostingTeamId) {
      alert('Выберите команду для публикации заявления');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/insiders/team-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role,
          'x-user-team-id': activePostingTeamId
        },
        body: JSON.stringify({
          text: postText.trim(),
          team_id: activePostingTeamId
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || 'Ошибка публикации заявления');
        return;
      }

      setPostText('');
      setIsPostingOpen(false);
      setToast('Заявление успешно опубликовано в ленте!');
      setTimeout(() => setToast(null), 3000);
      await fetchFeed();
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка при публикации');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3390ec] mb-4"></div>
        <div className="text-sm font-bold">Загрузка инсайдов...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-28">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#34c759] text-black font-extrabold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-[13px] border border-white/20">
          <span>✅</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Header Row */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span>📰 Инсайды и новости лиги</span>
          </h2>
          <div className="text-[12px] text-[#8e8e93]">
            Слухи об обменах, подписания и официальные заявления команд
          </div>
        </div>

        <button
          onClick={fetchFeed}
          className="p-2 bg-[#212121] hover:bg-[#303030] text-[#8e8e93] hover:text-white rounded-xl border border-[#303030] transition-colors"
          title="Обновить ленту"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Announcement Publisher Box */}
      {canPublish && (
        <div className="bg-[#212121] border border-[#303030] rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[14px] font-bold text-white">
              <Megaphone className="w-4 h-4 text-[#ff9f0a]" />
              <span>Официальное заявление команды</span>
            </div>

            <button
              onClick={() => setIsPostingOpen(!isPostingOpen)}
              className="text-[12px] font-bold px-3 py-1.5 bg-[#ff9f0a]/15 text-[#ff9f0a] hover:bg-[#ff9f0a]/25 rounded-xl transition-colors active:scale-95"
            >
              {isPostingOpen ? 'Свернуть' : '📢 Опубликовать'}
            </button>
          </div>

          {isPostingOpen && (
            <form onSubmit={handlePublishAnnouncement} className="space-y-3 pt-2 border-t border-[#303030]">
              {role === 'ADMIN' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#8e8e93]">От имени команды:</label>
                  <select
                    value={adminTeamId}
                    onChange={e => setAdminTeamId(e.target.value)}
                    className="w-full bg-[#181818] border border-[#303030] p-2.5 rounded-xl text-white text-[12px] font-bold outline-none focus:border-[#3390ec]"
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder="Например: Готовы рассмотреть варианты обмена пиков на проверенного центрового..."
                  className="w-full p-3 bg-[#181818] border border-[#303030] rounded-xl text-[13px] text-white outline-none focus:border-[#3390ec] resize-none h-[90px]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPostingOpen(false)}
                  className="px-3.5 py-2 bg-[#303030] text-white text-[12px] font-bold rounded-xl active:scale-95 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !postText.trim()}
                  className="px-4 py-2 bg-[#ff9f0a] hover:bg-[#e08e08] text-black font-extrabold text-[12px] rounded-xl flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-[#ff9f0a]/20 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Публикация...' : `Опубликовать от имени ${activePostingTeam?.name || 'клуба'}`}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Feed Posts */}
      {feed.length === 0 ? (
        <div className="text-[#8e8e93] text-center p-8 bg-[#212121] rounded-2xl border border-[#303030]">
          Лента пуста. Совершите первый обмен или опубликуйте заявление клуба!
        </div>
      ) : (
        <div className="space-y-3.5">
          {feed.map((post: any) => {
            const isTeamPost = post.type === 'TEAM_POST';
            const team = post.team;
            const dateStr = new Date(post.created_at).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            });

            if (isTeamPost) {
              return (
                <div 
                  key={post.id} 
                  className="bg-[#212121] p-4 rounded-2xl shadow-md border-l-4 border-l-[#ff9f0a] border border-[#303030] transition-all hover:bg-[#242424]"
                >
                  {/* Team Post Header */}
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="flex items-center gap-3">
                      {team?.logo_url ? (
                        <img src={team.logo_url} alt={team.name} className="w-9 h-9 object-contain" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#ff9f0a]/20 text-[#ff9f0a] flex items-center justify-center font-black text-[12px]">
                          {team?.name ? team.name.slice(0, 2).toUpperCase() : 'NBA'}
                        </div>
                      )}
                      <div>
                        <div className="text-[14px] font-extrabold text-white leading-tight">
                          {team?.name || 'Пресс-служба команды'}
                        </div>
                        <div className="text-[11px] text-[#8e8e93]">
                          Официальное заявление • {dateStr}
                        </div>
                      </div>
                    </div>

                    <span className="bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/30 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase">
                      Заявление клуба
                    </span>
                  </div>

                  <p className="text-[14px] text-[#f0f0f0] whitespace-pre-wrap leading-relaxed pl-12">
                    {post.content}
                  </p>
                </div>
              );
            }

            // Standard Woj / Shams / System Insider Post
            const isShams = post.content.includes('ShamsCharania');
            const authorName = isShams ? 'Shams Charania' : 'Adrian Wojnarowski';
            const handle = isShams ? '@ShamsCharania' : '@wojespn';
            const initial = isShams ? 'S' : 'W';
            const badgeBg = isShams ? 'bg-[#34c759]' : 'bg-[#3390ec]';

            return (
              <div 
                key={post.id} 
                className="bg-[#212121] p-4 rounded-2xl shadow-sm border border-[#303030]/60 transition-all hover:bg-[#242424]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full ${badgeBg} text-white flex items-center justify-center font-black text-[13px] shadow-sm`}>
                      {initial}
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-white leading-tight">{authorName}</div>
                      <div className="text-[11px] text-[#8e8e93]">{handle} • {dateStr}</div>
                    </div>
                  </div>

                  <span className="bg-[#3390ec]/15 text-[#3390ec] border border-[#3390ec]/30 px-2 py-0.5 rounded text-[10px] font-bold">
                    ⚡️ Breaking
                  </span>
                </div>

                <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed pl-10">
                  {post.content}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

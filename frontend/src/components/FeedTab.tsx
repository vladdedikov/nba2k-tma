import { useState, useEffect } from 'react';

export default function FeedTab() {
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/feed')
      .then(res => res.json())
      .then(data => {
        setFeed(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-[#8e8e93]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3390ec] mb-4"></div>
      <div className="text-sm font-bold">Загрузка инсайдов...</div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold mb-4">Инсайды (Feed)</h2>
      {feed.length === 0 ? (
        <div className="text-[#8e8e93] text-center p-6 bg-[#212121] rounded-2xl">Лента пуста. Совершите первый трейд!</div>
      ) : (
        <div className="space-y-4">
          {feed.map((post: any) => (
            <div key={post.id} className="bg-[#212121] p-4 rounded-2xl shadow-sm border border-[#303030]/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#3390ec] flex items-center justify-center font-bold">W</div>
                <div>
                  <div className="text-[14px] font-bold">Adrian Wojnarowski</div>
                  <div className="text-[12px] text-[#8e8e93]">@wojespn • {new Date(post.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <p className="text-[14px] text-white whitespace-pre-wrap">{post.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

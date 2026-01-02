import React from 'react';

interface Activity {
  id: number;
  status: string;
  progress?: number;
  createdAt: number;
  media: {
    id: number;
    title: { userPreferred: string };
    coverImage: { medium: string };
  };
}

function timeAgo(timestamp: number) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ActivityFeed: React.FC<{ activities: Activity[] }> = ({ activities }) => {
  if (!activities || activities.length === 0) {
    return <div className="text-gray-500 text-sm py-4">No recent activity.</div>;
  }

  return (
    <div className="space-y-4">
      {activities.map((act) => (
        <div key={act.id} className="flex gap-4 items-start group">
           <img 
             src={act.media.coverImage.medium} 
             alt="cover" 
             className="w-12 h-16 object-cover rounded shadow-md group-hover:scale-105 transition-transform" 
           />
           <div className="flex-1 py-1">
              <div className="text-sm text-gray-300 leading-snug">
                {act.status === 'watched episode' || act.status === 'read chapter' ? (
                   <>Read chapter <span className="text-primary font-bold">{act.progress}</span> of</>
                ) : (
                   <span className="capitalize">{act.status}</span>
                )}
                {' '}
                <span className="text-primary font-bold hover:underline cursor-pointer">
                  {act.media.title.userPreferred}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{timeAgo(act.createdAt)}</div>
           </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;

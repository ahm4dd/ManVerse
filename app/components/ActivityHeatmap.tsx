import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface ActivityPoint {
  date: number; // Unix timestamp
  amount: number;
}

interface ActivityHeatmapProps {
  history: ActivityPoint[];
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ history }) => {
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; count: number; date: string } | null>(null);

  // Generate last 365 days
  const calendarData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const data: { date: Date; count: number; level: number }[] = [];
    const historyMap = new Map<string, number>();

    // Map history to "YYYY-MM-DD"
    history.forEach(h => {
      const d = new Date(h.date * 1000);
      const key = d.toISOString().split('T')[0];
      historyMap.set(key, (historyMap.get(key) || 0) + h.amount);
    });

    // Generate grid (reverse order for display)
    // We want roughly 52 weeks * 7 days
    for (let i = 0; i < 364; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (363 - i));
        const key = d.toISOString().split('T')[0];
        const count = historyMap.get(key) || 0;
        
        let level = 0;
        if (count > 0) level = 1;
        if (count > 3) level = 2;
        if (count > 6) level = 3;
        if (count > 10) level = 4;

        data.push({ date: d, count, level });
    }
    return data;
  }, [history]);

  // Group by weeks for the grid layout
  const weeks = useMemo(() => {
      const weeksArray = [];
      let currentWeek = [];
      
      for (let i = 0; i < calendarData.length; i++) {
          currentWeek.push(calendarData[i]);
          if (currentWeek.length === 7) {
              weeksArray.push(currentWeek);
              currentWeek = [];
          }
      }
      if (currentWeek.length > 0) weeksArray.push(currentWeek);
      return weeksArray;
  }, [calendarData]);

  const getLevelColor = (level: number) => {
     switch(level) {
        case 1: return 'bg-primary/30';
        case 2: return 'bg-primary/50';
        case 3: return 'bg-primary/70';
        case 4: return 'bg-primary';
        default: return 'bg-surfaceHighlight/50';
     }
  };

  return (
    <>
      <div className="w-full overflow-x-auto scrollbar-hide">
        <div className="flex gap-[3px] min-w-max pb-2">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-[3px]">
              {week.map((day, dIdx) => (
                <motion.div
                  key={dIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: wIdx * 0.01 + dIdx * 0.01 }}
                  className={`w-3 h-3 rounded-[2px] ${getLevelColor(day.level)} hover:scale-125 transition-transform cursor-default relative`}
                  onMouseEnter={(e) => {
                    if (day.count > 0) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoverInfo({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        count: day.count,
                        date: day.date.toLocaleDateString()
                      });
                    }
                  }}
                  onMouseLeave={() => setHoverInfo(null)}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500 font-medium px-1">
           <span>Less</span>
           <div className="flex gap-[3px] items-center">
              <div className={`w-3 h-3 rounded-[2px] ${getLevelColor(0)}`}></div>
              <div className={`w-3 h-3 rounded-[2px] ${getLevelColor(1)}`}></div>
              <div className={`w-3 h-3 rounded-[2px] ${getLevelColor(2)}`}></div>
              <div className={`w-3 h-3 rounded-[2px] ${getLevelColor(4)}`}></div>
           </div>
           <span>More</span>
        </div>
      </div>

      {/* Global Fixed Tooltip */}
      {hoverInfo && (
        <div 
          className="fixed z-[1000] pointer-events-none bg-[#0a0a0a] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg border border-white/10 shadow-xl whitespace-nowrap ring-1 ring-white/10"
          style={{ 
            left: hoverInfo.x, 
            top: hoverInfo.y - 8,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <span className="text-primary">{hoverInfo.count} chapters</span> on {hoverInfo.date}
        </div>
      )}
    </>
  );
};

export default ActivityHeatmap;
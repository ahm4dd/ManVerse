import React, { useEffect, useState } from 'react';
import { Series } from '../types';
import { anilistApi } from '../lib/anilist';
import SeriesCard from '../components/SeriesCard';

interface RecommendationsProps {
  onNavigate: (view: string, data?: any) => void;
}

const Recommendations: React.FC<RecommendationsProps> = ({ onNavigate }) => {
  const [trending, setTrending] = useState<Series[]>([]);
  const [popular, setPopular] = useState<Series[]>([]);
  const [topRated, setTopRated] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [t, p, tr] = await Promise.all([
          anilistApi.getTrending(),
          anilistApi.getPopular(),
          anilistApi.getTopRated()
        ]);
        setTrending(t);
        setPopular(p);
        setTopRated(tr);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const Section = ({ title, data }: { title: string, data: Series[] }) => (
    <div className="mb-12 animate-fade-in">
      <div className="flex items-center justify-between mb-6 px-4 md:px-0">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
           <span className="w-1.5 h-6 bg-primary rounded-full"></span>
           {title}
        </h2>
      </div>
      <div className="overflow-x-auto pb-8 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
         <div className="flex gap-4 md:gap-6 w-max">
            {data.map(series => (
               <div key={series.id} className="w-[160px] md:w-[200px]">
                  <SeriesCard series={series} onClick={() => onNavigate('details', series.id)} />
               </div>
            ))}
         </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-8 pb-20 max-w-[1600px] mx-auto md:px-8">
       <div className="px-4 md:px-0 mb-10">
         <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">Discover</h1>
         <p className="text-gray-400 font-medium">Curated lists from the AniList community.</p>
       </div>
       
       {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
             <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             <p className="text-gray-500 font-medium">Fetching best manga...</p>
          </div>
       ) : (
          <>
            <Section title="Trending Now" data={trending} />
            <Section title="All Time Popular" data={popular} />
            <Section title="Top Rated" data={topRated} />
          </>
       )}
    </div>
  );
}

export default Recommendations;
import React, { useState } from 'react';
import { anilistApi } from '../lib/anilist';
import { XIcon, StarIcon } from './Icons';
import { motion } from 'framer-motion';

interface EditEntryModalProps {
  entry: any; // MediaListEntry object from AniList
  media: any; // Series info
  onClose: () => void;
  onUpdate: () => void;
}

const EditEntryModal: React.FC<EditEntryModalProps> = ({ entry, media, onClose, onUpdate }) => {
  const [status, setStatus] = useState(entry?.status || 'PLANNING');
  const [score, setScore] = useState(entry?.score || 0);
  const [progress, setProgress] = useState(entry?.progress || 0);
  const [notes, setNotes] = useState(entry?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const success = await anilistApi.updateEntry({
      mediaId: media.id,
      status,
      score,
      progress,
      notes
    });
    setSaving(false);
    if (success) {
      onUpdate();
      onClose();
    }
  };

  const banner = media.bannerImage || media.coverImage.extraLarge;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-[#151515] rounded-xl shadow-2xl border border-white/10 overflow-hidden"
      >
        {/* Header Image */}
        <div className="h-40 relative">
          <img src={banner} className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#151515] to-transparent" />
          
          <div className="absolute bottom-6 left-6 flex items-end gap-5">
             <img src={media.coverImage.extraLarge} className="w-24 h-36 rounded-lg shadow-xl object-cover border-2 border-[#151515]" />
             <div className="mb-2">
                <h2 className="text-2xl font-bold text-white line-clamp-1">{media.title.english || media.title.romaji}</h2>
             </div>
          </div>

          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-white/10 rounded-full text-white transition-colors">
             <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
           
           {/* Status */}
           <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Status</label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-surfaceHighlight border border-white/10 text-white rounded-lg px-4 py-3 font-medium outline-none focus:border-primary"
              >
                 <option value="CURRENT">Reading</option>
                 <option value="PLANNING">Plan to Read</option>
                 <option value="COMPLETED">Completed</option>
                 <option value="DROPPED">Dropped</option>
                 <option value="PAUSED">Paused</option>
                 <option value="REPEATING">Rereading</option>
              </select>
           </div>

           {/* Score */}
           <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Score</label>
              <div className="relative">
                <input 
                  type="number" 
                  min="0" 
                  max="100" // Assuming 100 point scale, can adjust
                  value={score}
                  onChange={e => setScore(Number(e.target.value))}
                  className="w-full bg-surfaceHighlight border border-white/10 text-white rounded-lg px-4 py-3 font-medium outline-none focus:border-primary"
                />
                <StarIcon className="absolute right-4 top-3.5 w-4 h-4 text-yellow-500" fill />
              </div>
           </div>

           {/* Chapter Progress */}
           <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Chapter Progress</label>
              <div className="flex items-center gap-2 bg-surfaceHighlight border border-white/10 rounded-lg px-2">
                 <input 
                   type="number" 
                   value={progress}
                   onChange={e => setProgress(Number(e.target.value))}
                   className="w-full bg-transparent text-white px-2 py-3 font-medium outline-none"
                 />
                 <span className="text-gray-500 text-xs font-bold whitespace-nowrap pr-2">/ {media.chapters || '?'}</span>
              </div>
           </div>

           {/* Private Toggle (Mock) */}
           <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" className="w-5 h-5 rounded border-gray-600 bg-surfaceHighlight text-primary focus:ring-primary" />
              <span className="text-sm font-medium text-gray-300">Private entry</span>
           </div>

           {/* Notes */}
           <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Notes</label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-surfaceHighlight border border-white/10 text-white rounded-lg px-4 py-3 font-medium outline-none focus:border-primary resize-none"
                placeholder="Write some notes..."
              />
           </div>

        </div>

        {/* Footer */}
        <div className="p-6 bg-surfaceHighlight/30 border-t border-white/5 flex justify-end gap-3">
           <button onClick={onClose} className="px-6 py-2.5 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
           </button>
           <button 
             onClick={handleSave}
             disabled={saving}
             className="px-8 py-2.5 rounded-lg text-sm font-bold bg-[#3DB4F2] text-white hover:bg-[#3db4f2]/90 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
           >
              {saving ? 'Saving...' : 'Save'}
           </button>
        </div>

      </motion.div>
    </div>
  );
};

export default EditEntryModal;

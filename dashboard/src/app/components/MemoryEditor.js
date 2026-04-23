import { useState, useEffect } from 'react';
import { Save, FileText, Clock, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export default function MemoryEditor() {
  const [content, setContent] = useState('# MEMORY.md\n\n- Loading from bridge...');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Mock loading from bridge
  useEffect(() => {
    setTimeout(() => {
      setContent('# MEMORY.md\n\n- Dan prefers using the Obsidian Second Brain...\n- UK is currently in BST (UTC+1).\n- French Open tickets secured for 2026.');
    }, 1500);
  }, []);

  const handleSave = () => {
    console.log('Saving to bridge...', content);
    setIsDirty(false);
    setLastSaved(new Date().toLocaleTimeString());
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 h-full overflow-hidden">
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              MEMORY.md
              {isDirty && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Global Workspace</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {lastSaved && (
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <Clock className="w-3 h-3" />
              Saved at {lastSaved}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg",
              isDirty 
                ? "bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-500" 
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
            )}
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 border-r border-slate-800 p-0 overflow-hidden flex flex-col">
           <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setIsDirty(true);
            }}
            className="flex-1 bg-transparent p-8 text-slate-300 font-mono text-sm leading-relaxed outline-none resize-none selection:bg-indigo-500/30"
            spellCheck="false"
          />
        </div>

        {/* Preview Panel (Side-car) */}
        <div className="w-80 bg-slate-900/20 p-6 space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">Structure</h3>
            <div className="space-y-2">
               {['Timezone Protocol', 'WhatsApp Rules', 'Preferences'].map(h => (
                 <div key={h} className="flex items-center gap-2 text-xs text-slate-400 hover:text-indigo-400 cursor-pointer transition-colors group">
                   <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-indigo-500" />
                   {h}
                 </div>
               ))}
            </div>
          </div>
          
          <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
            <h4 className="text-xs font-semibold text-indigo-300 mb-2">Bridge Tip</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Changes are sent as encrypted diffs to your local gateway and applied immediately to the workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

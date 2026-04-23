import { useState, useEffect, useCallback } from 'react';
import { Save, FileText, Clock, ChevronRight, Folder, File, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useRelay } from '../hooks/useRelay';

export default function MemoryEditor() {
  const { status, gateways, sharedSecret, messages, sendEncrypted } = useRelay();
  const [content, setContent] = useState('# Memory Editor\n\n- Connect a bridge to begin syncing...');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [structure, setStructure] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch structure once E2EE is ready
  useEffect(() => {
    if (sharedSecret && gateways.length > 0) {
      sendEncrypted({ action: 'get_structure' });
    }
  }, [sharedSecret, gateways.length, sendEncrypted]);

  // 2. Handle incoming messages from the bridge
  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMsg = messages[messages.length - 1];
    
    switch (lastMsg.type) {
      case 'memory_structure':
        setStructure(lastMsg.data);
        // Auto-select MEMORY.md if it exists and nothing is selected
        if (!selectedFile) {
          const hasMemoryMd = lastMsg.data.some(f => f.name === 'MEMORY.md');
          if (hasMemoryMd) setSelectedFile('MEMORY.md');
        }
        break;
      
      case 'memory_content':
        if (lastMsg.path === selectedFile) {
          setContent(lastMsg.content);
          setIsDirty(false);
          setIsLoading(false);
        }
        break;

      case 'memory_write_success':
        if (lastMsg.path === selectedFile) {
          setLastSaved(new Date().toLocaleTimeString());
          setIsDirty(false);
        }
        break;
    }
  }, [messages, selectedFile]);

  // 3. Fetch file content when selection changes
  useEffect(() => {
    if (selectedFile && sharedSecret) {
      setIsLoading(true);
      sendEncrypted({ action: 'read_file', path: selectedFile });
    }
  }, [selectedFile, sharedSecret, sendEncrypted]);

  const handleSave = () => {
    if (!selectedFile || !sharedSecret || !isDirty) return;
    sendEncrypted({ 
      action: 'write_file', 
      path: selectedFile, 
      content: content 
    });
  };

  const renderStructure = (items) => {
    return items.map(item => (
      <div key={item.path} className="space-y-1">
        <div 
          onClick={() => item.type === 'file' && setSelectedFile(item.path)}
          className={clsx(
            "flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg cursor-pointer transition-colors group",
            selectedFile === item.path ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-slate-400 hover:text-slate-200"
          )}
        >
          {item.type === 'directory' ? <Folder className="w-3.5 h-3.5 text-slate-500" /> : <File className="w-3.5 h-3.5 text-slate-500" />}
          <span className="truncate">{item.name}</span>
        </div>
        {item.children && item.children.length > 0 && (
          <div className="pl-4 border-l border-slate-800/50 ml-3.5 mt-1 mb-1">
            {renderStructure(item.children)}
          </div>
        )}
      </div>
    ));
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
              {selectedFile || 'Select a file'}
              {isDirty && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
              {sharedSecret ? 'Secure E2EE Tunnel' : 'Waiting for Handshake...'}
            </p>
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
            disabled={!isDirty || !sharedSecret}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg",
              isDirty && sharedSecret
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
        <div className="flex-1 border-r border-slate-800 p-0 overflow-hidden flex flex-col relative">
           {isLoading && (
             <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
             </div>
           )}
           <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setIsDirty(true);
            }}
            readOnly={!selectedFile || !sharedSecret}
            className="flex-1 bg-transparent p-8 text-slate-300 font-mono text-sm leading-relaxed outline-none resize-none selection:bg-indigo-500/30"
            spellCheck="false"
          />
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-slate-900/20 p-6 space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">Workspace Structure</h3>
            <div className="space-y-1">
               {structure.length > 0 ? renderStructure(structure) : (
                 <p className="text-xs text-slate-600 italic">No files found or bridge disconnected.</p>
               )}
            </div>
          </div>
          
          <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
            <h4 className="text-xs font-semibold text-indigo-300 mb-2">Bridge Status</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              {sharedSecret 
                ? `Syncing with ${gateways[0]?.id || 'local gateway'}.` 
                : 'Connecting to global relay network...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Terminal, Shield, AlertTriangle, Cpu, Activity, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { useRelay } from '../hooks/useRelay';

export default function LogViewer() {
  const { status, sharedSecret, messages, sendEncrypted } = useRelay();
  const [logs, setLogs] = useState([
    { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Relay Log Viewer initialized.' },
    { timestamp: new Date().toLocaleTimeString(), level: 'warn', message: 'E2EE handshake pending...' }
  ]);

  useEffect(() => {
    if (sharedSecret) {
      sendEncrypted({ action: 'start_logs' });
    }
  }, [sharedSecret, sendEncrypted]);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.type === 'log_entry') {
      setLogs(prev => [...prev.slice(-100), {
        timestamp: new Date().toLocaleTimeString(),
        level: lastMsg.level || 'info',
        message: lastMsg.message
      }]);
    }
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col bg-slate-950 h-full overflow-hidden">
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              System Logs
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Real-time Stream</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-1 bg-slate-950">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-4 group hover:bg-white/5 py-0.5 px-2 rounded transition-colors">
            <span className="text-slate-600 shrink-0">{log.timestamp}</span>
            <span className={clsx(
              "font-bold uppercase tracking-tighter shrink-0 w-12",
              log.level === 'info' ? "text-blue-400" : (log.level === 'warn' ? "text-amber-500" : "text-red-500")
            )}>
              [{log.level}]
            </span>
            <span className="text-slate-300 break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

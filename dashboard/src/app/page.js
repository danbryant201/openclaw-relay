'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Terminal, Send, Settings, User, Layout, MessageSquare, Shield, Activity, Plus, QrCode, Menu, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import MemoryEditor from './components/MemoryEditor';
import LogViewer from './components/LogViewer';
import { useRelay } from './hooks/useRelay';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const { status: relayStatus, gateways, lastError, messages, sendEncrypted, send, sharedSecret } = useRelay();
  const [view, setView] = useState('chat'); // chat, memory, logs
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [input, setInput] = useState('');
  
  const activeGateway = useMemo(() => (gateways && gateways[0]) || { id: 'searching...', status: 'offline' }, [gateways]);
  const gatewayId = activeGateway.id;
  const status = relayStatus === 'connected' && activeGateway.status === 'online' ? 'connected' : relayStatus;
  
  const [showPairing, setShowPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState('Generating...');
  const [isPairingActive, setIsPairingActive] = useState(false);

  useEffect(() => {
    if (sharedSecret && relayStatus === 'connected') {
      console.log('[Dashboard] E2EE Tunnel ready, fetching sessions...');
      sendEncrypted({ action: 'list_sessions' });
    }
  }, [sharedSecret, relayStatus, sendEncrypted]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.type === 'pairing_code_generated') {
      setPairingCode(lastMsg.code);
    } else if (lastMsg.type === 'pairing_complete') {
      setShowPairing(false);
      setIsPairingActive(false);
    } else if (lastMsg.type === 'session_list') {
      console.log('[Dashboard] Received session list:', lastMsg.sessions.length);
      const formattedThreads = lastMsg.sessions.map(s => ({
        id: s.threadId,
        name: s.title,
        messages: [],
        updatedAt: s.updatedAt || 0
      })).sort((a, b) => b.updatedAt - a.updatedAt);
      
      setThreads(formattedThreads);
      if (!activeThreadId && formattedThreads.length > 0) {
        setActiveThreadId(formattedThreads[0].id);
      }
    } else if (lastMsg.type === 'command_result') {
      console.log('[Dashboard] Received command result for:', lastMsg.threadId);
      const aiMsg = { 
        role: 'ai', 
        text: lastMsg.output, 
        timestamp: new Date().toLocaleTimeString() 
      };
      setThreads(prev => prev.map(t => {
        if (t.id === lastMsg.threadId) return { ...t, messages: [...t.messages, aiMsg] };
        return t;
      }));
    }
  }, [messages, activeThreadId]);

  const activeThread = useMemo(() => threads.find(t => t.id === activeThreadId), [threads, activeThreadId]);

  const sendMessage = async (e) => {
    console.log('[Dashboard] sendMessage attempt');
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!input.trim()) return;
    if (!activeThreadId) {
      console.warn('[Dashboard] No active thread selected, message dropped.');
      return;
    }

    const currentInput = input;
    const currentThreadId = activeThreadId;

    const userMsg = { role: 'user', text: currentInput, timestamp: new Date().toLocaleTimeString() };
    setThreads(prev => prev.map(t => {
      if (t.id === currentThreadId) return { ...t, messages: [...t.messages, userMsg] };
      return t;
    }));
    
    setInput('');

    console.log('[Dashboard] Dispatching encrypted command...');
    try {
      await sendEncrypted({
        action: 'send_command',
        threadId: currentThreadId,
        text: currentInput
      });
      console.log('[Dashboard] Dispatch complete.');
    } catch (err) {
      console.error('[Dashboard] Dispatch failed:', err);
    }
  };

  useEffect(() => {
      if (showPairing && !isPairingActive && relayStatus === 'connected') {
          send({ type: 'generate_pairing_code' });
          setIsPairingActive(true);
      }
  }, [showPairing, isPairingActive, relayStatus, send]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 border-r border-slate-800 flex flex-col bg-slate-900/50 backdrop-blur-xl z-50 transition-transform duration-300 lg:relative lg:translate-x-0 lg:w-64",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 cursor-pointer" onClick={() => { setView('chat'); setIsSidebarOpen(false); }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent cursor-pointer" onClick={() => { setView('chat'); setIsSidebarOpen(false); }}>OpenClaw</span>
          </div>
          <button className="lg:hidden p-2 text-slate-500" onClick={() => setIsSidebarOpen(false)}><X className="w-5 h-5" /></button>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Threads</div>
            <button onClick={() => { setShowPairing(true); setView('chat'); setIsSidebarOpen(false); }} className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-indigo-400" title="Pair New Device">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {threads && threads.map(thread => (
            <button
              key={thread.id}
              onClick={() => { setActiveThreadId(thread.id); setView('chat'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-left",
                activeThreadId === thread.id && view === 'chat' ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
              )}
            >
              <MessageSquare className={cn("w-4 h-4 shrink-0", activeThreadId === thread.id && view === 'chat' ? "text-indigo-400" : "text-slate-500")} />
              <span className="text-sm font-medium truncate">{thread.name}</span>
            </button>
          ))}
          
          <div className="pt-6 text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">System</div>
          <button 
            onClick={() => { setView('memory'); setShowPairing(false); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
              view === 'memory' ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20" : "text-slate-400 hover:bg-slate-800"
            )}
          >
            <Layout className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">Memory Editor</span>
          </button>
          <button 
            onClick={() => { setView('logs'); setShowPairing(false); setIsSidebarOpen(false); }}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                view === 'logs' ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20" : "text-slate-400 hover:bg-slate-800"
            )}
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">Logs</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                <User className="w-5 h-5 text-slate-400" />
              </div>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900",
                status === 'connected' ? "bg-emerald-500" : (status === 'connecting' ? "bg-amber-500" : "bg-red-500")
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Dan Bryant</p>
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-tighter">{gatewayId}</p>
            </div>
            <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><Settings className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-950 relative min-w-0">
        {view === 'memory' ? <MemoryEditor /> : view === 'logs' ? <LogViewer /> : showPairing ? (
          <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.05)_0%,transparent_70%)]">
            <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-50" />
              <button onClick={() => { setShowPairing(false); setIsPairingActive(false); }} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              <div className="text-center space-y-6">
                <div className="inline-flex p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-2"><QrCode className="w-8 h-8 text-indigo-400" /></div>
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Pair New Gateway</h3>
                  <p className="text-slate-400 text-sm mt-2">Enter this code on your local OpenClaw instance or scan with the mobile companion.</p>
                </div>
                <div className="bg-white p-3 rounded-2xl inline-block shadow-inner">
                  <QRCodeSVG 
                    value={`openclaw:pair?code=${pairingCode.replace(' ', '')}&relay=ca-relay-uogm7gtzixdzo.ashyocean-9489ea26.ukwest.azurecontainerapps.io`}
                    size={160} level={"H"} includeMargin={false}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Pairing Code</div>
                  <div className="text-4xl font-mono font-bold text-indigo-400 tracking-widest bg-slate-950 py-3 rounded-xl border border-slate-800/50">{pairingCode}</div>
                </div>
                <div className="pt-4 flex flex-col gap-2">
                  <div className="text-xs text-slate-500 font-mono italic">Waiting for bridge connection...</div>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-1/3 animate-[shimmer_2s_infinite_linear]" style={{backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)'}} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 sm:px-8 bg-slate-950/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <button className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white" onClick={() => setIsSidebarOpen(true)}><Menu className="w-5 h-5" /></button>
                <h2 className="font-semibold text-slate-100 truncate max-w-[150px] sm:max-w-none">{activeThread?.name || 'OpenClaw Chat'}</h2>
                <div className="hidden sm:block px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-slate-400 uppercase tracking-widest border border-slate-700">E2EE</div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500">
                   <div className={cn("w-1.5 h-1.5 rounded-full", status === 'connected' ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                   <span className="hidden xs:inline">Relay Status:</span> {status.toUpperCase()}
                 </div>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
              {(!activeThread || !activeThread.messages || activeThread.messages.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800"><Terminal className="w-8 h-8 text-indigo-500" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100 tracking-tight">{status === 'connected' ? 'Bridge Active' : 'Waiting for Bridge'}</h3>
                    <p className="text-slate-400 text-sm mt-1">{status === 'connected' ? `Secure tunnel established to ${gatewayId}.` : relayStatus === 'connected' ? 'Relay live. Waiting for gateway to check in...' : 'Connecting to global relay network...'}</p>
                    {lastError && <p className="text-red-500 text-[10px] mt-2 font-mono uppercase tracking-tighter">{lastError}</p>}
                  </div>
                </div>
              ) : (
                activeThread.messages.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col max-w-[85%] sm:max-w-2xl", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
                    <div className={cn("px-4 py-2.5 rounded-2xl text-sm shadow-sm", msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none")}>{msg.text}</div>
                    <span className="text-[10px] text-slate-600 mt-1.5 font-mono uppercase tracking-tighter">{msg.timestamp}</span>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 sm:p-8 pt-0">
              <form 
                onSubmit={(e) => {
                  console.log('[Dashboard] Form submit');
                  sendMessage(e);
                }}
                className="relative max-w-4xl mx-auto"
              >
                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      console.log('[Dashboard] Enter key down');
                      sendMessage(e);
                    }
                  }}
                  placeholder="Send command..." 
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none rounded-2xl px-5 sm:px-6 py-3 sm:py-4 pr-14 sm:pr-16 text-sm transition-all placeholder:text-slate-600 backdrop-blur-xl" 
                />
                <button 
                  type="button" 
                  onClick={(e) => {
                    console.log('[Dashboard] Button click');
                    sendMessage(e);
                  }}
                  disabled={!input.trim() || status !== 'connected'} 
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </form>
              <p className="text-center text-[9px] text-slate-600 mt-4 uppercase tracking-[0.2em] font-medium">V1.1.0 Alpha &bull; Encrypted Relay &bull; {activeThreadId ? 'Live' : 'No Thread'}</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

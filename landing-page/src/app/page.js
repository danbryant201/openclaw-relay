import React from 'react';
import { Shield, Lock, Zap, Cpu, ArrowRight, Download, Terminal, MessageSquare, Globe, ChevronRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 selection:text-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">OpenClaw</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#security" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Security</a>
            <a href="https://docs.openclaw.ai" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Docs</a>
          </div>

          <button className="px-5 py-2.5 bg-white text-slate-950 rounded-full text-sm font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-xl shadow-white/5">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-6xl pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-40 right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">
              <Zap className="w-3 h-3 fill-current" />
              Now in Alpha
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-8">
              Your AI Assistant,<br />
              <span className="text-slate-500">Without the VPN.</span>
            </h1>
            <p className="text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl">
              OpenClaw Global Relay creates a secure, end-to-end encrypted bridge to your private local gateway. No port forwarding, no complex VPNs, just pure AI power from any browser.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/30">
                Launch Dashboard
                <Globe className="w-5 h-5" />
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-slate-900 border border-slate-800 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
                <Download className="w-5 h-5" />
                Download Bridge
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/20 transition-all group">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Lock className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Zero-Knowledge</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Traffic is encrypted on your local machine and decrypted in your browser. Our relay servers see only noise.
              </p>
            </div>
            
            <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/20 transition-all group">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Multi-Threaded</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Unlike mobile apps, our web dashboard supports multiple concurrent conversations and sub-agent monitoring.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/20 transition-all group">
              <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Terminal className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Local-First</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your data stays in your workspace. The relay is just a pipe, ensuring privacy remains your default state.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Section */}
      <section className="py-24 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-slate-950 border border-white/5 rounded-[40px] overflow-hidden flex flex-col lg:flex-row items-stretch">
            <div className="flex-1 p-12 lg:p-20">
              <h2 className="text-4xl font-bold text-white mb-6 tracking-tight">The Bridge Client</h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Run our lightweight Node.js bridge on your NucBox, Raspberry Pi, or local server. It initiates an outbound connection to the relay—no inbound ports required.
              </p>
              <div className="space-y-4">
                {[
                  'Secure Noise_XX Handshake',
                  'Auto-reconnect with Backoff',
                  'Native Ed25519 Identity',
                  'Low CPU/RAM Footprint'
                ].map(item => (
                  <div key={item} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                    <div className="w-5 h-5 bg-indigo-500/10 rounded-full flex items-center justify-center">
                      <ChevronRight className="w-3 h-3 text-indigo-400" />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:w-1/2 bg-slate-900 p-8 lg:p-12 font-mono text-sm relative overflow-hidden">
               {/* Mock Code */}
               <div className="space-y-4 text-indigo-300/80">
                 <div className="flex gap-4">
                   <span className="text-slate-600">01</span>
                   <span>const bridge = new OpenClawBridge(&#123;</span>
                 </div>
                 <div className="flex gap-4">
                   <span className="text-slate-600">02</span>
                   <span className="ml-4">relay: 'relay.openclaw.io',</span>
                 </div>
                 <div className="flex gap-4">
                   <span className="text-slate-600">03</span>
                   <span className="ml-4 text-emerald-400">id: 'hal-nuc-01'</span>
                 </div>
                 <div className="flex gap-4">
                   <span className="text-slate-600">04</span>
                   <span>&#125;);</span>
                 </div>
                 <div className="flex gap-4 pt-4">
                   <span className="text-slate-600">05</span>
                   <span className="text-purple-400">await bridge.connect();</span>
                 </div>
                 <div className="flex gap-4">
                   <span className="text-slate-600">06</span>
                   <span className="text-slate-400">// Bridge Active &bull; AES-GCM Encrypted</span>
                 </div>
               </div>

               <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
             <Shield className="w-6 h-6 text-slate-500" />
             <span className="text-slate-500 font-bold">OpenClaw Relay</span>
          </div>
          <p className="text-slate-600 text-sm font-medium">
            &copy; 2026 Dan Bryant. Open Source & Privacy First.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-slate-500 hover:text-white transition-colors text-sm">Twitter</a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors text-sm">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

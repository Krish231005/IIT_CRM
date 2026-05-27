import { useState, useEffect, useRef } from 'react';
import { Transaction, Anomaly } from '../types.js';
import { biApi } from '../lib/api.ts';
import { Radio, Play, Pause, AlertOctagon, TrendingUp, ShieldCheck, ShoppingCart } from 'lucide-react';

export function RealTimeOperations() {
  const [liveTxns, setLiveTxns] = useState<Transaction[]>([]);
  const [activeAnomalies, setActiveAnomalies] = useState<Anomaly[]>([]);
  const [isTicking, setIsTicking] = useState(false);
  const [recentFlash, setRecentFlash] = useState(false);
  
  // Timer Ref
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    fetchInitialAnomalies();
    return () => stopTicker();
  }, []);

  const fetchInitialAnomalies = async () => {
    try {
      const list = await biApi.getAnomalies();
      setActiveAnomalies(list);
    } catch (err) {
      console.error(err);
    }
  };

  const stopTicker = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTicking(false);
  };

  const startTicker = () => {
    if (intervalRef.current) return;
    setIsTicking(true);
    // Mimic rapid sequenced transactions - tick every 3.5 seconds
    intervalRef.current = setInterval(() => {
      triggerSingleTick();
    }, 3500);
  };

  const triggerSingleTick = async () => {
    setRecentFlash(true);
    setTimeout(() => setRecentFlash(false), 900);

    try {
      const result = await biApi.triggerLiveTick();
      // Unshift to place latest first
      setLiveTxns(prev => [result.transaction, ...prev].slice(0, 15));
      if (result.anomaly) {
        setActiveAnomalies(prev => [result.anomaly!, ...prev].slice(0, 15));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTicker = () => {
    if (isTicking) {
      stopTicker();
    } else {
      startTicker();
    }
  };

  const resolveAnomalyId = async (id: string) => {
    try {
      const updated = await biApi.resolveAnomaly(id, 'Resolved');
      setActiveAnomalies(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="realtime-operations-panel" className="space-y-6">
      {/* Real-time Ticker control section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-[#1E293B] border border-slate-700/50 rounded-xl gap-4">
        <div>
          <h2 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 font-display uppercase font-mono">
            <Radio className={`w-4 h-4 text-cyan-400 ${isTicking ? 'animate-pulse' : ''}`} />
            Live High-Frequency Transaction Ticker
          </h2>
          <p className="text-xs text-slate-400">Streamed checkout simulations matching active logistics models.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Simulation Toggle Action */}
          <button
            onClick={toggleTicker}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold active:translate-y-0.5 transition cursor-pointer font-mono uppercase ${
              isTicking 
                ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20' 
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {isTicking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isTicking ? 'Stop Ticking Stream' : 'Deploy Real-Time Stream'}
          </button>

          {/* Trigger single manual checkout */}
          <button
            onClick={triggerSingleTick}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-250 text-xs font-bold rounded-lg hover:border-slate-650 active:translate-y-0.5 transition cursor-pointer font-mono uppercase"
            title="Inject single transaction"
          >
            Manual Checkout Tick
          </button>
        </div>
      </div>

      {/* Main Real time output columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Logs Ledger Stream */}
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl flex flex-col justify-between min-h-[400px]">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-tight flex items-center gap-1.5">
              <ShoppingCart className="w-4.5 h-4.5 text-cyan-400" />
              Interactive Audit Log ledger stream
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 uppercase tracking-wider font-mono">Real-time checkout simulation feed</p>
          </div>

          <div className="space-y-2 mt-2 max-h-[340px] overflow-y-auto pr-1">
            {liveTxns.length === 0 ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center justify-center my-auto h-64 font-mono">
                <Radio className="w-8 h-8 text-slate-700 mb-2 stroke-1" />
                <p className="text-xs">Stream simulator is dormant.</p>
                <span className="text-[10px] text-slate-600 mt-1 max-w-[210px] uppercase font-mono">Deploy stream to observe realtime events</span>
              </div>
            ) : (
              liveTxns.map((txn, idx) => {
                const isFlash = idx === 0 && recentFlash;
                return (
                  <div
                    key={txn.id}
                    className={`flex items-center justify-between p-2 rounded-lg border border-slate-850/80 transition-all duration-300 ${
                      isFlash ? 'bg-cyan-500/10 border-cyan-400 glow-cyan scale-[1.01]' : 'bg-[#0B1120]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-200">Tx ID: {txn.id.slice(-8)}</span>
                        <span className="text-[9px] bg-slate-800 text-slate-300 border border-slate-700 py-0.25 px-1 rounded font-mono font-bold">Approved</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                        <span className="font-semibold text-slate-450">Qty: {txn.quantity}</span>
                        <span>•</span>
                        <span>Store: {txn.storeId}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-white">+₹{txn.totalPrice.toLocaleString()}</span>
                      <span className="text-[9px] text-slate-500 block">{new Date(txn.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Real-time Logistics & Transactional Anomalies Column */}
        <div className="bg-[#1E293B] border border-slate-705 p-4 rounded-xl flex flex-col justify-between min-h-[400px]">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-tight flex items-center gap-1.5">
              <AlertOctagon className="w-4.5 h-4.5 text-rose-400 animate-pulse" />
              Logistics & Anomaly Alerts Sentinel
            </h3>
            <p className="text-[11px] text-slate-450 mb-4 uppercase tracking-wider font-mono">Statistical deviation thresholds active</p>
          </div>

          <div className="space-y-3 mt-2 max-h-[340px] overflow-y-auto pr-1">
            {activeAnomalies.length === 0 ? (
              <div className="text-center py-12 text-emerald-400/80 flex flex-col items-center justify-center my-auto h-64 bg-slate-950/20 rounded-xl border border-slate-900">
                <ShieldCheck className="w-12 h-12 text-emerald-500/80 stroke-1 mb-3" />
                <p className="text-xs font-bold uppercase tracking-wider font-display">Logistics System Safe</p>
                <span className="text-[9px] text-slate-500 mt-1 max-w-[210px]">Zero Deviations Detected</span>
              </div>
            ) : (
              activeAnomalies.map((anm) => {
                const isUnresolved = anm.status === 'Unresolved';
                return (
                  <div
                    key={anm.id}
                    className={`p-3 bg-[#0B1120] rounded-lg border transition-all duration-300 flex flex-col justify-between gap-3 ${
                      isUnresolved ? 'border-rose-500/30' : 'border-slate-800/60 relative opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          <span className="text-xs font-bold text-slate-200">{anm.type}</span>
                        </div>

                        <span className={`text-[9px] font-mono font-bold uppercase py-0.5 px-2 rounded ${
                          anm.severity === 'High' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {anm.severity} severity
                        </span>
                      </div>

                      <p className="text-[10.5px] text-slate-400 mt-2 leading-relaxed font-sans">{anm.description}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[9.5px]">
                      <span className="text-slate-500 font-mono">Logged: {new Date(anm.timestamp).toLocaleTimeString()}</span>
                      
                      {isUnresolved ? (
                        <button
                          onClick={() => resolveAnomalyId(anm.id)}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold rounded text-[9px] uppercase tracking-wider cursor-pointer font-mono"
                        >
                          Acknowledge & Resolve
                        </button>
                      ) : (
                        <span className="text-emerald-400 bg-emerald-500/10 py-0.5 px-1.5 border border-emerald-500/10 font-bold rounded text-[9px] uppercase tracking-wider font-mono">Resolved</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

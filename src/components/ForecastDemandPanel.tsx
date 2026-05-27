import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { ForecastPoint } from '../types.js';
import { biApi } from '../lib/api.ts';
import { Sparkles, Brain, ArrowRight, Hourglass, RefreshCw, AlertCircle } from 'lucide-react';

// Light custom Markdown renderer for corporate reports
function ElegantReportRenderer({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div className="space-y-3 text-xs leading-relaxed text-slate-300">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        // Headers
        if (trimmed.startsWith('###')) {
          return <h4 key={idx} className="text-sm font-bold text-white tracking-tight mt-4 pt-2 border-b border-slate-800/60 pb-1">{trimmed.replace('###', '').trim()}</h4>;
        }
        if (trimmed.startsWith('##')) {
          return <h3 key={idx} className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 mt-5">{trimmed.replace('##', '').trim()}</h3>;
        }
        if (trimmed.startsWith('#')) {
          return <h2 key={idx} className="text-lg font-bold text-white tracking-tight leading-none mt-6">{trimmed.replace('#', '').trim()}</h2>;
        }

        // Bullet points
        if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
          // Check for bold in list items
          const content = trimmed.slice(1).trim();
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-cyan-400 mt-1.5 w-1 h-1 rounded-full shrink-0" />
              <span>{renderFormattedText(content)}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-indigo-400 font-mono font-bold">{numMatch[1]}.</span>
              <span>{renderFormattedText(numMatch[2])}</span>
            </div>
          );
        }

        // Standard Paragraphs
        return <p key={idx}>{renderFormattedText(trimmed)}</p>;
      })}
    </div>
  );
}

// Inline Bold formatting parser
function renderFormattedText(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part));
}

export function ForecastDemandPanel() {
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [loadingForecast, setLoadingForecast] = useState(false);

  // AI Assistant States
  const [query, setQuery] = useState('');
  const [aiReport, setAiReport] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [currentPromptLabel, setCurrentPromptLabel] = useState('Daily Executive KPI Briefing');

  useEffect(() => {
    fetchForecast();
    // Default initial report seed on load
    runPresetReport('daily-kpi', 'Daily Operational KPI Briefing');
  }, []);

  const fetchForecast = async () => {
    setLoadingForecast(true);
    try {
      const data = await biApi.getForecast();
      setForecast(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingForecast(false);
    }
  };

  const handleFreeformSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoadingAI(true);
    setCurrentPromptLabel(`NLI Chat Command: "${query}"`);
    try {
      const answer = await biApi.queryAI(query);
      setAiReport(answer);
      setQuery('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };

  const runPresetReport = async (type: string, label: string) => {
    setLoadingAI(true);
    setCurrentPromptLabel(label);
    try {
      const report = await biApi.getAIPresetReport(type);
      setAiReport(report);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };

  // Recharts Helper: filter historical dates and forecasts
  const chartData = forecast.map(f => ({
    name: f.date,
    actual: f.actual !== undefined ? f.actual : null,
    forecast: f.forecast,
    lower: f.lowerConfidence,
    upper: f.upperConfidence
  }));

  return (
    <div id="demand-forecast-section" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Core Double Exponential / Prophet Style Forecasting Visualisation */}
        <div className="lg:col-span-3 bg-[#111827] border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-xs uppercase tracking-tight flex items-center gap-2">
                  <Brain className="w-4.5 h-4.5 text-cyan-400" />
                  Seasonal Sales Demand Projection
                </h3>
                <p className="text-xs text-slate-400">Triple smoothing Holt-Winters modeling projecting next 6 weeks.</p>
              </div>

              <button
                onClick={fetchForecast}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
                title="Recalculate Model"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingForecast ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="h-72 mt-6">
              {loadingForecast ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-500 font-mono">Running regression estimates...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="forecastInterval" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.03}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `₹${v/1000}k`} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                      formatter={(val: number | null, name: string) => {
                        if (val === null) return null;
                        if (name === 'lower' || name === 'upper') return [`₹${Math.round(val).toLocaleString()}`, name === 'lower' ? '95% Bottom Confidence' : '95% Top Confidence'];
                        if (name === 'actual') return [`₹${Math.round(val).toLocaleString()}`, 'Log Sales'];
                        return [`₹${Math.round(val).toLocaleString()}`, 'Predicted Demand'];
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    {/* Confidence bound Area (Shaded area representing margins) */}
                    <Area type="monotone" dataKey="upper" stroke="none" fill="url(#forecastInterval)" />
                    <Area type="monotone" dataKey="lower" stroke="none" fill="url(#forecastInterval)" />

                    {/* Historical actual sales line */}
                    <Line type="monotone" dataKey="actual" name="Historical actual" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />

                    {/* Forecast prediction line */}
                    <Line type="monotone" dataKey="forecast" name="Projected Demand" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="3 3" dot={{ r: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/60 mt-4 flex items-center justify-between text-[10px] text-slate-500">
            <span>Forecast Model: Holt-Winters Smoothing Model</span>
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
              Interval coverage: Alpha=0.4, Beta=0.25
            </span>
          </div>
        </div>

        {/* Gemini BI Insights Deck (Col Span 2) */}
        <div className="lg:col-span-2 bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white text-xs uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Gemini Operational Advising Desk
              </h3>
              <span className="text-[10px] font-mono py-0.5 px-2 bg-slate-800 border border-slate-700 font-semibold uppercase text-slate-300 rounded font-bold">API ACTIVE</span>
            </div>
            <p className="text-xs text-slate-400 pb-3 border-b border-slate-750/80">
              Corporate analysis cross-referencing catalog counts, customer segments and active anomalies.
            </p>

            {/* Strategy Preset Selectors */}
            <div className="flex flex-wrap gap-1.5 py-3">
              {[
                { type: 'daily-kpi', label: 'KPI brief', desc: 'Daily operational outline.' },
                { type: 'inventory-opt', label: 'Restructure Suggestions', desc: 'Catalog supply recommendations.' },
                { type: 'churn-prevention', label: 'Win-back strategy', desc: 'Incentivize churn candidates.' },
                { type: 'forecast-analysis', label: 'Trend overview', desc: 'Outline structural projections.' }
              ].map((b) => (
                <button
                  key={b.type}
                  onClick={() => runPresetReport(b.type, b.desc)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 rounded text-[10px] font-bold text-slate-200 active:translate-y-0.5 transition cursor-pointer font-mono uppercase"
                >
                  {b.label}
                </button>
              ))}
            </div>

            {/* Generated Report Frame */}
            <div className="mt-2 bg-[#0B1120] border border-slate-800/80 rounded-lg p-3 min-h-[190px] max-h-[240px] overflow-y-auto relative">
              {loadingAI ? (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex flex-col items-center justify-center text-slate-500 text-xs">
                  <Hourglass className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
                  <span>Configuring AI operational plan...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-bold uppercase tracking-wider font-mono">
                    <Sparkles className="w-3 h-3" />
                    {currentPromptLabel}
                  </div>
                  <ElegantReportRenderer text={aiReport} />
                </div>
              )}
            </div>
          </div>

          {/* Natural Language Prompt Query Line */}
          <form onSubmit={handleFreeformSearch} className="mt-4 flex items-center gap-2 border-t border-slate-755/60 pt-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask Gemini about active business health..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
            />
            <button
              type="submit"
              disabled={loadingAI}
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-45 cursor-pointer flex items-center justify-center shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { ForecastPoint } from '../types.js';
import { biApi } from '../lib/api.ts';
import { Sparkles, Brain, ArrowRight, Hourglass, RefreshCw, AlertCircle, TrendingUp, ShoppingBag, Award, Users, BarChart as BarChartIcon, Layers, FileSpreadsheet } from 'lucide-react';

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

interface ForecastDemandPanelProps {
  currentUserRole?: string;
}

export function ForecastDemandPanel({ currentUserRole }: ForecastDemandPanelProps = {}) {
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [loadingForecast, setLoadingForecast] = useState(false);

  // Corporate backup state for Analyst view
  const [backupData, setBackupData] = useState<any>(null);
  const [loadingBackup, setLoadingBackup] = useState(false);

  // AI Assistant States
  const [query, setQuery] = useState('');
  const [aiReport, setAiReport] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [currentPromptLabel, setCurrentPromptLabel] = useState('Daily Executive KPI Briefing');

  const fetchBackupData = async () => {
    setLoadingBackup(true);
    try {
      const data = await biApi.exportFullDatabase();
      setBackupData(data);
    } catch (err) {
      console.error('Failed to load corporate backup for intelligence graphs:', err);
    } finally {
      setLoadingBackup(false);
    }
  };

  useEffect(() => {
    fetchForecast();
    // Default initial report seed on load
    runPresetReport('daily-kpi', 'Daily Operational KPI Briefing');
    if (currentUserRole === 'Analyst') {
      fetchBackupData();
    }
  }, [currentUserRole]);

  const fetchForecast = async () => {
    setLoadingForecast(true);
    try {
      const data = await biApi.getForecast();
      setForecast(data);
      if (currentUserRole === 'Analyst') {
        fetchBackupData();
      }
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

  // Dynamic calculations for Analyst Dashboard
  const analystMetrics = React.useMemo(() => {
    if (!backupData) return null;

    const { products = [], customers = [], transactions = [] } = backupData;

    // 1. Total Revenue
    const totalRevenue = transactions.reduce((sum: number, t: any) => sum + (t.totalPrice || 0), 0);

    // 2. Total Sales
    const totalSales = transactions.length;

    // 3. Best Selling Product (by units sold)
    const productMetrics: Record<string, { name: string; quantity: number; revenue: number }> = {};
    transactions.forEach((t: any) => {
      if (!productMetrics[t.productId]) {
        const prod = products.find((p: any) => p.id === t.productId);
        productMetrics[t.productId] = { name: prod?.name || 'Unknown Item', quantity: 0, revenue: 0 };
      }
      productMetrics[t.productId].quantity += (t.quantity || 0);
      productMetrics[t.productId].revenue += (t.totalPrice || 0);
    });

    const productsList = Object.values(productMetrics);
    const bestSellingProduct = productsList.sort((a, b) => b.quantity - a.quantity)[0]?.name || 'N/A';

    // 4. Top Customer
    const customerSpend: Record<string, { name: string; email: string; total: number }> = {};
    transactions.forEach((t: any) => {
      if (!customerSpend[t.customerId]) {
         const cust = customers.find((c: any) => c.id === t.customerId);
         customerSpend[t.customerId] = { name: cust?.name || 'Unknown Client', email: cust?.email || '', total: 0 };
      }
      customerSpend[t.customerId].total += (t.totalPrice || 0);
    });

    const customersList = Object.values(customerSpend);
    const topCustomer = customersList.sort((a, b) => b.total - a.total)[0]?.name || 'N/A';

    // Top Selling Products (Bar Chart, top 5)
    const topProductsChart = productsList
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(p => ({
        name: p.name.length > 20 ? p.name.substring(0, 18) + '...' : p.name,
        Revenue: Math.round(p.revenue),
        Quantity: p.quantity
      }));

    // Monthly Sales Trend / Demand Forecast (Line Chart)
    const monthsName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySales: Record<string, { label: string; offset: number; Revenue: number; Transactions: number }> = {};
    
    transactions.forEach((t: any) => {
      const date = new Date(t.timestamp);
      const mIdx = date.getMonth();
      const yr = date.getFullYear();
      const k = `${yr}-${mIdx}`;
      if (!monthlySales[k]) {
        monthlySales[k] = {
          label: `${monthsName[mIdx]} ${yr}`,
          offset: yr * 12 + mIdx,
          Revenue: 0,
          Transactions: 0
        };
      }
      monthlySales[k].Revenue += (t.totalPrice || 0);
      monthlySales[k].Transactions += 1;
    });

    const monthlyTrendChart = Object.values(monthlySales)
      .sort((a, b) => a.offset - b.offset)
      .map(m => ({
        name: m.label,
        Revenue: Math.round(m.Revenue),
        Sales: m.Transactions
      }));

    // Best Customers by Purchase Value (Horizontal Bar Chart)
    const topCustomersChart = customersList
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(c => ({
        name: c.name.length > 15 ? c.name.substring(0, 13) + '...' : c.name,
        Spend: Math.round(c.total)
      }));

    // Category Distribution / share
    const categoryShare: Record<string, { category: string; value: number }> = {};
    transactions.forEach((t: any) => {
      const prod = products.find((p: any) => p.id === t.productId);
      if (prod) {
        if (!categoryShare[prod.category]) {
          categoryShare[prod.category] = { category: prod.category, value: 0 };
        }
        categoryShare[prod.category].value += (t.totalPrice || 0);
      }
    });

    const categoryShareChart = Object.values(categoryShare).map(cat => ({
      name: cat.category,
      value: Math.round(cat.value)
    }));

    return {
      totalRevenue,
      totalSales,
      bestSellingProduct,
      topCustomer,
      topProductsChart,
      monthlyTrendChart,
      topCustomersChart,
      categoryShareChart
    };
  }, [backupData]);

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

      {/* Analyst BI intelligence area */}
      {currentUserRole === 'Analyst' && (
        <div className="border-t border-slate-800/80 pt-6 mt-6 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 font-mono">
                <BarChartIcon className="w-5 h-5 text-indigo-400" />
                Analyst Insight & Intelligence Hub
              </h2>
              <p className="text-xs text-slate-400">
                High-fidelity role-restricted analytics pipelines synced over CRM, inventory levels and active checkouts.
              </p>
            </div>
            
            {loadingBackup && (
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
                <Hourglass className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                Synchronizing datasets...
              </div>
            )}
          </div>

          {/* Fallback when backupData is not fully loaded */}
          {!analystMetrics ? (
            <div className="bg-[#111827] border border-slate-800 p-8 rounded-xl text-center text-xs text-slate-500 font-mono">
              Querying live database snapshots...
            </div>
          ) : (
            <>
              {/* KPI Cards Row (4 cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Revenue Card */}
                <div className="bg-[#111827]/85 border border-slate-800/85 p-4 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Total Revenue</span>
                    <span className="block text-lg font-bold text-white font-sans tracking-tight mt-1">
                      ₹{Math.round(analystMetrics.totalRevenue).toLocaleString()}
                    </span>
                    <span className="block text-[9px] text-emerald-450 font-mono mt-0.5">● SYNCHRONIZED</span>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 rounded-xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>

                {/* Total Sales Card */}
                <div className="bg-[#111827]/85 border border-slate-800/85 p-4 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Total Sales Transactions</span>
                    <span className="block text-lg font-bold text-white font-sans tracking-tight mt-1">
                      {analystMetrics.totalSales.toLocaleString()} Txns
                    </span>
                    <span className="block text-[9px] text-cyan-450 font-mono mt-0.5">● COMPLETED</span>
                  </div>
                  <div className="p-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/10 rounded-xl">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                </div>

                {/* Best Selling Product SKU */}
                <div className="bg-[#111827]/85 border border-slate-800/85 p-4 rounded-xl flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Top Selling MVP SKU</span>
                    <span className="block text-xs font-bold text-white truncate mt-1.5" title={analystMetrics.bestSellingProduct}>
                      {analystMetrics.bestSellingProduct}
                    </span>
                    <span className="block text-[9px] text-indigo-400 font-mono mt-1">● CATEGORY BEST</span>
                  </div>
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 rounded-xl shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                </div>

                {/* Top Customer Account */}
                <div className="bg-[#111827]/85 border border-slate-800/85 p-4 rounded-xl flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Top Value Champion</span>
                    <span className="block text-xs font-bold text-white truncate mt-1.5" title={analystMetrics.topCustomer}>
                      {analystMetrics.topCustomer}
                    </span>
                    <span className="block text-[9px] text-amber-400 font-mono mt-1">● RETENTION SCORE</span>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/10 rounded-xl shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Charts Grid (2x2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Graph 1: Top Selling Products (Bar Chart) */}
                <div className="bg-[#111827] border border-slate-800/80 p-4 rounded-xl">
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 font-mono">
                      <Layers className="w-4.5 h-4.5 text-indigo-400" />
                      Top Selling Products Revenue
                    </h3>
                    <p className="text-[11px] text-slate-400">Comparison of top 5 trade inventory SKUs based on total currency cashflow.</p>
                  </div>
                  <div className="h-64 font-mono text-[11px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analystMetrics.topProductsChart} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                        <YAxis stroke="#64748b" tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                          formatter={(value: any) => [`₹${(value).toLocaleString()}`, 'Total Revenue']}
                        />
                        <Bar dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]}>
                          {analystMetrics.topProductsChart.map((entry, index) => {
                            const colors = ['#6366f1', '#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Graph 2: Monthly Sales Trend / Demand Forecast (Line Chart) */}
                <div className="bg-[#111827] border border-slate-800/80 p-4 rounded-xl">
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 font-mono">
                      <TrendingUp className="w-4.5 h-4.5 text-cyan-400" />
                      Monthly Sales & Revenue History
                    </h3>
                    <p className="text-[11px] text-slate-400">Sequential aggregated revenue performance mapped across recent months.</p>
                  </div>
                  <div className="h-64 font-mono text-[11px]">
                    {analystMetrics.monthlyTrendChart.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-slate-500 text-xs text-center font-mono">No monthly trend records detected inside snapshot database.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analystMetrics.monthlyTrendChart} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                          <YAxis stroke="#64748b" tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px' }}
                            itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                            formatter={(value: any, name: string) => {
                              return name === 'Revenue' ? [`₹${(value).toLocaleString()}`, 'Revenue'] : [`${value} Sales`, 'Sales Volume'];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Line type="monotone" dataKey="Revenue" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="Sales" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Graph 3: Best Customers by Purchase Value (Horizontal Bar Chart) */}
                <div className="bg-[#111827] border border-slate-800/80 p-4 rounded-xl">
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 font-mono">
                      <Users className="w-4.5 h-4.5 text-emerald-400" />
                      Best Customers by Purchase Value
                    </h3>
                    <p className="text-[11px] text-slate-400">Top cumulative high-spending retail profiles currently in KMeans registry.</p>
                  </div>
                  <div className="h-64 font-mono text-[11px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={analystMetrics.topCustomersChart}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" tickLine={false} width={80} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                          formatter={(value: any) => [`₹${(value).toLocaleString()}`, 'Net Investment']}
                        />
                        <Bar dataKey="Spend" fill="#10b981" radius={[0, 4, 4, 0]}>
                          {analystMetrics.topCustomersChart.map((entry, index) => {
                            const colors = ['#10b981', '#059669', '#34d399', '#6ee7b7', '#a7f3d0'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Graph 4: Category Share (Pie/Donut Grid) */}
                <div className="bg-[#111827] border border-slate-800/80 p-4 rounded-xl">
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 font-mono">
                      <Layers className="w-4.5 h-4.5 text-amber-500" />
                      Product Category Sales Share
                    </h3>
                    <p className="text-[11px] text-slate-400">Vertical categorical breakdown of actual customer purchase revenues.</p>
                  </div>
                  <div className="h-64 font-mono text-[11px] grid grid-cols-1 sm:grid-cols-5 items-center gap-4">
                    <div className="sm:col-span-3 h-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analystMetrics.categoryShareChart}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {analystMetrics.categoryShareChart.map((entry, index) => {
                              const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px' }}
                            itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                            formatter={(value: any) => [`₹${(value).toLocaleString()}`, 'Revenue']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center pointer-events-none">
                        <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Total share</span>
                        <span className="block text-[10px] font-bold text-white">100% Vol</span>
                      </div>
                    </div>

                    <div className="sm:col-span-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {analystMetrics.categoryShareChart.map((item, idx) => {
                        const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
                        return (
                          <div key={`legend-${idx}`} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/40 border border-slate-800/40">
                            <span className="w-2 rounded-full h-2 shrink-0 animate-pulse" style={{ backgroundColor: colors[idx % colors.length] }} />
                            <div className="min-w-0 flex-1 leading-none">
                              <span className="block text-[10px] font-bold text-slate-250 truncate">{item.name}</span>
                              <span className="text-[9px] text-slate-450 font-mono">₹{item.value.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}

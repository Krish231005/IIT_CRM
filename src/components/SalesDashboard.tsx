import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend } from 'recharts';
import { DashboardSummary } from '../types.js';
import { DollarSign, Percent, TrendingUp, ShoppingBag, Eye, MapPin, Layers, ShoppingCart, Users, Play, AlertTriangle } from 'lucide-react';
import { biApi } from '../lib/api.ts';

interface SalesDashboardProps {
  summary: DashboardSummary;
  refreshSummary?: () => void;
}

export function SalesDashboard({ summary, refreshSummary }: SalesDashboardProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [showCheckout, setShowCheckout] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [units, setUnits] = useState<number>(1);
  const [loadingCheckoutData, setLoadingCheckoutData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string>('');

  useEffect(() => {
    if (showCheckout) {
      loadCheckoutData();
    }
  }, [showCheckout]);

  const loadCheckoutData = async () => {
    setLoadingCheckoutData(true);
    setCheckoutError('');
    try {
      const [prodsRes, custsRes, storesRes] = await Promise.all([
        biApi.getProducts('', '', 1, 150),
        biApi.getCustomers('', '', 1),
        biApi.getStores()
      ]);
      setProducts(prodsRes.data || []);
      setCustomers(custsRes.data || []);
      setStores(storesRes || []);
      
      if (prodsRes.data?.length > 0) setSelectedProduct(prodsRes.data[0].id);
      if (custsRes.data?.length > 0) setSelectedCustomer(custsRes.data[0].id);
      if (storesRes?.length > 0) setSelectedStore(storesRes[0].id);
    } catch (err) {
      console.error(err);
      setCheckoutError('Failed to synchronize checkout models.');
    } finally {
      setLoadingCheckoutData(false);
    }
  };

  const activeProductObj = useMemo(() => {
    return products.find(p => p.id === selectedProduct);
  }, [products, selectedProduct]);

  const calculations = useMemo(() => {
    if (!activeProductObj) return null;
    const rev = activeProductObj.price * units;
    const cost = activeProductObj.cost * units;
    const margin = rev - cost;
    const marginPct = rev > 0 ? Math.round((margin / rev) * 100) : 0;
    return { rev, cost, margin, marginPct };
  }, [activeProductObj, units]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    setCheckoutSuccess('');
    
    if (!selectedProduct || !selectedCustomer || !selectedStore || units <= 0) {
      setCheckoutError('Please populate all mandatory trade checkout fields.');
      return;
    }

    const chosenProd = products.find(p => p.id === selectedProduct);
    if (chosenProd && chosenProd.stock < units) {
      setCheckoutError(`Insufficient live stock in fulfillment database. Only ${chosenProd.stock} units remaining.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await biApi.createTransaction({
        productId: selectedProduct,
        customerId: selectedCustomer,
        storeId: selectedStore,
        quantity: units
      });
      setCheckoutSuccess(`Successfully registered trade log checking out ${units} units under physical customer ID ${selectedCustomer}.`);
      setUnits(1);
      if (refreshSummary) {
        refreshSummary();
      }
      loadCheckoutData();
    } catch (err: any) {
      setCheckoutError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const regions = useMemo(() => ['All', ...Object.keys(summary.regionPerformance)], [summary]);
  const categories = useMemo(() => ['All', ...Object.keys(summary.categoryPerformance)], [summary]);

  // Handle Dynamic Client-side drill-down metrics based on selection
  const kpis = useMemo(() => {
    let revenueMultiplier = 1.0;
    
    if (selectedRegion !== 'All') {
      const regionTotal = summary.regionPerformance[selectedRegion] || 0;
      revenueMultiplier = regionTotal / summary.totalRevenue;
    }

    if (selectedCategory !== 'All') {
      const catTotal = summary.categoryPerformance[selectedCategory]?.revenue || 0;
      revenueMultiplier = revenueMultiplier * (catTotal / summary.totalRevenue);
    }

    const adjRevenue = Math.round(summary.totalRevenue * revenueMultiplier);
    const adjProfit = Math.round(summary.totalProfit * revenueMultiplier);
    const adjTransactions = Math.round(summary.totalTransactions * revenueMultiplier);

    return {
      revenue: adjRevenue || summary.totalRevenue,
      profit: adjProfit || summary.totalProfit,
      margin: summary.profitMargin,
      transactions: adjTransactions || summary.totalTransactions
    };
  }, [summary, selectedRegion, selectedCategory]);

  const categoryChartData = useMemo(() => {
    return Object.entries(summary.categoryPerformance).map(([name, val]) => ({
      name,
      revenue: val.revenue,
      profit: val.profit
    }));
  }, [summary]);

  const regionChartData = useMemo(() => {
    return Object.entries(summary.regionPerformance).map(([name, val]) => ({
      name,
      revenue: val
    }));
  }, [summary]);

  const categoryColors = {
    Electronics: '#6366f1', // Indigo
    Grocery: '#10b981',     // Emerald
    Apparel: '#ec4899',     // Pink
    Home: '#f59e0b',        // Amber
    Beauty: '#06b6d4'       // Cyan
  };

  return (
    <div id="sales-dashboard-container" className="space-y-6">
      {/* Platform Drill-Down Dashboard Filter Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[#1E293B] border border-slate-700/50 rounded-xl gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight font-display text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
            Executive Performance Dashboard
          </h2>
          <p className="text-xs text-slate-400">Enterprise sales, region analytics, and high-frequency metrics overview.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-850 px-3 py-1.5 border border-slate-750 rounded-lg">
            <span className="text-xs text-slate-400 font-semibold">Region:</span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-transparent text-xs text-white outline-none font-semibold cursor-pointer"
            >
              {regions.map(r => <option key={r} value={r} className="bg-slate-900 text-slate-300">{r}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-850 px-3 py-1.5 border border-slate-750 rounded-lg">
            <span className="text-xs text-slate-400 font-semibold">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs text-white outline-none font-semibold cursor-pointer"
            >
              {categories.map(c => <option key={c} value={c} className="bg-slate-900 text-slate-300">{c}</option>)}
            </select>
          </div>

          <button
            onClick={() => {
              setShowCheckout(!showCheckout);
              setCheckoutSuccess('');
              setCheckoutError('');
            }}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 hover:border-indigo-500 text-xs text-white px-3 py-1.5 border border-indigo-700 rounded-lg font-bold transition-all cursor-pointer font-mono whitespace-nowrap"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {showCheckout ? 'HIDE RECORD DESK' : 'REGISTER LIVE SALE'}
          </button>
        </div>
      </div>

      {/* Interactive Operational Checkout Desk Panel */}
      {showCheckout && (
        <div id="checkout-console-panel" className="bg-[#111827] border border-cyan-500/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-xs font-bold text-cyan-400 font-mono tracking-wider uppercase flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-cyan-400" />
                Operations Desk: Trade Checkout Terminal
              </h3>
              <p className="text-xs text-slate-400">Directly deduct product stock, record manual sales transaction and update client clustering metrics.</p>
            </div>
            <button
              onClick={() => setShowCheckout(false)}
              className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded cursor-pointer"
            >
              Close Console
            </button>
          </div>

          {checkoutSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold font-mono">
              ✔️ {checkoutSuccess}
            </div>
          )}

          {checkoutError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold font-mono">
              ⚠️ {checkoutError}
            </div>
          )}

          {loadingCheckoutData ? (
            <div className="text-center py-6 text-xs text-slate-500 font-mono">Synchronizing corporate directory entities...</div>
          ) : (
            <form onSubmit={handleCheckoutSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono">Select Product SKU</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-2 text-xs text-white rounded-lg outline-none cursor-pointer"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900">
                      {p.name} (${p.price} | Stock: {p.stock} left)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono">Customer Account</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-2 text-xs text-white rounded-lg outline-none cursor-pointer"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900">
                      {c.name} ({c.email} | Segment: {c.segment})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono">Fulfillment Store Branch</label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-2 text-xs text-white rounded-lg outline-none cursor-pointer"
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900">
                      {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono">Quantity</label>
                  <input
                    type="number"
                    value={units}
                    min="1"
                    onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-800 border border-slate-700 p-2 text-xs text-white rounded-lg outline-none"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white border border-cyan-650 hover:border-cyan-500 rounded-lg text-xs font-bold leading-none py-3 px-2 text-center uppercase font-mono shadow active:translate-y-0.5 transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {isSubmitting ? 'BILLING...' : 'REGISTER SALE'}
                </button>
              </div>
            </form>
          )}

          {calculations && !loadingCheckoutData && (
            <div className="p-3.5 bg-[#0B1120] border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-4">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">PROJECTED TRANSACTION SURPLUS SHEET:</span>
              <div className="flex flex-wrap items-center gap-5 text-xs font-mono">
                <div>
                  <span className="text-slate-500 mr-1.5">Revenue:</span>
                  <span className="text-emerald-400 font-bold">${calculations.rev.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 mr-1.5">COGS:</span>
                  <span className="text-slate-300">${calculations.cost.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 mr-1.5">Operating Margin:</span>
                  <span className="text-indigo-400 font-bold">${calculations.margin.toLocaleString()} ({calculations.marginPct}%)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { id: 'kpi-revenue', title: 'Global Operations Revenue', val: `$${kpis.revenue.toLocaleString()}`, icon: DollarSign, pct: '+14.2%', desc: 'vs prior year q2', color: 'text-emerald-400' },
          { id: 'kpi-profit', title: 'Gross Profit Balance', val: `$${kpis.profit.toLocaleString()}`, icon: TrendingUp, pct: '+9.4%', desc: 'recomputed net surplus', color: 'text-indigo-400' },
          { id: 'kpi-margin', title: 'System Operating Margin', val: `${kpis.margin}%`, icon: Percent, pct: 'Stable', desc: 'weighted cost margin', color: 'text-cyan-400' },
          { id: 'kpi-transactions', title: 'Operational Log Volume', val: kpis.transactions.toLocaleString(), icon: ShoppingBag, pct: '+11.8%', desc: 'unique logged checkouts', color: 'text-amber-400' }
        ].map((card, i) => (
          <div key={card.id} className="relative overflow-hidden bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-semibold tracking-tight uppercase">{card.title}</span>
              <div className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold font-mono text-white">{card.val}</span>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className={`font-mono font-semibold ${card.color}`}>{card.pct}</span>
                <span className="text-slate-500">{card.desc}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Sales Trend Area Chart */}
        <div className="lg:col-span-2 bg-[#111827] border border-slate-800 p-5 rounded-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-white tracking-tight">Year-Over-Year Sales Growth</h3>
              <p className="text-xs text-slate-400">Current annual billing run-rate contrasted with previous cyclical parameters.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-cyan-400 rounded-full"></span>
                <span className="text-slate-300">Current Year</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-slate-600 rounded-full"></span>
                <span className="text-slate-400">Previous Year</span>
              </div>
            </div>
          </div>

          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.monthlyRevenueComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCY" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `$${val/1000}k`} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                  itemStyle={{ fontSize: '12px', padding: '2px 0' }}
                  formatter={(val: number) => [`$${val.toLocaleString()}`, '']}
                />
                <Area type="monotone" dataKey="currentYear" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCY)" />
                <Area type="monotone" dataKey="lastYear" stroke="#475569" strokeWidth={1.5} strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Region Sales Share */}
        <div className="bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-400" />
              REGIONAL SALES VOLUME
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 uppercase tracking-wider font-mono">DISTRIBUTED REGIONAL METRICS</p>
          </div>

          <div className="space-y-3 my-auto">
            {regionChartData.map((reg) => {
              const maxRev = Math.max(...regionChartData.map(r => r.revenue));
              const pct = (reg.revenue / maxRev) * 100;
              return (
                <div key={reg.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">{reg.name} Region</span>
                    <span className="text-white font-mono">${reg.revenue.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-[#0B1120] h-2 rounded overflow-hidden border border-slate-800">
                    <div
                      className="bg-indigo-500 h-full rounded transition-all duration-1000"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4 text-[10px] text-slate-500 text-center">
            Weighted on national sales quotas
          </div>
        </div>
      </div>

      {/* Advanced Structural Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Category Contribution Metrics */}
        <div className="lg:col-span-3 bg-[#111827] border border-slate-800 p-5 rounded-xl">
          <div className="mb-4">
            <h3 className="font-semibold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Product Category Performance
            </h3>
            <p className="text-xs text-slate-400">Total revenue generated by vertical compared with cumulative gross profit margins.</p>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `$${val/1000}k`} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '11px' }}
                  formatter={(val: number) => [`$${val.toLocaleString()}`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="revenue" name="Total Revenue" radius={[4, 4, 0, 0]}>
                  {categoryChartData.map((entry, idx) => (
                    <Cell key={`cell-rev-${idx}`} fill={categoryColors[entry.name as keyof typeof categoryColors] || '#6366f1'} />
                  ))}
                </Bar>
                <Bar dataKey="profit" name="Gross operating profit" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Performing SKUs Table */}
        <div className="lg:col-span-2 bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-amber-400" />
              TOP PERFORMING SKUS
            </h3>
            <p className="text-[11px] text-slate-450 uppercase font-mono mt-0.5">MOST ACTIVE INVENTORY SKUS</p>
          </div>

          <div className="space-y-2">
            {summary.topProducts.map((p, idx) => (
              <div key={`sku-${idx}`} className="flex items-center justify-between p-2 bg-[#0B1120] border border-slate-800/80 rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-800 border border-slate-700 font-mono text-slate-300 py-0.5 px-1.5 rounded">#0{idx+1}</span>
                    <span className="font-semibold text-xs text-slate-100 truncate block">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{p.category}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-white">${p.revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500 block">Qty: {p.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

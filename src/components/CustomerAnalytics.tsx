import React, { useState, useEffect, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';
import { Customer, DashboardSummary } from '../types.js';
import { biApi } from '../lib/api.ts';
import { UserCheck, RefreshCw, AlertTriangle, Users, Search, HelpCircle, PlusCircle, X } from 'lucide-react';

interface CustomerAnalyticsProps {
  summary: DashboardSummary;
  refreshSummary?: () => void;
  currentUserRole?: string;
}

export function CustomerAnalytics({ summary, refreshSummary, currentUserRole }: CustomerAnalyticsProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // New CRM manually registered customer state
  const [showCustForm, setShowCustForm] = useState(false);
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custSegment, setCustSegment] = useState('New Shoppers');
  const [custRegion, setCustRegion] = useState('West');
  const [custCategory, setCustCategory] = useState('Electronics');
  const [custError, setCustError] = useState('');
  const [custSuccess, setCustSuccess] = useState('');
  const [custSubmitting, setCustSubmitting] = useState(false);

  const handleCustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustError('');
    setCustSuccess('');

    if (!custName.trim() || !custEmail.trim()) {
      setCustError('Please configure both the customer Name and corporate business Email.');
      return;
    }

    setCustSubmitting(true);
    try {
      await biApi.createCustomer({
        name: custName.trim(),
        email: custEmail.trim().toLowerCase(),
        segment: custSegment,
        region: custRegion,
        preferredCategory: custCategory
      });
      setCustSuccess(`Profile for ${custName} registered. Automatically queued Euclidean clustering algorithms!`);
      setCustName('');
      setCustEmail('');
      if (refreshSummary) {
        refreshSummary();
      }
      fetchCustomers();
    } catch (err: any) {
      setCustError(err.message || 'Operation failed.');
    } finally {
      setCustSubmitting(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, segment, page, filterRegion, filterCategory]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const result = await biApi.getCustomers(search, segment, page, filterRegion, filterCategory);
      setCustomers(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Whenever a customer is clicked, query the server-side Collaborative Recommendations API in real-time!
  const selectCustomer = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setLoadingRecs(true);
    try {
      const items = await biApi.getRecommendations(cust.id);
      setRecs(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRecs(false);
    }
  };

  // Prepare KMeans Scatter Plot Data Points
  // X: Recency (Days since last buy), Y: Frequency (Volume of checkouts)
  // Standardize values dynamically so they remain visual
  const scatterData = useMemo(() => {
    const clusterLabels = ['Champions', 'Loyal Customers', 'At Risk Churn', 'New Shoppers'];
    const clusterColors = ['#10b981', '#6366f1', '#f97316', '#3b82f6'];

    return clusterLabels.map((label, idx) => {
      // Find all customers belonging to this segmentation cluster index
      const points = customers
        .filter(c => c.cluster === idx)
        .map(c => ({
          name: c.name,
          email: c.email,
          x: c.recency, // Recency
          y: c.frequency, // Frequency
          monetary: c.monetary,
          clusterName: label,
          color: clusterColors[idx]
        }));
      return {
        clusterName: label,
        color: clusterColors[idx],
        points
      };
    });
  }, [customers]);

  return (
    <div id="customer-analytics-container" className="space-y-6">
      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Registered Consumers', val: summary.totalCustomers, desc: 'active CRM entities', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { title: 'Champions Segment', val: summary.segmentDistribution['Champions'] || 0, desc: 'high-spending loyalists', icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { title: 'Attrition Buffer Flag', val: summary.segmentDistribution['At Risk Churn'] || 0, desc: 'exceeding standard wait matrix', icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { title: 'Average Customer Lifespan', val: '4.8 Months', desc: 'expected store tenure', icon: RefreshCw, color: 'text-cyan-400', bg: 'bg-cyan-500/10' }
        ].map((stat, idx) => (
          <div key={`cust-stat-${idx}`} className="bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl flex items-center gap-4">
            <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold font-mono text-white">{stat.val}</span>
              <p className="text-xs text-slate-400 mt-0.5">{stat.title}</p>
              <span className="text-[10px] text-slate-500 block">{stat.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* KMeans Clustering and RFM scatter Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interaction Scatter Visualization */}
        <div className="lg:col-span-2 bg-[#111827] border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white tracking-tight uppercase text-xs">K-Means Customer Segmentation</h3>
              <div className="flex items-center gap-1 text-[10px] bg-slate-800 border border-slate-700 py-0.5 px-2 rounded-full text-slate-300 font-mono">
                <HelpCircle className="w-3 h-3 text-cyan-400" />
                RFM CLUSTERING
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Visual cluster maps grouped via Euclidean standard limits.
            </p>
          </div>

          <div className="h-64 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" dataKey="x" name="Recency" stroke="#64748b" fontSize={10} unit=" days">
                  <Label value="Recency (Lower = More Recent)" offset={-10} position="insideBottom" fill="#94a3b8" fontSize={10} />
                </XAxis>
                <YAxis type="number" dataKey="y" name="Frequency" stroke="#64748b" fontSize={10} unit=" tx">
                  <Label value="Frequency (Checks)" angle={-90} position="insideLeft" fill="#94a3b8" fontSize={10} />
                </YAxis>
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-1">
                          <p className="font-bold text-white">{data.name}</p>
                          <p className="text-slate-400">{data.email}</p>
                          <p className="text-slate-300 font-semibold text-[11px]">
                            {data.clusterName} • Recency: {data.x}d • Freq: {data.y}tx
                          </p>
                          <p className="text-emerald-400 font-mono">Monetary Spent: ₹{data.monetary.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {scatterData.map((cluster) => (
                  <Scatter
                    key={cluster.clusterName}
                    name={cluster.clusterName}
                    data={cluster.points}
                    fill={cluster.color}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] mt-2 pt-2 border-t border-slate-800/60">
            {scatterData.map(c => (
              <div key={`legend-${c.clusterName}`} className="flex items-center gap-1.5 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-slate-300">{c.clusterName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Customer Deep Dive and Collaborative Filtering Panel */}
        <div className="bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight uppercase">CRM PROFILE ANALYTICS</h3>
            <p className="text-xs text-slate-400 mb-4">Select a customer directory entry to load collaborative recommendation models in real-time.</p>
          </div>

          {selectedCustomer ? (
            <div className="space-y-4 my-auto">
              <div className="p-3 bg-[#0B1120] border border-slate-800 rounded-lg">
                <h4 className="text-xs font-bold text-white uppercase">{selectedCustomer.name}</h4>
                <p className="text-[10px] text-slate-450 font-mono">{selectedCustomer.email}</p>
                <div className="flex items-center justify-between mt-3 text-xs border-t border-slate-800 pt-2">
                  <span className="text-slate-400 font-medium font-mono text-[10px]">RFM Score:</span>
                  <span className="font-mono text-cyan-400 font-bold">{selectedCustomer.rfmScore}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-slate-400 font-medium font-mono text-[10px]">Churn Prob:</span>
                  <span className={`font-mono font-bold ${selectedCustomer.churnProbability > 70 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedCustomer.churnProbability}%
                  </span>
                </div>
              </div>

              {/* Collaborative filtering items output */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono">Similiar checkout predictions:</span>
                {loadingRecs ? (
                  <div className="text-center py-4 text-[10px] text-slate-500 font-mono">Running matrix dot products...</div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {recs.slice(0, 3).map((p: any) => (
                      <div key={`rec-${p.id}`} className="flex items-center justify-between p-2 bg-[#0B1120] border border-slate-800 rounded-lg">
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-200 block truncate max-w-[170px]">{p.name}</span>
                          <span className="text-[9px] text-indigo-400 font-mono uppercase">{p.category}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-white">₹{p.price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 flex flex-col items-center justify-center my-auto">
              <Users className="w-8 h-8 stroke-1 text-slate-650 mb-2" />
              <p className="text-xs font-semibold">No active profile.</p>
              <span className="text-[10px] text-slate-500 mt-1 max-w-[180px] font-mono">Select standard customer directory line below.</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 mt-3 text-[10px] text-slate-500 text-center font-mono uppercase">
            Matrix Factorization Logged
          </div>
        </div>
      </div>

      {/* Directory Table Area */}
      <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-bold text-white tracking-tight text-xs uppercase">Enterprise Client Registry Directory</h3>
            <p className="text-xs text-slate-400">Total list of scanned customer RFM stats, segment clusters, and value profiles.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search clients..."
                className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none w-40 sm:w-48 transition-all"
              />
            </div>

            {/* Segment select */}
            <select
              value={segment}
              onChange={(e) => { setSegment(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="">All Segments</option>
              <option value="Champions">Champions</option>
              <option value="Loyal Customers">Loyal Customers</option>
              <option value="At Risk Churn">At Risk Churn</option>
              <option value="New Shoppers">New Shoppers</option>
            </select>

            {/* Region select */}
            <select
              value={filterRegion}
              onChange={(e) => { setFilterRegion(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="">All Regions</option>
              <option value="Northeast">Northeast</option>
              <option value="Midwest">Midwest</option>
              <option value="South">South</option>
              <option value="West">West</option>
            </select>

            {/* Category select */}
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Grocery">Grocery</option>
              <option value="Apparel">Apparel</option>
              <option value="Home">Home</option>
              <option value="Beauty">Beauty</option>
            </select>

            {currentUserRole === 'Admin' && (
              <button
                onClick={() => {
                  setShowCustForm(!showCustForm);
                  setCustError('');
                  setCustSuccess('');
                }}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 hover:border-indigo-500 text-xs text-white px-3 py-2 border border-indigo-700 rounded-lg font-bold transition-all cursor-pointer font-mono whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4" />
                {showCustForm ? 'HIDE CRM FORM' : 'REGISTER CONSUMER'}
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Customer Creation Panel */}
        {showCustForm && (
          <div id="customer-registration-panel" className="mb-4 p-4 bg-[#0B1120] border border-indigo-500/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div>
                <h4 className="text-xs font-bold text-indigo-400 font-mono tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  CRM Operations: Register Customer Profile
                </h4>
                <p className="text-[10.5px] text-slate-400">Add custom shoppers directly into KMeans database registers to execute customized testing operations.</p>
              </div>
              <button
                onClick={() => setShowCustForm(false)}
                className="text-[9px] uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded cursor-pointer"
              >
                Close Form
              </button>
            </div>

            {custSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-mono font-semibold">
                ✔️ {custSuccess}
              </div>
            )}

            {custError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-mono font-semibold">
                ⚠️ {custError}
              </div>
            )}

            <form onSubmit={handleCustSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
              <div>
                <label className="block text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-1 font-mono">Full Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rachel Green"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-2 text-xs text-white rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-1 font-mono">Business / Personal Email</label>
                <input
                  type="email"
                  placeholder="rachel@ralphlauren.com"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-2 text-xs text-white rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-1 font-mono">Initial Cohort Segment</label>
                <select
                  value={custSegment}
                  onChange={(e) => setCustSegment(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-2 text-xs text-white rounded-lg outline-none cursor-pointer"
                >
                  <option value="Champions">Champions (Active High Value)</option>
                  <option value="Loyal Customers">Loyal Customers (Recurring Shopper)</option>
                  <option value="At Risk Churn">At Risk Churn (Dormant High Value)</option>
                  <option value="New Shoppers">New Shoppers (Fresh Account)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-1 font-mono">Assigned Region</label>
                <select
                  value={custRegion}
                  onChange={(e) => setCustRegion(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-2 text-xs text-white rounded-lg outline-none cursor-pointer"
                >
                  <option value="Northeast">Northeast</option>
                  <option value="Midwest">Midwest</option>
                  <option value="South">South</option>
                  <option value="West">West</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-1 font-mono">Preferred Category</label>
                <select
                  value={custCategory}
                  onChange={(e) => setCustCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-2 text-xs text-white rounded-lg outline-none cursor-pointer"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Grocery">Grocery</option>
                  <option value="Apparel">Apparel</option>
                  <option value="Home">Home</option>
                  <option value="Beauty">Beauty</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={custSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs p-2.5 rounded-lg active:translate-y-0.5 transition uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {custSubmitting ? 'REGISTERING...' : 'REGISTER CONSUMER'}
              </button>
            </form>
          </div>
        )}

        {/* Database Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-semibold uppercase font-mono bg-[#0B1120]">
                <th className="p-2.5">Customer Profile</th>
                <th className="p-2.5">Region</th>
                <th className="p-2.5">Fav Category</th>
                <th className="p-2.5">Recency</th>
                <th className="p-2.5">Frequency</th>
                <th className="p-2.5">Monetary</th>
                <th className="p-2.5">CLV Forecast</th>
                <th className="p-2.5">KM Cluster Segment</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-500 font-mono text-[10px]">Querying database records...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-500">No customers found matching queries.</td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className={`border-b border-slate-850 hover:bg-slate-800/20 transition cursor-pointer ${selectedCustomer?.id === c.id ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500' : ''}`}
                  >
                    <td className="p-2.5">
                      <div>
                        <span className="font-semibold text-slate-100 block">{c.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono block">{c.email}</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-slate-300 font-mono">{c.region || 'West'}</td>
                    <td className="p-2.5 text-slate-300 font-mono">{c.preferredCategory || 'Electronics'}</td>
                    <td className="p-2.5 text-slate-300 font-mono">{c.recency} days</td>
                    <td className="p-2.5 text-slate-300 font-mono">{c.frequency} checkouts</td>
                    <td className="p-2.5 text-white font-mono font-semibold">₹{c.monetary.toLocaleString()}</td>
                    <td className="p-2.5 text-cyan-400 font-mono font-semibold">₹{c.clv.toLocaleString()}</td>
                    <td className="p-2.5">
                      <span className={`inline-block py-0.5 px-2 rounded text-[10px] font-semibold text-center ${
                        c.cluster === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        c.cluster === 1 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        c.cluster === 2 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {c.segment}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline">Select Profile</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 mt-3 text-[11px] text-slate-400 font-mono">
            <span>Showing Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="bg-slate-800 px-3 py-1 border border-slate-700 rounded-lg hover:border-slate-650 disabled:opacity-40 disabled:cursor-not-allowed text-[11px]"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="bg-slate-800 px-3 py-1 border border-slate-700 rounded-lg hover:border-slate-650 disabled:opacity-40 disabled:cursor-not-allowed text-[11px]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

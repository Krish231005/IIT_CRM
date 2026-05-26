import React, { useState, useEffect } from 'react';
import { Product, Supplier } from '../types.js';
import { biApi } from '../lib/api.ts';
import { Package, AlertTriangle, Truck, PlusCircle, Search, Edit2, Trash2, X } from 'lucide-react';

interface InventorySupplyChainProps {
  refreshSummary?: () => void;
}

export function InventorySupplyChain({ refreshSummary }: InventorySupplyChainProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // CRUD product SKU variables
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Electronics');
  const [formPrice, setFormPrice] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, [search, category, page]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const result = await biApi.getProducts(search, category, page, 6);
      setProducts(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const sups = await biApi.getSuppliers();
      setSuppliers(sups);
    } catch (err) {
      console.error(err);
    }
  };

  // Open modal for Creation SKU
  const openCreateModal = () => {
    setErrorMsg('');
    setEditingId(null);
    setFormName('');
    setFormCategory('Electronics');
    setFormPrice('199');
    setFormCost('85');
    setFormStock('100');
    setFormMinStock('40');
    setFormSupplierId(suppliers[0]?.id || 'SUP-101');
    setShowModal(true);
  };

  // Open modal for Editing SKU
  const openEditModal = (p: Product) => {
    setErrorMsg('');
    setEditingId(p.id);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormPrice(p.price.toString());
    setFormCost(p.cost.toString());
    setFormStock(p.stock.toString());
    setFormMinStock(p.minRequiredStock.toString());
    setFormSupplierId(p.supplierId);
    setShowModal(true);
  };

  // Save SKU (Update or Create)
  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formName || !formCategory || !formPrice || !formCost || !formStock) {
      setErrorMsg('All product parameter variables are mandatory.');
      return;
    }

    const payload = {
      name: formName,
      category: formCategory,
      price: parseFloat(formPrice),
      cost: parseFloat(formCost),
      stock: parseInt(formStock),
      minRequiredStock: parseInt(formMinStock) || 50,
      supplierId: formSupplierId || 'SUP-101'
    };

    try {
      if (editingId) {
        await biApi.updateProduct(editingId, payload);
      } else {
        await biApi.createProduct(payload);
      }
      setShowModal(false);
      fetchProducts();
      if (refreshSummary) {
        refreshSummary();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failure handling operations request.');
    }
  };

  // Discontinue / Delete SKU line
  const deleteProduct = async (id: string) => {
    if (confirm('Are you absolutely certain you want to discontinue this product SKU line? This removes it from active inventory aggregates.')) {
      try {
        await biApi.deleteProduct(id);
        fetchProducts();
        if (refreshSummary) {
          refreshSummary();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Pre-calculated Low Stocks Alert list
  const lowStocks = products.filter(p => p.stock < p.minRequiredStock);

  return (
    <div id="inventory-optimizer-container" className="space-y-6">
      {/* Top Cards Bar representing Warehouse overview and supplier status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-2xl font-bold font-mono text-emerald-400">92.4%</span>
            <span className="text-xs text-slate-400 block font-semibold">Active Inventory Turnover Index</span>
            <p className="text-[10px] text-slate-500">Optimized across all nationwide fulfilment depots.</p>
          </div>
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-2xl font-bold font-mono text-rose-400">{lowStocks.length} Categories</span>
            <span className="text-xs text-slate-400 block font-semibold">Low-Stock Stockout Alerts Active</span>
            <p className="text-[10px] text-slate-500">Critical warehouse limits logged.</p>
          </div>
          <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-2xl font-bold font-mono text-cyan-400">89.1 Score</span>
            <span className="text-xs text-slate-400 block font-semibold">Supplier Fulfilment SLA Score</span>
            <p className="text-[10px] text-slate-500">Cross-border freight delivery score.</p>
          </div>
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Core Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Product Catalog (Col Span 2) with FULL CRUD OPTIONS! */}
        <div className="lg:col-span-2 bg-[#111827] border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h3 className="font-bold text-white text-xs uppercase tracking-tight">Enterprise Inventory SKUs</h3>
                <p className="text-xs text-slate-400">Dynamic product catalogs, stock management, and CRUD controls.</p>
              </div>

              {/* CRUD Action Button */}
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow active:translate-y-0.5 transition cursor-pointer font-mono"
              >
                <PlusCircle className="w-4 h-4" />
                ADD PRODUCT SKU
              </button>
            </div>

            {/* Filter and search bars */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Filter by SKU or key title..."
                  className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none w-full transition-all"
                />
              </div>

              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                <option value="">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Grocery">Grocery</option>
                <option value="Apparel">Apparel</option>
                <option value="Home">Home</option>
                <option value="Beauty">Beauty</option>
              </select>
            </div>

            {/* Catalog Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 font-mono text-[10px] bg-[#0B1120] uppercase">
                    <th className="p-2.5">SKU details</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5 font-mono">Retail Price</th>
                    <th className="p-2.5 font-mono">Unit Cost</th>
                    <th className="p-2.5 font-mono">Live Stock</th>
                    <th className="p-2.5 text-right font-mono">Operations</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-500 font-mono">Querying inventory databases...</td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-500">No matching products found.</td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const isLow = p.stock < p.minRequiredStock;
                      return (
                        <tr key={p.id} className="border-b border-slate-850 hover:bg-slate-800/10">
                          <td className="p-2.5">
                            <div>
                              <span className="font-semibold text-slate-200 block truncate max-w-[170px]">{p.name}</span>
                              <span className="text-[9px] text-slate-500 font-mono">{p.id}</span>
                            </div>
                          </td>
                          <td className="p-2.5">
                            <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-350 font-semibold font-mono">{p.category}</span>
                          </td>
                          <td className="p-2.5 text-white font-semibold font-mono">${p.price}</td>
                          <td className="p-2.5 text-slate-450 font-mono">${p.cost}</td>
                          <td className="p-2.5 font-mono">
                            <span className={`font-bold ${isLow ? 'text-rose-400' : 'text-slate-300'}`}>{p.stock}</span>
                            <span className="text-[9px] text-slate-500"> / {p.minRequiredStock} limit</span>
                          </td>
                          <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => openEditModal(p)}
                              className="inline-flex p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
                              title="Edit item attributes"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteProduct(p.id)}
                              className="inline-flex p-1.5 bg-slate-800 hover:bg-rose-500/15 border border-slate-700 hover:border-rose-500/30 text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="Discontinue item SKU"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-850 mt-3 text-[11px] text-slate-450 font-mono">
              <span>Showing Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="bg-slate-800 px-3 py-1 text-[11px] border border-slate-700 rounded-lg disabled:opacity-40 font-mono"
                >
                  Prev
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="bg-slate-800 px-3 py-1 text-[11px] border border-slate-700 rounded-lg disabled:opacity-40 font-mono"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Supplier reliability rankings (Col Span 1) */}
        <div className="bg-[#1E293B] border border-slate-700/50 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-tight flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-cyan-400" />
              SLA Supplier Performance Index
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono uppercase text-[10px]">Supply Chains Logs active</p>
          </div>

          <div className="space-y-2.5 my-auto">
            {suppliers.map((s) => {
              const score = s.reliabilityScore;
              let scoreColor = 'text-emerald-400';
              let scoreBg = 'bg-emerald-500/10';
              if (score < 85) {
                scoreColor = 'text-amber-400';
                scoreBg = 'bg-amber-500/10';
              }
              if (score < 80) {
                scoreColor = 'text-rose-400';
                scoreBg = 'bg-rose-500/10';
              }

              return (
                <div key={s.id} className="p-2.5 bg-[#0B1120] border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase">{s.name}</h4>
                      <span className="text-[9px] text-slate-500 font-mono block">Category: {s.category}</span>
                    </div>

                    <span className={`inline-block py-0.5 px-2 rounded font-mono font-bold text-[9px] ${scoreBg} ${scoreColor}`}>
                      SLA: {score}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 h-1.5 rounded overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-1000 ${
                        score > 90 ? 'bg-emerald-400' : score > 80 ? 'bg-amber-400' : 'bg-rose-400'
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-800/60 mt-4 text-[10px] text-slate-500 text-center">
            Weighted metrics computed on global ETA
          </div>
        </div>
      </div>

      {/* CRUD Product Dialog Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-md w-full p-5 relative shadow-2xl overflow-hidden">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              {editingId ? 'Edit Product Parameters' : 'Register New Catalog SKU'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Configure logistics metadata coefficients and warehouse bounds.</p>

            {errorMsg && (
              <div className="p-2 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-lg text-xs mt-3 font-semibold font-mono">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={saveProduct} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 font-mono">SKU Title / Label</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. UltraSense Smart Speaker"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 font-mono">Vertical Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Grocery">Grocery</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Home">Home</option>
                    <option value="Beauty">Beauty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 font-mono">Manufacturing Line</label>
                  <select
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 font-mono">Unit Retail Price ($)</label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    step="0.01"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 font-mono">Unit Cost ($)</label>
                  <input
                    type="number"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    step="0.01"
                    className="w-full bg-slate-805 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 font-mono">Initial Stock (Units)</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 font-mono">Safety stock limit</label>
                  <input
                    type="number"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow active:translate-y-0.5 transition cursor-pointer uppercase font-mono"
              >
                {editingId ? 'Modify Active SKU' : 'Add Item to Inventory Catalog'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

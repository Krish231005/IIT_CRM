import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  PackageSearch,
  LineChart,
  Radio,
  FileSpreadsheet,
  LogOut,
  Sparkles,
  User,
  Activity,
  ShieldCheck,
  Server,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Database
} from 'lucide-react';

import { auth, biApi } from './lib/api.ts';
import { DashboardSummary } from './types.js';

// Import our modular dashboard blocks
import { SalesDashboard } from './components/SalesDashboard.tsx';
import { CustomerAnalytics } from './components/CustomerAnalytics.tsx';
import { InventorySupplyChain } from './components/InventorySupplyChain.tsx';
import { ForecastDemandPanel } from './components/ForecastDemandPanel.tsx';
import { RealTimeOperations } from './components/RealTimeOperations.tsx';
import { DatabaseETLModule } from './components/DatabaseETLModule.tsx';

export default function App() {
  const [token, setToken] = useState<string | null>(auth.getToken());
  const [currentUser, setCurrentUser] = useState<any>(auth.getUser());
  const [activeTab, setActiveTab] = useState<'sales' | 'customers' | 'inventory' | 'forecast' | 'realtime' | 'etl'>('sales');

  // Shared state statistics to speed up navigation
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Flow States
  const [screen, setScreen] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Register Variables
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<'Admin' | 'Analyst'>('Analyst');
  const [signupSuccess, setSignupSuccess] = useState('');

  // Login Form Variables
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (token) {
      loadPlatformData();
    }
  }, [token]);

  const loadPlatformData = async () => {
    setLoadingSummary(true);
    try {
      const data = await biApi.getSummary();
      setSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setSignupSuccess('');
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Corporate business email and security password credentials are required.');
      return;
    }

    setLoadingLogin(true);
    try {
      const data = await auth.login(loginEmail.trim(), loginPassword.trim());
      setToken(data.token);
      setCurrentUser(data.user);
      setScreen('dashboard');
    } catch (err: any) {
      setLoginError(err.message || 'Verification failure.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setSignupSuccess('');

    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setLoginError('All registration fields are required.');
      return;
    }

    setLoadingLogin(true);
    try {
      await auth.register(
        signupName.trim(),
        signupEmail.toLowerCase().trim(),
        signupPassword.trim(),
        signupRole
      );
      setSignupSuccess('Account with credentials provisioned in MongoDB! Sign in below.');
      
      // Auto pre-fill Form
      setLoginEmail(signupEmail.toLowerCase().trim());
      setLoginPassword(signupPassword.trim());
      setAuthMode('login');

      // Clear sign-up form elements
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Registration failure.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const bypassLogin = async (presetRole: 'admin' | 'analyst') => {
    const defaultEmail = presetRole === 'admin' ? 'executive.admin@retailbi.com' : 'regional.analyst@retailbi.com';
    const defaultPassword = presetRole === 'admin' ? 'admin' : 'analyst';
    setLoginEmail(defaultEmail);
    setLoginPassword(defaultPassword);
    setLoadingLogin(true);
    try {
      const data = await auth.login(defaultEmail, defaultPassword);
      setToken(data.token);
      setCurrentUser(data.user);
      setScreen('dashboard');
    } catch (err: any) {
      setLoginError(err.message || 'Verification failure.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogoutAction = () => {
    auth.logout();
    setToken(null);
    setCurrentUser(null);
    setSummary(null);
    setScreen('landing');
  };

  // Switch View helper
  const renderViewport = () => {
    if (!summary) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-mono text-xs">
          <Server className="w-10 h-10 animate-bounce text-cyan-400 mb-3" />
          <span>Synchronizing enterprise schemas...</span>
        </div>
      );
    }

    switch (activeTab) {
      case 'sales':
        return <SalesDashboard summary={summary} refreshSummary={loadPlatformData} />;
      case 'customers':
        return <CustomerAnalytics summary={summary} refreshSummary={loadPlatformData} />;
      case 'inventory':
        return <InventorySupplyChain refreshSummary={loadPlatformData} />;
      case 'forecast':
        return <ForecastDemandPanel />;
      case 'realtime':
        return <RealTimeOperations />;
      case 'etl':
        return <DatabaseETLModule />;
      default:
        return <SalesDashboard summary={summary} refreshSummary={loadPlatformData} />;
    }
  };

  // Render Landing Page first
  if (screen === 'landing') {
    return (
      <div id="landing-viewport" className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col relative overflow-hidden selection:bg-cyan-500/35 selection:text-white">
        {/* Main glowing canvas accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-500/10 via-cyan-500/5 to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Navigation Bar */}
        <nav className="border-b border-slate-800/60 bg-slate-950/40 backdrop-blur-md relative z-20">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center text-white font-extrabold text-base shadow-lg shadow-cyan-400/10 font-display">
                R
              </div>
              <div>
                <span className="font-extrabold font-display text-white text-sm tracking-tight block">RetailBI Enterprise</span>
                <span className="text-[9px] font-mono font-medium text-emerald-400/80 uppercase tracking-widest block">Atlas Live Ingestion Connected</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {token ? (
                <>
                  <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                    Active Operator: <strong className="text-cyan-400">{currentUser?.name}</strong>
                  </span>
                  <button 
                    onClick={() => setScreen('dashboard')}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/10 transition duration-200 cursor-pointer"
                  >
                    Go to Dashboard
                  </button>
                  <button 
                    onClick={handleLogoutAction}
                    className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => { setScreen('auth'); setAuthMode('login'); }}
                    className="px-4 py-2 text-xs font-semibold text-slate-350 hover:text-white transition cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => { setScreen('auth'); setAuthMode('register'); }}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/10 transition duration-200 cursor-pointer"
                  >
                    Register Profile
                  </button>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Core Hero Component */}
        <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:py-24 max-w-5xl mx-auto text-center relative z-10 select-none">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-slate-850 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-300">
                Business Intelligence Platform v2.0
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white font-display leading-[1.12]">
              Next-Generation Logistics <br className="hidden md:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                Intelligence &amp; Analytics Engine
              </span>
            </h1>

            <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Connect your business nodes, run automated high-frequency anomaly surveillance, simulate market changes, and streamline supply chains with persistent MongoDB storage.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              {token ? (
                <button
                  onClick={() => setScreen('dashboard')}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-xl shadow-cyan-500/20 hover:scale-[1.02] active:scale-98 transition duration-200 cursor-pointer flex items-center justify-center gap-2 group"
                >
                  Go to Operational Dashboard
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition duration-150" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setScreen('auth'); setAuthMode('login'); }}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-xl shadow-cyan-500/20 hover:scale-[1.02] active:scale-98 transition duration-200 cursor-pointer flex items-center justify-center gap-2 group"
                  >
                    Enter Operational Control Desk
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition duration-150" />
                  </button>
                  <button
                    onClick={() => { setScreen('auth'); setAuthMode('register'); }}
                    className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-200 hover:text-white font-bold text-xs rounded-xl hover:scale-[1.02] active:scale-98 transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                  >
                    Register New Account
                  </button>
                </>
              )}
            </div>
          </motion.div>

          {/* Three Pillar Core Features Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-16 md:mt-24 text-left">
            {[
              {
                icon: Database,
                title: "Direct MongoDB Synchronization",
                desc: "All transaction structures, user profiles, and metadata records automatically reside dynamically in your MongoDB Atlas cluster state synchronously on startup.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/5",
                border: "hover:border-emerald-500/20"
              },
              {
                icon: Sparkles,
                title: "Gemini Demand Forecasting",
                desc: "Unleash server-side AI generators to forecast customer clustering trends, model inventory risk metrics, and prepare high-fidelity predictive executive reports.",
                color: "text-cyan-400",
                bg: "bg-cyan-500/5",
                border: "hover:border-cyan-500/20"
              },
              {
                icon: Radio,
                title: "Real-Time Log Ingestion Desk",
                desc: "Stream live event parameters directly into your database sandbox, run automated anomalies audits, and execute instant high-frequency KPI recalculations.",
                color: "text-indigo-400",
                bg: "bg-indigo-500/5",
                border: "hover:border-indigo-500/20"
              }
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className={`p-6 bg-slate-900/30 border border-slate-850 rounded-2xl transition duration-300 relative overflow-hidden group ${f.border}`}
              >
                <div className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center mb-4 border border-slate-800`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="text-sm font-extrabold text-white mb-2">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footers */}
        <footer className="border-t border-slate-900/80 bg-slate-950/60 py-6 text-center text-[10px] text-slate-500 font-mono relative z-10 mt-auto">
          &copy; 2026 RetailBI Logistics Intelligence Platform. Integrated with live MongoDB Atlas server instance &amp; Gemini AI APIs.
        </footer>
      </div>
    );
  }

  // Render Auth page if not logged in or screen is 'auth'
  if (!token || screen === 'auth') {
    return (
      <div id="auth-viewport" className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 relative overflow-hidden select-none">
        {/* Abstract background blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[90px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[90px]" />

        <div className="absolute top-6 left-6 relative z-20">
          <button 
            onClick={() => { setScreen('landing'); setLoginError(''); setSignupSuccess(''); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-350 hover:text-white hover:bg-slate-850 hover:border-slate-700 transition duration-150 cursor-pointer font-bold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="max-w-md w-full bg-slate-900/40 border border-slate-800 rounded-2xl p-8 shadow-2xl relative glow-indigo backdrop-blur-md"
        >
          {/* Logo Brand Title */}
          <div className="text-center space-y-2 mb-6">
            <div className="mx-auto w-12 h-12 bg-gradient-to-tr from-cyan-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg font-display shadow-lg shadow-cyan-500/20 font-sans">
              R
            </div>
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">RetailBI platform</h1>
            <p className="text-xs text-slate-400">Enterprise Logistics Analytics &amp; Business Intelligence Engine</p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-850">
            <button
              onClick={() => { setAuthMode('login'); setLoginError(''); setSignupSuccess(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${authMode === 'login' ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-500/25 border border-slate-850 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Log In
            </button>
            <button
              onClick={() => { setAuthMode('register'); setLoginError(''); setSignupSuccess(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${authMode === 'register' ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-500/25 border border-slate-850 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Sign Up
            </button>
          </div>

          {signupSuccess && (
            <div className="mb-6 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2 leading-relaxed">
              <span className="text-emerald-400 font-bold">{signupSuccess}</span>
            </div>
          )}

          {loginError && (
            <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold rounded-xl text-xs">
              ⚠️ {loginError}
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 font-semibold text-xs mb-1.5 uppercase tracking-wide">Corporate Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. administrator@retailbi.com"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold text-xs mb-1.5 uppercase tracking-wide">Security Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingLogin}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 font-bold text-white text-xs shadow-lg shadow-cyan-500/20 active:translate-y-0.5 transition cursor-pointer"
              >
                {loadingLogin ? 'Validating credentials...' : 'Authenticate Credentials'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 font-semibold text-xs mb-1.5 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Evelyn Carter"
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold text-xs mb-1.5 uppercase tracking-wide">Corporate Business Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="e.g. evelyn.carter@retailbi.com"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold text-xs mb-1.5 uppercase tracking-wide">Security Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder-slate-500 text-xs text-white focus:border-cyan-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold text-xs mb-1.5 uppercase tracking-wide">Operations Role</label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-white focus:border-cyan-500 outline-none transition"
                >
                  <option value="Analyst">Logistics Analyst (Data Intelligence)</option>
                  <option value="Admin">Executive Admin (Full CRUD access)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loadingLogin}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 font-bold text-white text-xs shadow-lg shadow-cyan-500/20 active:translate-y-0.5 transition cursor-pointer"
              >
                {loadingLogin ? 'Provisioning user in MongoDB Atlas...' : 'Create Account (Sign Up)'}
              </button>
            </form>
          )}

          {/* Quick-bypass single click login cards */}
          <div className="mt-8 border-t border-slate-800/80 pt-6 space-y-3">
            <span className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider block text-center">Bypass credentials via single click:</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => bypassLogin('admin')}
                className="flex flex-col items-center justify-center p-3 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-xl hover:bg-slate-900 transition-all cursor-pointer text-center group"
              >
                <ShieldCheck className="w-5 h-5 text-indigo-400 mb-1 group-hover:scale-110 duration-200" />
                <span className="text-[11px] font-bold text-slate-200 block">Executive Admin</span>
                <span className="text-[9px] text-slate-550 block">Pass: admin</span>
              </button>

              <button
                onClick={() => bypassLogin('analyst')}
                className="flex flex-col items-center justify-center p-3 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-xl hover:bg-slate-900 transition-all cursor-pointer text-center group"
              >
                <Activity className="w-5 h-5 text-cyan-400 mb-1 group-hover:scale-110 duration-200" />
                <span className="text-[11px] font-bold text-slate-200 block">Logistics Analyst</span>
                <span className="text-[9px] text-slate-555 block">Pass: analyst</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render main operational full layout is authenticated
  const sidebarTabs = [
    { id: 'sales', label: 'Executive Sales', icon: LayoutDashboard },
    { id: 'customers', label: 'Customer Clusters', icon: Users },
    { id: 'inventory', label: 'Inventory Optimizer', icon: PackageSearch },
    { id: 'forecast', label: 'Demand Forecast & AI', icon: LineChart },
    { id: 'realtime', label: 'Live Ticker Stream', icon: Radio },
    { id: 'etl', label: 'ETL Ingestion Desk', icon: FileSpreadsheet }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0F172A] relative select-none">
      {/* Background soft lighting vectors */}
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Modern Sidebar Navigation Deck */}
      <aside className="w-full md:w-64 bg-[#0B1120] border-r border-slate-800 flex flex-col justify-between shrink-0 relative z-10 p-5 md:min-h-screen">
        <div className="space-y-6">
          {/* Brand header */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-900">
            <div className="w-9 h-9 bg-gradient-to-tr from-cyan-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold font-display shadow-md shadow-cyan-500/10">
              R
            </div>
            <div>
              <span className="font-bold font-display text-white text-sm block tracking-tight">RetailBI Enterprise</span>
              <div className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest font-mono">Operations online</span>
              </div>
            </div>
          </div>

          {/* Active Operator Badge details */}
          <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/10 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-slate-200 block truncate">{currentUser?.name}</span>
              <span className="text-[9px] text-slate-500 font-mono block">{currentUser?.role} Mode</span>
            </div>
          </div>

          {/* Tab lists */}
          <nav className="space-y-1">
            {sidebarTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 hover:opacity-95 text-transparent bg-clip-text text-white border-slate-800' 
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  <tab.icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Logout actions */}
        <button
          onClick={handleLogoutAction}
          className="w-full flex items-center gap-3 px-3 py-2 border border-transparent hover:border-slate-850 hover:bg-rose-500/5 text-slate-400 hover:text-rose-400 text-xs font-semibold rounded-xl mt-6 transition duration-200 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Terminate session
        </button>
      </aside>

      {/* Main Core Viewport area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
        <AnimatePresence mode="wait">
          {loadingSummary ? (
            <div className="h-full flex flex-col items-center justify-center py-24 text-slate-500 font-mono text-xs">
              <Sparkles className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
              <span>Fetching dynamic store parameters...</span>
            </div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="max-w-7xl mx-auto h-full"
            >
              {renderViewport()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

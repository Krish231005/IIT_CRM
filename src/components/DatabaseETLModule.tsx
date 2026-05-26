import React, { useState, useEffect } from 'react';
import { ETLLog } from '../types.js';
import { biApi } from '../lib/api.ts';
import { Database, FileCode, CheckCircle, Upload, Table, Terminal, FileText, CloudLightning, Download, Trash2, RotateCcw, FileSpreadsheet, Info, Check } from 'lucide-react';

export function DatabaseETLModule() {
  const [etlLogs, setEtlLogs] = useState<ETLLog[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'done'>('idle');
  const [parsedRowsCount, setParsedRowsCount] = useState(0);

  // Ready delivery snippet tabs
  const [activeTab, setActiveTab] = useState<'docker' | 'sql' | 'dataset' | 'python'>('docker');

  // Custom user dataset integration states
  const [dbStatus, setDbStatus] = useState<{
    products: number;
    customers: number;
    stores: number;
    transactions: number;
    suppliers: number;
    anomalies: number;
    etlLogs: number;
    mongoConnected?: boolean;
    mongoStatus?: string;
    mongoUriConfigured?: boolean;
  }>({
    products: 0,
    customers: 0,
    stores: 0,
    transactions: 0,
    suppliers: 0,
    anomalies: 0,
    etlLogs: 0,
    mongoConnected: false,
    mongoStatus: "Initializing...",
    mongoUriConfigured: false
  });

  const [selectedEntity, setSelectedEntity] = useState<'products' | 'customers' | 'stores' | 'suppliers' | 'transactions'>('products');
  const [entityUploadStatus, setEntityUploadStatus] = useState<'idle' | 'importing' | 'done'>('idle');
  const [importRowsCount, setImportRowsCount] = useState(0);
  const [importError, setImportError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  useEffect(() => {
    fetchLogs();
    fetchDbStatus();
  }, []);

  const fetchLogs = async () => {
    try {
      const logs = await biApi.getSTLogs();
      setEtlLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDbStatus = async () => {
    try {
      const status = await biApi.getDatabaseStatus();
      setDbStatus(status);
    } catch (err) {
      console.error('Failed to retrieve database statistics:', err);
    }
  };

  // Drag and drop CSV upload handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Security Warning: Retail Analytics Standard requires high-frequency CSV spreadsheet files only.');
      return;
    }

    setUploadStatus('parsing');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const log = await biApi.uploadCSV(file.name, content);
        setParsedRowsCount(log.rowsProcessed);
        setUploadStatus('done');
        fetchLogs();
        setTimeout(() => setUploadStatus('idle'), 4000);
      } catch (err) {
        console.error(err);
        alert('ETL Parse error: verify headers structure matches master schemas.');
        setUploadStatus('idle');
      }
    };
    reader.readAsText(file);
  };

  // ============================================
  // DATABASE CUSTOM DATA INTEGRATION FLOWS
  // ============================================
  const handleWipeDb = async () => {
    if (!confirm('⚠️ CRITICAL WARNING:\n\nThis will completely wipe your database storage to a CLEAN SHELL (0 products, 0 customers, 0 transactions).\n\nAre you sure you want to proceed and replace the database with your own custom dataset?')) {
      return;
    }
    try {
      setActionMessage('Discontinuing tables...');
      const res = await biApi.wipeDatabase();
      setActionMessage(res.message);
      await fetchDbStatus();
      await fetchLogs();
      setTimeout(() => setActionMessage(''), 5500);
    } catch (err: any) {
      alert(err.message || 'Wipe failed.');
      setActionMessage('');
    }
  };

  const handleResetDb = async () => {
    if (!confirm('Restore high-fidelity enterprise baseline preset? This will overwrite your active datasets.')) {
      return;
    }
    try {
      setActionMessage('Restoring enterprise baseline data components...');
      const res = await biApi.resetDemoDatabase();
      setActionMessage(res.message);
      await fetchDbStatus();
      await fetchLogs();
      setTimeout(() => setActionMessage(''), 5500);
    } catch (err: any) {
      alert(err.message || 'Reset failed.');
      setActionMessage('');
    }
  };

  const handleExportDb = async () => {
    try {
      const dump = await biApi.exportFullDatabase();
      const stringified = JSON.stringify(dump, null, 2);
      const blob = new Blob([stringified], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `retail_bi_custom_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Backup extraction failed.');
    }
  };

  const handleEntityFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processEntityFile(files[0]);
    }
  };

  const processEntityFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Security Warning: Dataset must be a Comma-Separated Values (.csv) file format.');
      return;
    }

    setEntityUploadStatus('importing');
    setImportError('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const res = await biApi.importDataset(selectedEntity, content);
        setImportRowsCount(res.rowsProcessed);
        setEntityUploadStatus('done');
        await fetchDbStatus();
        await fetchLogs();
        setTimeout(() => setEntityUploadStatus('idle'), 5000);
      } catch (err: any) {
        console.error(err);
        setImportError(err.message || 'Upload failed. Verify column headers exactly match.');
        setEntityUploadStatus('idle');
      }
    };
    reader.readAsText(file);
  };

  const schemasInfo = {
    products: {
      headers: 'id,name,category,price,cost,stock,minRequiredStock,supplierId',
      description: 'The master product lines catalog. Price compiles margins. Links to suppliers.',
      example: `id,name,category,price,cost,stock,minRequiredStock,supplierId
PROD-901,Premium Wool Blazer,Apparel,249.00,80.00,120,40,SUP-102
PROD-902,Wireless ANC Earbuds,Electronics,149.50,65.00,250,55,SUP-100`
    },
    customers: {
      headers: 'id,name,email,segment,recency,frequency,monetary,churnProbability',
      description: 'Enterprise client demographic directories. Feeds direct RFM standard metrics.',
      example: `id,name,email,segment,recency,frequency,monetary,churnProbability
CUST-5001,Krish Chaudhari,krish@enterprise.com,Loyal,2,35,4200.75,4
CUST-5002,Diana Prince,diana@themyscira.gov,Slipping,145,1,120.00,85`
    },
    stores: {
      headers: 'id,name,city,region',
      description: 'Physical brick-and-mortar nodes. Regions must match: Northeast, Midwest, South, West.',
      example: `id,name,city,region
STR-301,Parisian Plaza Flagship,Paris,West
STR-302,Downtown Manhattan Central,New York,Northeast`
    },
    suppliers: {
      headers: 'id,name,contact,category,reliabilityScore',
      description: 'High-frequency manufacturer vendors catalog.',
      example: `id,name,contact,category,reliabilityScore
SUP-201,Pari-Tex Textiles,orders@paritex.fr,Apparel,94
SUP-202,Logitech Global Partners,b2b@logitech.com,Electronics,89`
    },
    transactions: {
      headers: 'id,productId,customerId,storeId,quantity,unitPrice,timestamp',
      description: 'Historical raw streams. Feeds aggregates, predictive models & visual charts.',
      example: `id,productId,customerId,storeId,quantity,unitPrice,timestamp
TXN-90001,PROD-902,CUST-5001,STR-302,2,149.50,2026-05-25T10:14:00Z
TXN-90002,PROD-901,CUST-5002,STR-301,1,249.00,2026-05-25T12:00:15Z`
    }
  };

  const copyTemplateToClipboard = () => {
    navigator.clipboard.writeText(schemasInfo[selectedEntity].example);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  // Ready Deliverable snippets
  const dockerComposeYaml = `version: "3.8"
services:
  postgres-db:
    image: postgres:15-alpine
    container_name: retail_bi_postgres
    environment:
      POSTGRES_USER: retail_admin
      POSTGRES_PASSWORD: SecretEnterprisePassword101
      POSTGRES_DB: retail_bi_analytics
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U retail_admin -d retail_bi_analytics"]
      interval: 10s
      timeout: 5s
      retries: 5

  fastapi-ml-engine:
    build: ./backend
    container_name: retail_bi_ml_server
    command: uvicorn main:app --host 0.0.0.0 --port 8000
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://retail_admin:SecretEnterprisePassword101@postgres-db:5432/retail_bi_analytics
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
    depends_on:
      postgres-db:
        condition: service_healthy

volumes:
  pgdata:`;

  const sqlSchemaSchema = `-- Retail Analytics & Business Intelligence Platform
-- PostgreSQL Relational Database Schema Creation Script

CREATE TABLE stores (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    region VARCHAR(50) CHECK (region IN ('Northeast', 'Midwest', 'South', 'West'))
);

CREATE TABLE suppliers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    category VARCHAR(100),
    reliability_score INT CHECK (reliability_score BETWEEN 0 AND 100)
);

CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    cost NUMERIC(12, 2) NOT NULL,
    stock INT DEFAULT 0,
    min_required_stock INT DEFAULT 50,
    supplier_id VARCHAR(50) REFERENCES suppliers(id)
);

CREATE TABLE customers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    segment VARCHAR(50) DEFAULT 'New',
    recency INT,
    frequency INT,
    monetary NUMERIC(12,2),
    clv NUMERIC(12,2),
    churn_probability NUMERIC(5,2),
    rfm_score VARCHAR(10),
    kmeans_cluster INT
);

CREATE TABLE transactions (
    id VARCHAR(100) PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(id),
    customer_id VARCHAR(50) REFERENCES customers(id),
    store_id VARCHAR(50) REFERENCES stores(id),
    quantity INT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    cost NUMERIC(12, 2) NOT NULL,
    margin NUMERIC(12, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

  const sampleCsvData = `timestamp,productId,customerId,storeId,quantity,unitPrice
2026-05-20T10:14:00Z,PROD-101,CUST-1002,STR-101,2,299
2026-05-20T12:30:15Z,PROD-105,CUST-1015,STR-100,1,18
2026-05-20T15:22:40Z,PROD-102,CUST-1004,STR-103,1,79
2026-05-21T09:12:11Z,PROD-111,CUST-1028,STR-102,1,149
2026-05-21T18:45:00Z,PROD-103,CUST-1001,STR-104,1,249
2026-05-22T11:05:33Z,PROD-121,CUST-1009,STR-105,3,45`;

  const pythonMLClassifier = `import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from statsmodels.tsa.api import ExponentialSmoothing

def run_customer_clustering(df):
    """
    KMeans Customer RFM Segmentation
    """
    features = df[['recency', 'frequency', 'monetary']]
    # Z-Score Standardisation
    normalized = (features - features.mean()) / features.std()
    
    kmeans = KMeans(n_clusters=4, random_state=42)
    df['kmeans_cluster'] = kmeans.fit_predict(normalized)
    return df

def generate_holt_winters_forecast(series, steps=6):
    """
    Triple Exponential demand smoothing projection
    """
    model = ExponentialSmoothing(
        series, 
        seasonal='add', 
        seasonal_periods=4
    ).fit()
    pred = model.forecast(steps)
    return pred`;

  return (
    <div id="etl-and-db-specs" className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Core Drag-And-Drop CSV ingestion Module (Col Span 3) */}
        <div className="lg:col-span-3 bg-[#111827] border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-white tracking-tight flex items-center gap-1.5">
              <Upload className="w-4.5 h-4.5 text-cyan-400" />
              Dynamic ETL Spreadsheet Pipeline
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-sans">
              Drag-and-drop or select any retail transactional CSV spreadsheet dataset to transform schemas and run dynamic KMeans clustering calculations.
            </p>

            {/* Upload Area box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative ${
                dragOver 
                  ? 'border-cyan-400 bg-cyan-500/5 glow-cyan' 
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
              }`}
            >
              <input
                type="file"
                accept=".csv"
                id="csvFileIngest"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />

              {uploadStatus === 'idle' && (
                <div className="space-y-2">
                  <div className="p-3 bg-slate-900 rounded-2xl w-fit mx-auto border border-slate-800 text-slate-400">
                    <Table className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-200">
                    Drag spreadsheet files here or <span className="text-cyan-400 underline">browse computer</span>
                  </p>
                  <span className="text-[10px] text-slate-500 block">Accepts .csv formatting containing transactional matrix headings</span>
                </div>
              )}

              {uploadStatus === 'parsing' && (
                <div className="space-y-2 py-4">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">Cleaning schema, removing duplicates, and compiling KMeans clusters...</p>
                </div>
              )}

              {uploadStatus === 'done' && (
                <div className="space-y-2">
                  <div className="p-3 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-2xl w-fit mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-200">ETL pipeline integration complete!</p>
                  <span className="text-[10px] text-emerald-400 font-mono font-medium block">
                    Successfully loaded {parsedRowsCount} active transaction records to operations clusters.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ETL Audit Log lists */}
          <div className="mt-6 border-t border-slate-850/60 pt-4">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block mb-3">Historical Operational ETL Logs</span>
            <div className="space-y-2 max-h-[140px] overflow-y-auto">
              {etlLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-2.5 bg-slate-950/60 border border-slate-850 rounded-xl text-[10.5px]">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-300 font-mono">{log.id}</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 py-0.25 px-1.5 rounded font-mono font-semibold">Success</span>
                    </div>
                    <p className="text-slate-400 mt-1">{log.summary}</p>
                    <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Filename: {log.fileName}</span>
                  </div>

                  <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap pl-4">{new Date(log.timestamp).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Industrial Ready Deliverable Snippets Frame (Col Span 2) */}
        <div className="lg:col-span-2 bg-[#1E293B] border border-slate-705 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-tight flex items-center gap-1.5 font-mono">
              <Database className="w-4.5 h-4.5 text-indigo-400" />
              SaaS Delivery Assets & Blueprints
            </h3>
            <p className="text-xs text-slate-400 mb-3 font-mono uppercase tracking-[0.05em] text-[10px]">Active postgresql, docker, & models deploy templates</p>

            {/* Selector tabs */}
            <div className="flex items-center gap-2 border-b border-slate-850/60 pb-2.5 text-[10px] font-semibold text-slate-400 overflow-x-auto whitespace-nowrap">
              {[
                { type: 'docker', label: 'docker-compose.yml', icon: CloudLightning },
                { type: 'sql', label: 'retail_schema.sql', icon: FileCode },
                { type: 'dataset', label: 'sample_dataset.csv', icon: FileText },
                { type: 'python', label: 'ML_pipeline.py', icon: Terminal }
              ].map((t) => (
                <button
                  key={t.type}
                  onClick={() => setActiveTab(t.type as any)}
                  className={`flex items-center gap-1 py-1.5 px-2.5 rounded-lg active:translate-y-0.25 duration-150 transition cursor-pointer ${
                    activeTab === t.type 
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10' 
                      : 'hover:bg-slate-950 hover:text-slate-200'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Snippet terminal box */}
            <div className="mt-3 bg-[#0B1120] border border-slate-800 rounded-lg p-3 h-64 overflow-auto font-mono text-[10px] text-emerald-400 relative">
              <pre className="whitespace-pre">{
                activeTab === 'docker' ? dockerComposeYaml :
                activeTab === 'sql' ? sqlSchemaSchema :
                activeTab === 'dataset' ? sampleCsvData :
                pythonMLClassifier
              }</pre>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-750/50 mt-3 text-[10px] text-slate-500 text-center font-mono uppercase tracking-wider">
            Standard files ready for Cloud Run & AWS EC2 deployments
          </div>
        </div>
      </div>

      {/* ============================================
          ENTERPRISE MASTER DATABASE CUSTOM SETUP HUBS
          ============================================ */}
      <div id="enterprise-dataset-console" className="mt-6 border-t border-slate-800 pt-6">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          {/* Neon background grid glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-[80px]" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="p-1 px-2.5 bg-cyan-400/10 text-cyan-400 text-[10px] rounded-full font-mono font-extrabold uppercase tracking-wide">
                  Active Connection Hub
                </span>
                {dbStatus.mongoConnected ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/10">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                    MONGODB ACTIVE: {dbStatus.mongoStatus}
                  </span>
                ) : dbStatus.mongoUriConfigured ? (
                  <span className="text-[10px] text-yellow-500 flex items-center gap-1 font-mono bg-yellow-500/10 px-2.5 py-1 rounded-full border border-yellow-500/10" title={dbStatus.mongoStatus}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping mr-1" />
                    MONGODB OFFLINE (FALLBACK ACTIVE)
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono bg-slate-800/50 px-2.5 py-1 rounded-full border border-slate-800">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500 mr-1" />
                    LOCAL FILEPERSISTENCE ACTIVE
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold font-display text-white mt-2 tracking-tight">Connect Your Custom Datasets with MongoDB</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Wipe preloaded baseline statistics and import your customized relational data files seamlessly. Wire MongoDB Atlas dynamically by configuring <code className="text-cyan-400 font-mono text-[11px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">MONGODB_URI</code> in your applet Secrets panel.
              </p>
            </div>

            {/* Admin Controls panel */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleExportDb}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg border border-slate-805 text-[11px] font-mono font-medium tracking-tight duration-150 active:translate-y-0.25 cursor-pointer"
                title="Download entire current active database back up as JSON"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON Backup
              </button>
              
              <button
                onClick={handleResetDb}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-slate-900 hover:bg-slate-850 text-yellow-500 hover:text-yellow-400 rounded-lg border border-slate-805 text-[11px] font-mono font-medium tracking-tight duration-150 active:translate-y-0.25 cursor-pointer"
                title="Reset active memory to standard 180-days analytics simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Seed Baseline
              </button>

              <button
                onClick={handleWipeDb}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 rounded-lg border border-rose-500/20 text-[11px] font-mono font-medium tracking-tight duration-150 active:translate-y-0.25 cursor-pointer"
                title="Instantly empty all catalog, client, and transaction tables"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Wipe to Clean Shell
              </button>
            </div>
          </div>

          {actionMessage && (
            <div className="mb-5 p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono text-xs rounded-xl flex items-center gap-2 animate-pulse">
              <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          {/* Table Diagnostic Status Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Products Master', count: dbStatus.products, color: 'text-indigo-400 bg-indigo-500/5 border-indigo-500/10' },
              { label: 'Customers Register', count: dbStatus.customers, color: 'text-cyan-400 bg-cyan-500/5 border-cyan-500/10' },
              { label: 'Transactions Stream', count: dbStatus.transactions, color: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10' },
              { label: 'Supplier Logistical', count: dbStatus.suppliers, color: 'text-amber-400 bg-amber-500/5 border-amber-500/10' },
              { label: 'Store Outlets', count: dbStatus.stores, color: 'text-pink-400 bg-pink-500/5 border-pink-500/10' },
              { label: 'System Logs & Audits', count: dbStatus.etlLogs + dbStatus.anomalies, color: 'text-slate-400 bg-slate-500/5 border-slate-500/10' },
            ].map((stat, sIdx) => (
              <div key={sIdx} className={`p-3 rounded-xl border ${stat.color} text-center`}>
                <span className="text-[10px] font-mono font-medium uppercase tracking-wider block opacity-75">{stat.label}</span>
                <span className="text-xl font-bold font-mono tracking-tight block mt-1">{stat.count.toLocaleString()} rows</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Custom File Uploader Section (Col Span 5) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                  1. SELECT TARGET TABULAR ENTITY
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(['products', 'customers', 'transactions', 'suppliers', 'stores'] as const).map((ent) => (
                    <button
                      key={ent}
                      onClick={() => {
                        setSelectedEntity(ent);
                        setImportError('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize active:translate-y-0.25 duration-100 transition cursor-pointer ${
                        selectedEntity === ent
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {ent}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loader Zone */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-5 relative">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  2. INGEST CUSTOM {selectedEntity.toUpperCase()} CSV FILE
                </span>
                <p className="text-[11px] text-slate-400 mb-4">
                  Deploy custom <span className="font-semibold text-slate-200">{selectedEntity}</span> data lines straight into the model server. Pre-existing records matching identical IDs will be updated; foreign keys are resolved dynamically.
                </p>

                <div className="border border-slate-800 hover:border-slate-700 bg-slate-950 rounded-lg p-5 text-center cursor-pointer relative transition-all duration-200">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleEntityFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {entityUploadStatus === 'idle' && (
                    <div className="space-y-1.5 py-2">
                      <FileSpreadsheet className="w-5.5 h-5.5 text-cyan-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-200">
                        Upload <span className="text-cyan-400 font-bold">{selectedEntity}.csv</span>
                      </p>
                      <span className="text-[9.5px] text-slate-500 block">Click to browse your CSV dataset</span>
                    </div>
                  )}

                  {entityUploadStatus === 'importing' && (
                    <div className="space-y-1.5 py-4">
                      <div className="w-6 h-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
                      <p className="text-[11px] text-slate-300">Matching columns, checking constraints & standardizing arrays...</p>
                    </div>
                  )}

                  {entityUploadStatus === 'done' && (
                    <div className="space-y-1 py-2">
                      <CheckCircle className="w-5.5 h-5.5 text-emerald-400 mx-auto animate-bounce" />
                      <p className="text-xs font-bold text-slate-200">Data ingested successfully!</p>
                      <p className="text-[10px] text-emerald-400 font-mono font-medium">
                        Successfully processed and mapped {importRowsCount} custom records.
                      </p>
                    </div>
                  )}
                </div>

                {importError && (
                  <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10.5px] rounded-lg text-left">
                    ⚠️ {importError}
                  </div>
                )}
              </div>
            </div>

            {/* Template Column specifications info (Col Span 7) */}
            <div className="lg:col-span-12 xl:col-span-7 bg-slate-950/60 border border-slate-805 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    3. EXPECTED TABLE SCHEMA DIRECTORY
                  </span>
                  <div className="text-xs font-bold text-white uppercase mt-0.5 font-mono text-cyan-400 flex items-center gap-1.5">
                    Table Mapping: {selectedEntity}
                  </div>
                </div>

                <button
                  onClick={copyTemplateToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 hover:text-white rounded-lg active:translate-y-0.25 duration-100 transition cursor-pointer"
                >
                  {copiedTemplate ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Terminal className="w-3.5 h-3.5 text-cyan-400" />}
                  {copiedTemplate ? 'Copied Template!' : 'Copy Blank CSV Data'}
                </button>
              </div>

              <div className="space-y-3 text-left">
                <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl space-y-1">
                  <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Required Header Names & Ordering aliases:</span>
                  <code className="block bg-[#000000]/40 p-2.5 rounded-lg border border-slate-900 font-mono text-xs text-yellow-300 select-all overflow-x-auto whitespace-pre">
                    {schemasInfo[selectedEntity].headers}
                  </code>
                </div>

                <div className="text-[11px] text-slate-400">
                  <p className="font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                    Schema Constraints & Business Logic:
                  </p>
                  <p className="font-mono text-[10px] bg-[#000000]/20 p-2 border border-slate-905 rounded-md text-slate-350">
                    {schemasInfo[selectedEntity].description}
                  </p>
                </div>

                <div>
                  <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-widest block mb-1 font-bold font-mono">Mockup CSV File Content preview:</span>
                  <div className="bg-[#0B1120] border border-slate-850 p-3.5 rounded-xl h-36 overflow-auto font-mono text-[10.5px] text-emerald-400 block relative">
                    <pre className="whitespace-pre">{schemasInfo[selectedEntity].example}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

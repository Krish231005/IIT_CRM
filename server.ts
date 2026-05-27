import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { serverDb } from './src/lib/serverDb.ts';
import {
  askFreeformAIQuery,
  getDailyKPIOptimizerReport,
  getForecastExplanationReport,
  getInventoryOptimizationDirectives,
  getChurnPreventionActionBrief
} from './src/lib/geminiService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Await MongoDB initialization on boot if URI is configured
  if (process.env.MONGODB_URI) {
    console.log("🔌 Wait for MongoDB Atlas Connection and Schema synchronization...");
    try {
      await serverDb.connectAndSync();
      console.log("🟢 Ready: MongoDB startup synchronization completed successfully.");
    } catch (err) {
      console.error("⚠️ Failed to synchronize MongoDB Atlas on boot: ", err);
    }
  }

  // Basic Middlewares
  app.use(express.json({ limit: '10mb' }));

  // Custom logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // ============================================
  // 1. AUTHENTICATION SYSTEM
  // ============================================
  // Register Account endpoint
  app.post('/api/auth/register', (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Please populate name, email, and password.' });
      }

      if (!email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid business email address.' });
      }

      const emailLower = email.toLowerCase().trim();
      const existingUser = serverDb.users.find(u => u.email.toLowerCase() === emailLower);
      if (existingUser) {
        return res.status(409).json({ error: 'This corporate email address is already registered.' });
      }

      const userRole = role === 'Analyst' || role === 'Admin' ? role : (emailLower.includes('analyst') ? 'Analyst' : 'Admin');
      const newUser = {
        id: `USR-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        email: emailLower,
        password: password,
        role: userRole,
        createdAt: new Date().toISOString()
      };

      serverDb.users.push(newUser);
      serverDb.saveToDisk();

      res.status(201).json({
        success: true,
        message: 'Account registered successfully.',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Role-Based Login endpoint
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid business email address.' });
      }

      const emailLower = email.toLowerCase().trim();
      
      // Look up in database
      const user = serverDb.users.find(u => u.email.toLowerCase() === emailLower);

      if (!user) {
        return res.status(401).json({ error: 'Authentication failed. No account registered with this email address.' });
      }

      // Check password (for demo purposes, simple check is used)
      if (password && user.password !== password) {
        return res.status(401).json({ error: 'Authentication failed. Incorrect password credentials.' });
      }

      res.json({
        token: `jwt-retailbi-security-token-${Date.now()}`,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // 2. EXECUTIVE CORE BI ENDPOINTS
  // ============================================
  // Dashboard Aggregates summary
  app.get('/api/dashboard/summary', (req, res) => {
    try {
      const summary = serverDb.getDashboardSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Demand Forecast endpoints
  app.get('/api/dashboard/forecast', (req, res) => {
    try {
      const forecast = serverDb.generateDemandForecast();
      res.json(forecast);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // 3. RETAIL DATA MANAGEMENT (CRUD + PAGINATION)
  // ============================================
  // GET Customers
  app.get('/api/customers', (req, res) => {
    try {
      const search = (req.query.search as string || '').toLowerCase();
      const segment = req.query.segment as string || '';
      const region = req.query.region as string || '';
      const preferredCategory = req.query.preferredCategory as string || '';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;

      let filtered = serverDb.customers;

      if (search) {
        filtered = filtered.filter(c => c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search));
      }
      if (segment) {
        filtered = filtered.filter(c => c.segment === segment);
      }
      if (region) {
        filtered = filtered.filter(c => c.region === region);
      }
      if (preferredCategory) {
        filtered = filtered.filter(c => c.preferredCategory === preferredCategory);
      }

      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      res.json({
        data: paginated,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET Product Catalog
  app.get('/api/products', (req, res) => {
    try {
      const search = (req.query.search as string || '').toLowerCase();
      const category = req.query.category as string || '';
      const region = req.query.region as string || '';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;

      let filtered = serverDb.products;

      if (search) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search));
      }
      if (category) {
        filtered = filtered.filter(p => p.category === category);
      }
      if (region) {
        filtered = filtered.filter(p => p.region === region);
      }

      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      res.json({
        data: paginated,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // CREATE Product
  app.post('/api/products', (req, res) => {
    try {
      const { name, category, price, cost, stock, minRequiredStock, supplierId, region } = req.body;

      if (!name || !category || isNaN(price) || isNaN(cost) || isNaN(stock)) {
        return res.status(400).json({ error: 'Please populate all product fields correctly.' });
      }

      const newProduct = {
        id: `PROD-${Date.now().toString().slice(-4)}`,
        name,
        category,
        price: Number(price),
        cost: Number(cost),
        stock: Number(stock),
        minRequiredStock: Number(minRequiredStock) || 50,
        supplierId: supplierId || 'SUP-101',
        region: region || 'West'
      };

      serverDb.products.unshift(newProduct);
      serverDb.recomputeAnalytics();
      serverDb.saveToDisk();
      res.status(201).json(newProduct);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // UPDATE Product
  app.put('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, category, price, cost, stock, minRequiredStock, region } = req.body;

      const idx = serverDb.products.findIndex(p => p.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Product SKU does not exist in master catalog.' });
      }

      const existing = serverDb.products[idx];
      serverDb.products[idx] = {
        ...existing,
        name: name || existing.name,
        category: category || existing.category,
        price: price !== undefined ? Number(price) : existing.price,
        cost: cost !== undefined ? Number(cost) : existing.cost,
        stock: stock !== undefined ? Number(stock) : existing.stock,
        minRequiredStock: minRequiredStock !== undefined ? Number(minRequiredStock) : existing.minRequiredStock,
        region: region || existing.region || 'West'
      };

      serverDb.recomputeAnalytics();
      serverDb.saveToDisk();
      res.json(serverDb.products[idx]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE Product
  app.delete('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = serverDb.products.findIndex(p => p.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Product SKU does not exist in master catalog.' });
      }

      serverDb.products.splice(idx, 1);
      serverDb.recomputeAnalytics();
      serverDb.saveToDisk();
      res.json({ success: true, message: 'SKU product line discontinued.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // 3.5 MANUAL ACTIONS (CREATE TRANSACTION AND REGISTER CUSTOMERS)
  // ============================================
  // CREATE Customer manually
  app.post('/api/customers', (req, res) => {
    try {
      const { name, email, segment, region, preferredCategory } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Please populate customer name and email.' });
      }
      
      const emailLower = email.toLowerCase().trim();
      const existingUser = serverDb.customers.find(c => c.email.toLowerCase() === emailLower);
      if (existingUser) {
        return res.status(400).json({ error: 'A customer profile is already registered under this email.' });
      }

      const newCustomer = {
        id: `CUST-MAN-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        email: emailLower,
        segment: segment || 'New',
        recency: 0,
        frequency: 0,
        monetary: 0,
        clv: 0,
        churnProbability: 5,
        rfmScore: '311',
        cluster: 3,
        region: region || 'West',
        preferredCategory: preferredCategory || 'Electronics'
      };
      
      serverDb.customers.unshift(newCustomer);
      serverDb.recomputeAnalytics();
      serverDb.saveToDisk();
      res.status(201).json(newCustomer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // RECORD/CREATE transaction manually (Register Trade/Sale)
  app.post('/api/transactions', (req, res) => {
    try {
      const { productId, customerId, storeId, quantity } = req.body;
      if (!productId || !customerId || !storeId || isNaN(quantity)) {
        return res.status(400).json({ error: 'Missing transaction values: productId, customerId, storeId, and numeric quantity are mandatory.' });
      }

      const product = serverDb.products.find(p => p.id === productId);
      const customer = serverDb.customers.find(c => c.id === customerId);
      const store = serverDb.stores.find(s => s.id === storeId);

      if (!product) {
        return res.status(404).json({ error: 'Product SKU not found in inventory catalog.' });
      }
      if (!customer) {
        return res.status(404).json({ error: 'Customer Profile not found in directory database.' });
      }
      if (!store) {
        return res.status(404).json({ error: 'Store node not found in routing layout.' });
      }

      const qty = parseInt(quantity);
      if (qty <= 0) {
        return res.status(400).json({ error: 'Quantity must be at least 1 unit.' });
      }

      // Check stock and decrement it
      product.stock = Math.max(0, product.stock - qty);

      const totalRevenue = product.price * qty;
      const totalCost = product.cost * qty;
      const margin = totalRevenue - totalCost;

      const newTxn = {
        id: `TXN-MAN-${Date.now().toString().slice(-6)}`,
        productId: product.id,
        customerId: customer.id,
        storeId: store.id,
        quantity: qty,
        unitPrice: product.price,
        totalPrice: totalRevenue,
        cost: totalCost,
        margin: margin,
        timestamp: new Date().toISOString()
      };

      serverDb.transactions.unshift(newTxn);
      serverDb.recomputeAnalytics();
      serverDb.saveToDisk();

      res.status(201).json({
        success: true,
        transaction: newTxn,
        productUpdated: product
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // 4. LOGISTICAL ANOMALIES & AUDITING
  // ============================================
  app.get('/api/anomalies', (req, res) => {
    try {
      res.json(serverDb.anomalies);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/anomalies/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const anomaly = serverDb.anomalies.find(a => a.id === id);
      if (!anomaly) {
        return res.status(404).json({ error: 'Anomaly alert not found.' });
      }
      anomaly.status = status;
      serverDb.saveToDisk();
      res.json(anomaly);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // 5. COLLABORATIVE FILTERING RECOMMENDATIONS
  // ============================================
  app.get('/api/recommendations/:customerId', (req, res) => {
    try {
      const { customerId } = req.params;
      const recs = serverDb.getCollaborativeRecommendations(customerId, 5);
      res.json(recs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // 6. REAL-TIME LIVE STREAM TICKER
  // ============================================
  app.get('/api/realtime/tick', (req, res) => {
    try {
      const result = serverDb.mockNewTransaction();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // 7. ETL CSV DATA PIPELINE & CUSTOM DATABASE MGMT
  // ============================================
  app.get('/api/etl/logs', (req, res) => {
    res.json(serverDb.etlLogs);
  });

  app.post('/api/etl/upload', (req, res) => {
    try {
      const { fileName, csvContent } = req.body;
      if (!csvContent) {
        return res.status(400).json({ error: 'Invalid file payload: CSV content body is empty.' });
      }

      const log = serverDb.processCSVETL(fileName || 'generic_upload.csv', csvContent);
      res.json(log);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // WIPE full DB
  app.post('/api/database/wipe', (req, res) => {
    try {
      serverDb.wipeDatabase();
      res.json({ success: true, message: 'Database cleared completely to a clean slate.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // RESET baseline demo DB
  app.post('/api/database/reset', (req, res) => {
    try {
      serverDb.resetDemoDatabase();
      res.json({ success: true, message: 'Baseline high-fidelity analytics catalog successfully restored.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // IMPORT any dataset category
  app.post('/api/database/import', (req, res) => {
    try {
      const { entity, csvContent } = req.body;
      if (!entity || !csvContent) {
        return res.status(400).json({ error: 'Missing target entity or CSV contents parameter.' });
      }
      const result = serverDb.importEntityCSV(entity, csvContent);
      if (!result.success) {
        return res.status(400).json({ error: result.errors.join(', ') });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DIAGNOSTIC stats for all entities
  app.get('/api/database/status', (req, res) => {
    try {
      res.json({
        products: serverDb.products.length,
        customers: serverDb.customers.length,
        stores: serverDb.stores.length,
        transactions: serverDb.transactions.length,
        suppliers: serverDb.suppliers.length,
        anomalies: serverDb.anomalies.length,
        etlLogs: serverDb.etlLogs.length,
        mongoConnected: serverDb.isMongoConnected,
        mongoStatus: serverDb.mongoStatusMessage,
        mongoUriConfigured: !!process.env.MONGODB_URI,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // EXPORT full active db as JSON backup
  app.get('/api/database/backup', (req, res) => {
    try {
      const data = {
        products: serverDb.products,
        customers: serverDb.customers,
        stores: serverDb.stores,
        transactions: serverDb.transactions,
        suppliers: serverDb.suppliers,
        etlLogs: serverDb.etlLogs,
        anomalies: serverDb.anomalies
      };
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // 8. GEMINI AI NATURAL LANGUAGE DIRECTIVES
  // ============================================
  app.post('/api/ai/query', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'NLI prompt text is required.' });
      }
      const response = await askFreeformAIQuery(prompt);
      res.json({ response });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Preset Specialist Reports Routing
  app.post('/api/ai/preset-report', async (req, res) => {
    try {
      const { type } = req.body;
      let review = '';
      switch (type) {
        case 'daily-kpi':
          review = await getDailyKPIOptimizerReport();
          break;
        case 'inventory-opt':
          review = await getInventoryOptimizationDirectives();
          break;
        case 'churn-prevention':
          review = await getChurnPreventionActionBrief();
          break;
        case 'forecast-analysis':
          review = await getForecastExplanationReport();
          break;
        default:
          review = await getDailyKPIOptimizerReport();
      }
      res.json({ response: review });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Expose suppliers/stores for standard references
  app.get('/api/stores', (req, res) => res.json(serverDb.stores));
  app.get('/api/suppliers', (req, res) => res.json(serverDb.suppliers));

  // ============================================
  // 9. CLIENT BUNDLE SERVING (VITE / STATIC)
  // ============================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Retail Analytics Engine fully loaded.`);
    console.log(`🌎 Live Port Ingress: http://localhost:${PORT}`);
  });
}

startServer();

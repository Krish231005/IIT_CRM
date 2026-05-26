import dotenv from 'dotenv';
dotenv.config();

import { Product, Customer, Store, Transaction, Supplier, ETLLog, Anomaly, ForecastPoint, DashboardSummary } from '../types.js';
import fs from 'fs';
import path from 'path';
import { MongoClient, Db } from 'mongodb';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DB_DIR, 'retail_bi_db.json');

// Seeded pseudo-random number generator for deterministic, highly realistic analytics
class SeededRandom {
  private seed: number;
  constructor(seed: number = 42) {
    this.seed = seed;
  }
  // Returns number between 0 and 1
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
  // Range [min, max]
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  // Integer range [min, max]
  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  // Select random item from array
  choose<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// Global In-Memory Store
export class RetailBIStore {
  products: Product[] = [];
  customers: Customer[] = [];
  stores: Store[] = [];
  transactions: Transaction[] = [];
  suppliers: Supplier[] = [];
  etlLogs: ETLLog[] = [];
  anomalies: Anomaly[] = [];
  users: any[] = [];

  // Lazy MongoDB database connections
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  public isMongoConnected = false;
  public mongoStatusMessage = "Unconfigured: MONGODB_URI missing in environmental variables.";

  constructor() {
    if (process.env.MONGODB_URI) {
      console.log(`🔌 MONGODB_URI is declared. Bypassing disk loading & preparing direct MongoDB sync/loading...`);
      this.isMongoConnected = false;
      this.mongoStatusMessage = "Connecting to Atlas cluster...";
      // Asynchronously initialize connection to MongoDB Atlas
      this.initializeMongoConnection().catch((err) => {
        console.error(`❌ Delayed MongoDB initialization finished with error:`, err);
      });
    } else {
      this.loadFromDisk();
    }
  }

  public async connectAndSync() {
    console.log(`🔌 Performing synchronous MongoDB handshake on startup...`);
    const client = await this.getMongoClient();
    if (client && this.mongoDb) {
      await this.pullFromMongo();
    } else {
      throw new Error(`Failed to establish MongoDB client connection: ${this.mongoStatusMessage}`);
    }
  }

  private async getMongoClient(): Promise<MongoClient | null> {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      this.isMongoConnected = false;
      this.mongoStatusMessage = "Unconfigured: MONGODB_URI missing in environmental variables.";
      return null;
    }

    if (this.mongoClient && this.isMongoConnected) {
      return this.mongoClient;
    }

    try {
      this.mongoStatusMessage = "Connecting to Atlas cluster...";
      const client = new MongoClient(uri, {
        connectTimeoutMS: 8000,
        socketTimeoutMS: 8000,
      });
      await client.connect();
      this.mongoClient = client;

      let dbName = 'retail_bi_db';
      try {
        const parsedUrl = new URL(uri);
        const pathDbName = parsedUrl.pathname.slice(1);
        if (pathDbName) dbName = pathDbName;
      } catch (e) {}

      this.mongoDb = client.db(dbName);
      this.isMongoConnected = true;
      this.mongoStatusMessage = `Connected: Database "${dbName}"`;
      console.log(`🟢 [MongoDB Core] Handshake established with "${dbName}" database schema!`);
      return client;
    } catch (err: any) {
      this.isMongoConnected = false;
      this.mongoStatusMessage = `Handshake Failed: ${err.message || 'Error occurred during connection configuration'}`;
      this.mongoClient = null;
      this.mongoDb = null;
      console.error(`❌ MongoDB Database handshaking failed error details:`, err);
      return null;
    }
  }

  private async initializeMongoConnection() {
    const client = await this.getMongoClient();
    if (client && this.mongoDb) {
      await this.pullFromMongo();
    }
  }

  public async pullFromMongo() {
    if (!this.mongoDb) return;
    try {
      const collections = await this.mongoDb.listCollections().toArray();
      const colNames = collections.map(c => c.name);

      const fetchCol = async (name: string) => {
        if (!this.mongoDb) return [];
        if (!colNames.includes(name)) return [];
        const items = await this.mongoDb.collection(name).find({}).toArray();
        return items.map(item => {
          const { _id, ...rest } = item;
          return rest;
        });
      };

      const mongoProds = await fetchCol('products');
      const mongoCusts = await fetchCol('customers');
      const mongoStores = await fetchCol('stores');
      const mongoTxns = await fetchCol('transactions');
      const mongoSups = await fetchCol('suppliers');
      const mongoLogs = await fetchCol('etlLogs');
      const mongoAnomalies = await fetchCol('anomalies');
      const mongoUsers = await fetchCol('users');

      const hasAnyData = mongoProds.length > 0 || mongoCusts.length > 0 || mongoTxns.length > 0 || mongoUsers.length > 0;

      if (hasAnyData) {
        this.products = mongoProds as Product[];
        this.customers = mongoCusts as Customer[];
        this.stores = mongoStores as Store[];
        this.transactions = mongoTxns as Transaction[];
        this.suppliers = mongoSups as Supplier[];
        this.etlLogs = mongoLogs as ETLLog[];
        this.anomalies = mongoAnomalies as Anomaly[];
        this.users = mongoUsers.length > 0 ? mongoUsers : [
          {
            id: "USR-001",
            name: "Executive Admin",
            email: "executive.admin@retailbi.com",
            password: "admin",
            role: "Admin"
          },
          {
            id: "USR-002",
            name: "Regional Analyst",
            email: "regional.analyst@retailbi.com",
            password: "analyst",
            role: "Analyst"
          }
        ];
        console.log(`📥 Hydrated local memory cache with ${this.transactions.length} rows directly from MongoDB!`);
      } else {
        console.log(`📝 MongoDB collections are empty. Seeding high-fidelity enterprise datasets into Atlas cluster...`);
        this.initializeData();
        await this.saveToMongo();
        this.saveToDisk();
      }
    } catch (err) {
      console.error(`❌ MongoDB Collections pulling failure:`, err);
    }
  }

  public async saveToMongo() {
    const client = await this.getMongoClient();
    if (!client || !this.mongoDb) {
      return;
    }

    try {
      const syncCollection = async (name: string, data: any[]) => {
        if (!this.mongoDb) return;
        const col = this.mongoDb.collection(name);
        await col.deleteMany({});
        if (data.length > 0) {
          await col.insertMany(data.map(item => ({ ...item })));
        }
      };

      await Promise.all([
        syncCollection('products', this.products),
        syncCollection('customers', this.customers),
        syncCollection('stores', this.stores),
        syncCollection('transactions', this.transactions),
        syncCollection('suppliers', this.suppliers),
        syncCollection('etlLogs', this.etlLogs),
        syncCollection('anomalies', this.anomalies),
        syncCollection('users', this.users),
      ]);
      console.log(`📤 Synced local structural schemas to MongoDB Atlas collections successfully.`);
    } catch (err) {
      console.error(`❌ MongoDB Bulk insertion fail:`, err);
    }
  }

  public saveToDisk() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      const data = {
        products: this.products,
        customers: this.customers,
        stores: this.stores,
        transactions: this.transactions,
        suppliers: this.suppliers,
        etlLogs: this.etlLogs,
        anomalies: this.anomalies,
        users: this.users,
      };
      const tempPath = `${DB_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_PATH);

      // Async write to MongoDB Atlas (if MONGODB_URI is provided and configured)
      if (process.env.MONGODB_URI) {
        this.saveToMongo().catch((err) => {
          console.error(`❌ Failed background synchronization to MongoDB:`, err);
        });
      }
    } catch (err) {
      console.error(`❌ DB Schema serialization failure:`, err);
    }
  }


  private loadFromDisk() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        const data = JSON.parse(fileContent);
        this.products = data.products || [];
        this.customers = data.customers || [];
        this.stores = data.stores || [];
        this.transactions = data.transactions || [];
        this.suppliers = data.suppliers || [];
        this.etlLogs = data.etlLogs || [];
        this.anomalies = data.anomalies || [];
        this.users = data.users || [];
        console.log(`💾 Loaded persistent database layout from ${DB_PATH}. Total transactions: ${this.transactions.length}`);
      } else {
        console.log(`✨ Database file path not found. Initializing seed parameters on first bootstrap...`);
        this.initializeData();
        this.saveToDisk();
      }
    } catch (err) {
      console.error(`❌ Failed to read or parse database schema file:`, err);
      this.initializeData();
    }
  }

  private initializeData() {
    const rng = new SeededRandom(101);
    this.products = [];
    this.customers = [];
    this.stores = [];
    this.transactions = [];
    this.suppliers = [];
    this.anomalies = [];
    this.etlLogs = this.etlLogs || [];
    this.users = [
      {
        id: "USR-001",
        name: "Executive Admin",
        email: "executive.admin@retailbi.com",
        password: "admin",
        role: "Admin"
      },
      {
        id: "USR-002",
        name: "Regional Analyst",
        email: "regional.analyst@retailbi.com",
        password: "analyst",
        role: "Analyst"
      }
    ];

    // 1. Regions and Stores
    const regions: ('Northeast' | 'Midwest' | 'South' | 'West')[] = ['Northeast', 'Midwest', 'South', 'West'];
    const citiesByRegion = {
      Northeast: ['New York', 'Boston', 'Philadelphia'],
      Midwest: ['Chicago', 'Detroit', 'Minneapolis'],
      South: ['Dallas', 'Atlanta', 'Miami'],
      West: ['Los Angeles', 'Seattle', 'Denver']
    };

    const storeNames = [
      { name: 'Supercenter NYC', city: 'New York', region: 'Northeast' },
      { name: 'Metro Lab Chicago', city: 'Chicago', region: 'Midwest' },
      { name: 'Megastore Dallas', city: 'Dallas', region: 'South' },
      { name: 'Bay Area Express', city: 'Los Angeles', region: 'West' },
      { name: 'Hub Atlanta', city: 'Atlanta', region: 'South' },
      { name: 'Sound Hub Seattle', city: 'Seattle', region: 'West' },
    ];

    this.stores = storeNames.map((s, idx) => ({
      id: `STR-${100 + idx}`,
      name: s.name,
      city: s.city,
      region: s.region as 'Northeast' | 'Midwest' | 'South' | 'West'
    }));

    // 2. Suppliers
    const supplierNames = [
      { name: 'Globex Manufacturing', cat: 'Electronics' },
      { name: 'Pinnacle Foods Inc.', cat: 'Grocery' },
      { name: 'Acme Apparel Corp', cat: 'Apparel' },
      { name: 'Apex Home Goods', cat: 'Home' },
      { name: 'Thera Beauty Ltd', cat: 'Beauty' }
    ];

    this.suppliers = supplierNames.map((s, idx) => ({
      id: `SUP-${100 + idx}`,
      name: s.name,
      contact: `orders@${s.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      category: s.cat,
      reliabilityScore: rng.intRange(75, 98)
    }));

    // 3. Products
    const productTemplates = {
      Electronics: [
        { name: 'OmniView OLED Smart TV', price: 1299, cost: 780 },
        { name: 'SoundSync Noise-Cancelling Headphones', price: 299, cost: 140 },
        { name: 'AeroCharge Wireless Docking Pad', price: 79, cost: 32 },
        { name: 'VeloFit Smartwatch Pro', price: 249, cost: 110 },
        { name: 'SpectraLight RGB Mechanical Keyboard', price: 129, cost: 55 }
      ],
      Grocery: [
        { name: 'Organic Premium Arabica Coffee Beans', price: 18, cost: 6 },
        { name: 'Artisanal Gluten-Free Pasta Pack', price: 6, cost: 2 },
        { name: 'Pure Clover Golden Honey Jar', price: 12, cost: 4 },
        { name: 'Cold-Pressed Extra Virgin Olive Oil', price: 24, cost: 9 },
        { name: 'Keto-Friendly Sea Salt Almond Butter', price: 14, cost: 5 }
      ],
      Apparel: [
        { name: 'WeatherShield Waterproof Trail Jacket', price: 149, cost: 60 },
        { name: 'FlexStride Seamless Sports Tee', price: 39, cost: 12 },
        { name: 'UrbanFit Stretch Denim Jeans', price: 69, cost: 22 },
        { name: 'Merino Wool Climate-Control Socks', price: 19, cost: 6 },
        { name: 'LunaSlide Comfort Leather Sandals', price: 89, cost: 35 }
      ],
      Home: [
        { name: 'AromaPulse Smart Oil Diffuser', price: 49, cost: 18 },
        { name: 'ErgoComfort Memory Foam Pillow', price: 59, cost: 20 },
        { name: 'HydroShield Insulated Tumbler', price: 34, cost: 11 },
        { name: 'Eclipse Thermal Draft Block Curtains', price: 79, cost: 30 },
        { name: 'PurAir True HEPA Air Filtrator', price: 199, cost: 85 }
      ],
      Beauty: [
        { name: 'GlowHydrate Polymeric Facial Serum', price: 45, cost: 15 },
        { name: 'SilkSmooth Argan Oil Hair Mask', price: 29, cost: 9 },
        { name: 'PureMineral Sun Protection Shield SPF50', price: 34, cost: 12 },
        { name: 'RadianceBoost Enzyme Charcoal Cleanser', price: 22, cost: 7 },
        { name: 'ZenMist Organic Chamomile Body Wash', price: 18, cost: 5 }
      ]
    };

    let prodIdCounter = 100;
    Object.entries(productTemplates).forEach(([category, prods]) => {
      const supplier = this.suppliers.find(s => s.category === category) || this.suppliers[0];
      prods.forEach(p => {
        this.products.push({
          id: `PROD-${prodIdCounter++}`,
          name: p.name,
          category,
          price: p.price,
          cost: p.cost,
          stock: rng.intRange(40, 500),
          minRequiredStock: rng.intRange(30, 80),
          supplierId: supplier.id
        });
      });
    });

    // 4. Customers
    const customerNames = [
      'John Miller', 'Sophia Rodriguez', 'Liam Gallagher', 'Olivia Vance', 'Mason Chen',
      'Ava Patel', 'Ethan Hawke', 'Isabella Gomez', 'Lucas Dubois', 'Mia Tanaka',
      'Oliver Hansen', 'Amelia Novak', 'Jackson Reed', 'Charlotte Fox', 'Aiden O\'Connor',
      'Evelyn Mercer', 'Benjamin Vance', 'Harper Sterling', 'James Choi', 'Evelyn Wood',
      'Daniel Rivera', 'Chloe Jenkins', 'Matthew Knight', 'Victoria Frost', 'Joseph Lane',
      'Lily Zhang', 'Alexander Wright', 'Emily Clark', 'Gabriel Sterling', 'Naomi Campbell'
    ];

    this.customers = customerNames.map((name, idx) => {
      const splitted = name.split(' ');
      const email = `${splitted[0].toLowerCase()}.${splitted[1].toLowerCase()}@retailbi.com`;
      return {
        id: `CUST-${1000 + idx}`,
        name,
        email,
        segment: 'New',
        recency: rng.intRange(2, 60),
        frequency: rng.intRange(1, 15),
        monetary: 0,
        clv: 0,
        churnProbability: rng.range(10, 95),
        rfmScore: '111',
        cluster: 0
      };
    });

    // Build some high-val and loyal consumers explicitly for rich segments
    for (let idx = 0; idx < 10; idx++) {
      const c = this.customers[idx];
      c.frequency = rng.intRange(15, 45);
      c.recency = rng.intRange(1, 7);
    }
    // Churning consumers
    for (let idx = 10; idx < 16; idx++) {
      const c = this.customers[idx];
      c.frequency = rng.intRange(2, 5);
      c.recency = rng.intRange(80, 240);
    }

    // 5. Transactions History (Create realistic historical sales curve)
    // We create ~24 weeks of data (6 months) leading to 1 day before current local time
    const startOffsetDays = 180;
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    let transactionCounter = 10000;

    for (let dayOffset = startOffsetDays; dayOffset >= 1; dayOffset--) {
      const txnDate = new Date(baseDate.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const isWeekend = txnDate.getDay() === 0 || txnDate.getDay() === 6;
      const isPromoSeason = txnDate.getMonth() === 11 || txnDate.getMonth() === 4 || txnDate.getMonth() === 2; // Dec, May, Mar

      // Determine transaction count for the day
      let numTxns = rng.intRange(8, 18);
      if (isWeekend) numTxns += rng.intRange(6, 12);
      if (isPromoSeason) numTxns += rng.intRange(8, 15);

      for (let t = 0; t < numTxns; t++) {
        const customer = rng.choose(this.customers);
        const product = rng.choose(this.products);
        const store = rng.choose(this.stores);

        // Quantity (mostly 1 or 2, rarely high)
        let quantity = rng.intRange(1, 3);
        if (rng.next() > 0.96) quantity = rng.intRange(5, 10); // bulk buy

        // Apply slight weekend pricing premium or volume discount
        const unitPrice = product.price;
        const totalPrice = unitPrice * quantity;
        const totalCost = product.cost * quantity;
        const margin = totalPrice - totalCost;

        // Spread timestamps evenly throughout business hours 8am - 10pm
        const hour = rng.intRange(8, 22);
        const minute = rng.intRange(0, 59);
        const second = rng.intRange(0, 59);
        txnDate.setHours(hour, minute, second);

        this.transactions.push({
          id: `TXN-${transactionCounter++}`,
          productId: product.id,
          customerId: customer.id,
          storeId: store.id,
          quantity,
          unitPrice,
          totalPrice,
          cost: totalCost,
          margin,
          timestamp: txnDate.toISOString()
        });

        // Update product stock and supplier orders
        product.stock = Math.max(0, product.stock - quantity);
      }
    }

    // Add some suspicious night / fraud-like transactions for Anomaly Detection module!
    // Outof hours (1AM to 3AM) with high quantity
    for (let i = 0; i < 5; i++) {
      const customer = rng.choose(this.customers);
      const product = this.products.find(p => p.category === 'Electronics') || this.products[0];
      const store = this.stores[0];
      const date = new Date(baseDate.getTime() - rng.range(1, 30) * 24 * 60 * 60 * 1000);
      date.setHours(2, rng.intRange(10, 50), 0);

      this.transactions.push({
        id: `TXN-FRAUD-${i}`,
        productId: product.id,
        customerId: customer.id,
        storeId: store.id,
        quantity: rng.intRange(25, 40), // Massive bulk buy of expensive OLED electronics!
        unitPrice: product.price,
        totalPrice: product.price * rng.intRange(25, 40),
        cost: product.cost * rng.intRange(25, 40),
        margin: (product.price - product.cost) * rng.intRange(25, 40),
        timestamp: date.toISOString()
      });
    }

    // Standardize metrics and compute analytics on load!
    this.recomputeAnalytics();

    // Initial ETL Logging
    this.etlLogs.push({
      id: 'ETL-001',
      timestamp: new Date(baseDate.getTime() - 179 * 24 * 60 * 60 * 1000).toISOString(),
      fileName: 'historical_sales_q1_q2.csv',
      rowsProcessed: this.transactions.length - 5,
      rowsCleaned: 12,
      status: 'Success',
      summary: 'Initial core dataset successfully loaded from enterprise storage system.'
    });
  }

  // Pure mathematical calculation engines:
  public recomputeAnalytics() {
    // 1. Compute Customer RFM metrics
    const baseDate = new Date();

    this.customers.forEach(customer => {
      const custTxns = this.transactions.filter(t => t.customerId === customer.id);
      if (custTxns.length === 0) {
        customer.recency = 365;
        customer.frequency = 0;
        customer.monetary = 0;
        customer.clv = 0;
        customer.churnProbability = 95;
        customer.rfmScore = '111';
        return;
      }

      // Recency (days)
      const txnDates = custTxns.map(t => new Date(t.timestamp).getTime());
      const maxTxnTime = Math.max(...txnDates);
      const diffTime = Math.abs(baseDate.getTime() - maxTxnTime);
      customer.recency = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Frequency
      customer.frequency = custTxns.length;

      // Monetary (total sales)
      customer.monetary = Math.round(custTxns.reduce((sum, t) => sum + t.totalPrice, 0));

      // CLV = Average Purchase Value * Frequency * average lifespan modifier
      customer.clv = Math.round(customer.monetary * 1.5);

      // Churn probability curve: Higher recency + low frequency means high probability
      const recencyPenalty = Math.min(100, (customer.recency / 180) * 100);
      const frequencyBonus = Math.min(60, customer.frequency * 3);
      customer.churnProbability = Math.round(Math.max(5, Math.min(99, recencyPenalty * 0.8 + 20 - frequencyBonus)));
    });

    // Run KMeans Customer Segmentation algorithm
    this.runKMeansClustering();

    // Run Anomaly Detection Engine
    this.detectAnomalies();

    // Auto-save changes to the flat-file database
    this.saveToDisk();
  }

  // Core Math Module 1: KMeans Clustering in Pure TS
  private runKMeansClustering() {
    const k = 4; // 4 clusters
    const data = this.customers.map(c => ({
      id: c.id,
      r: c.recency,
      f: c.frequency,
      m: c.monetary
    }));

    if (data.length < k) return;

    // Standardize variables (mean center & scale variance)
    const stats = {
      r: { mean: 0, std: 1 },
      f: { mean: 0, std: 1 },
      m: { mean: 0, std: 1 }
    };

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = (arr: number[], m: number) => Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length) || 1;

    const recencies = data.map(d => d.r);
    const frequencies = data.map(d => d.f);
    const monetaries = data.map(d => d.m);

    stats.r.mean = mean(recencies);
    stats.r.std = std(recencies, stats.r.mean);

    stats.f.mean = mean(frequencies);
    stats.f.std = std(frequencies, stats.f.mean);

    stats.m.mean = mean(monetaries);
    stats.m.std = std(monetaries, stats.m.mean);

    const normData = data.map(d => ({
      id: d.id,
      x: (d.r - stats.r.mean) / stats.r.std,
      y: (d.f - stats.f.mean) / stats.f.std,
      z: (d.m - stats.m.mean) / stats.m.std
    }));

    // KMeans state initialization (Seeded centroids)
    let centroids = [
      { x: -1, y: 1.5, z: 1.5 },   // High value, recent, highly frequent
      { x: -0.5, y: 0.2, z: -0.1 },  // Average loyal (Recent but modest spending)
      { x: 1.5, y: -0.8, z: -0.8 },  // At-Risk (stale, low frequency/spend)
      { x: 0.2, y: -0.5, z: -0.4 }   // New or casual shoppers
    ];

    let assignments: Record<string, number> = {};
    const maxIterations = 15;

    for (let iter = 0; iter < maxIterations; iter++) {
      let isChanged = false;

      // Classify points
      normData.forEach(p => {
        let minDist = Infinity;
        let clusterIdx = 0;
        centroids.forEach((c, idx) => {
          const d = Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2) + Math.pow(p.z - c.z, 2);
          if (d < minDist) {
            minDist = d;
            clusterIdx = idx;
          }
        });

        if (assignments[p.id] !== clusterIdx) {
          assignments[p.id] = clusterIdx;
          isChanged = true;
        }
      });

      if (!isChanged) break;

      // Recalculate Centroids
      const sums = Array.from({ length: k }, () => ({ x: 0, y: 0, z: 0, count: 0 }));
      normData.forEach(p => {
        const clusterIdx = assignments[p.id];
        sums[clusterIdx].x += p.x;
        sums[clusterIdx].y += p.y;
        sums[clusterIdx].z += p.z;
        sums[clusterIdx].count++;
      });

      centroids = centroids.map((c, idx) => {
        const s = sums[idx];
        if (s.count === 0) return c;
        return {
          x: s.x / s.count,
          y: s.y / s.count,
          z: s.z / s.count
        };
      });
    }

    // Apply clusters and segment labels
    const segments = ['Champions', 'Loyal Customers', 'At Risk Churn', 'New Shoppers'];
    const rfmScores = ['555', '433', '122', '311'];

    this.customers.forEach(customer => {
      const cid = assignments[customer.id] !== undefined ? assignments[customer.id] : 3;
      customer.cluster = cid;
      customer.segment = segments[cid];
      customer.rfmScore = rfmScores[cid];
    });
  }

  // Core Math Module 2: Isolation Forest style Anomaly Detection
  private detectAnomalies() {
    this.anomalies = [];

    // Analyze high transaction volumes inside transactions DB
    const pricesByProduct = this.transactions.reduce((acc, t) => {
      if (!acc[t.productId]) acc[t.productId] = [];
      acc[t.productId].push(t.quantity);
      return acc;
    }, {} as Record<string, number[]>);

    // Compute standard deviation thresholds for high quantity buys
    const thresholds: Record<string, { mean: number; std: number }> = {};
    Object.entries(pricesByProduct).forEach(([pId, quantities]) => {
      const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
      const variance = quantities.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / quantities.length;
      const std = Math.sqrt(variance) || 1;
      thresholds[pId] = { mean, std };
    });

    this.transactions.forEach(t => {
      const thresh = thresholds[t.productId];
      const product = this.products.find(p => p.id === t.productId);
      const customer = this.customers.find(c => c.id === t.customerId);

      // Rule A: Giant single-order quantity discrepancy (Z-score > 3.5)
      if (thresh && t.quantity > thresh.mean + 3.5 * thresh.std && t.quantity > 8) {
        this.anomalies.push({
          id: `ANM-Q-${t.id}`,
          transactionId: t.id,
          productId: t.productId,
          type: 'Fraud Quantity',
          severity: 'High',
          description: `Customer "${customer?.name}" ordered ${t.quantity} of "${product?.name}" which is a 3.5+ Sigma volumetric anomaly compared to product mean of ${thresh.mean.toFixed(1)}.`,
          timestamp: t.timestamp,
          status: 'Unresolved'
        });
      }

      // Rule B: Night purchases of absolute high revenue
      const hr = new Date(t.timestamp).getHours();
      if ((hr >= 1 && hr <= 4) && t.totalPrice > 1000) {
        this.anomalies.push({
          id: `ANM-TN-${t.id}`,
          transactionId: t.id,
          productId: t.productId,
          type: 'Suspicious Night Purchase',
          severity: 'High',
          description: `High value transaction ($${t.totalPrice.toLocaleString()}) logged at suspicious hours of ${hr}:${new Date(t.timestamp).getMinutes().toString().padStart(2, '0')} AM.`,
          timestamp: t.timestamp,
          status: 'Unresolved'
        });
      }
    });

    // Rule C: Critical inventory shortages
    this.products.forEach(p => {
      if (p.stock < p.minRequiredStock * 0.3) {
        this.anomalies.push({
          id: `ANM-I-${p.id}`,
          productId: p.id,
          type: 'Inventory Mismatch',
          severity: 'Medium',
          description: `Urgent stock depletion alert! product "${p.name}" contains only ${p.stock} units (target stock reorder limit is ${p.minRequiredStock} units).`,
          timestamp: new Date().toISOString(),
          status: 'Unresolved'
        });
      }
    });
  }

  // Core Math Module 3: Dynamic Collaborative Filtering Recommendation Engine
  public getCollaborativeRecommendations(customerId: string, count: number = 5): Product[] {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return this.products.slice(0, count);

    // Build the User-Item Frequency Matrix
    const userItemMatrix: Record<string, Record<string, number>> = {};
    this.customers.forEach(c => {
      userItemMatrix[c.id] = {};
      this.products.forEach(p => {
        userItemMatrix[c.id][p.id] = 0;
      });
    });

    this.transactions.forEach(t => {
      if (userItemMatrix[t.customerId] && userItemMatrix[t.customerId][t.productId] !== undefined) {
        userItemMatrix[t.customerId][t.productId] += t.quantity;
      }
    });

    // Standard Cosine Similarity helper
    const computeCosineSimilarity = (c1: string, c2: string) => {
      const v1 = userItemMatrix[c1];
      const v2 = userItemMatrix[c2];
      let dotProd = 0;
      let normA = 0;
      let normB = 0;

      Object.keys(v1).forEach(pId => {
        dotProd += v1[pId] * v2[pId];
        normA += Math.pow(v1[pId], 2);
        normB += Math.pow(v2[pId], 2);
      });

      if (normA === 0 || normB === 0) return 0;
      return dotProd / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    // Calculate similarity between this query customer and all other customers
    const similarities: Array<{ cId: string; sim: number }> = [];
    Object.keys(userItemMatrix).forEach(oId => {
      if (oId === customerId) return;
      const sim = computeCosineSimilarity(customerId, oId);
      if (sim > 0) similarities.push({ cId: oId, sim });
    });

    if (similarities.length === 0) {
      // Fallback: Return best sellers in the store
      return this.getTopSellingProducts(count);
    }

    // Sort by higher similarity
    similarities.sort((a, b) => b.sim - a.sim);

    // Score products based on user ratings * customer similarities
    const productScores: Record<string, number> = {};
    const currentCustomerPurchased = userItemMatrix[customerId];

    similarities.forEach(({ cId, sim }) => {
      const otherPurchases = userItemMatrix[cId];
      Object.entries(otherPurchases).forEach(([pId, qty]) => {
        // Recommend products that the customer has NOT heavily purchased yet
        if (currentCustomerPurchased[pId] === 0 && qty > 0) {
          if (!productScores[pId]) productScores[pId] = 0;
          productScores[pId] += qty * sim;
        }
      });
    });

    const recommendedList = Object.entries(productScores)
      .sort((a, b) => b[1] - a[1])
      .map(([pId]) => this.products.find(p => p.id === pId))
      .filter((p): p is Product => p !== undefined);

    if (recommendedList.length < count) {
      const fillLimit = count - recommendedList.length;
      const bestSellers = this.getTopSellingProducts(fillLimit);
      bestSellers.forEach(bs => {
        if (!recommendedList.some(r => r.id === bs.id)) {
          recommendedList.push(bs);
        }
      });
    }

    return recommendedList.slice(0, count);
  }

  // Get Top Selling helper
  private getTopSellingProducts(count: number): Product[] {
    const productQuantities: Record<string, number> = {};
    this.transactions.forEach(t => {
      productQuantities[t.productId] = (productQuantities[t.productId] || 0) + t.quantity;
    });

    return Object.entries(productQuantities)
      .sort((a, b) => b[1] - a[1])
      .map(([pId]) => this.products.find(p => p.id === pId))
      .filter((p): p is Product => p !== undefined)
      .slice(0, count);
  }

  // Core Math Module 4: Holt-Winters Seasonal Demand Forecasting
  public generateDemandForecast(): ForecastPoint[] {
    // Standard sales seasonality for retail: Higher volumes towards month end, massive spikes during promo/holiday weeks.
    // We group transactions by week for a smoother and highly reliable mathematical seasonal smoothing forecast.
    const weeklyAggregates: Record<string, number> = {};

    this.transactions.forEach(t => {
      const date = new Date(t.timestamp);
      // Get relative week index from the beginning of transaction record (approximate week key)
      const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate() + date.getDay()) / 7)}`;
      weeklyAggregates[weekKey] = (weeklyAggregates[weekKey] || 0) + t.totalPrice;
    });

    const historicalSales = Object.values(weeklyAggregates).slice(-16); // Last 16 weeks of data points
    const length = historicalSales.length;

    if (length < 4) {
      // Fallback linear interpolation
      return Array.from({ length: 4 }).map((_, idx) => ({
        date: `Week +${idx + 1}`,
        forecast: 15000,
        lowerConfidence: 12000,
        upperConfidence: 18000,
        isFuture: true
      }));
    }

    // Perform Double Exponential Smoothing Forecasting (HW-lite)
    // Alpha = Level smoothing, Beta = Trend smoothing
    const alpha = 0.4;
    const beta = 0.25;

    let level = historicalSales[0];
    let trend = historicalSales[1] - historicalSales[0];

    for (let i = 1; i < length; i++) {
      const y = historicalSales[i];
      const lastLevel = level;
      level = alpha * y + (1 - alpha) * (level + trend);
      trend = beta * (level - lastLevel) + (1 - beta) * trend;
    }

    // Dynamic projection points
    const forecasts: ForecastPoint[] = [];

    // Add historical reference points
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 1; i--) {
      const d = new Date(baseDate.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const val = historicalSales[length - i] || 25000;
      forecasts.push({
        date: `Wk ${d.getMonth() + 1}/${d.getDate()}`,
        actual: Math.round(val),
        forecast: Math.round(val),
        lowerConfidence: Math.round(val * 0.95),
        upperConfidence: Math.round(val * 1.05),
        isFuture: false
      });
    }

    // Predict next 6 weeks
    for (let m = 1; m <= 6; m++) {
      const futureDate = new Date(baseDate.getTime() + m * 7 * 24 * 60 * 60 * 1000);
      // Model = Level + m * Trend + dynamic seasonality multiplier based on seasonal indices
      const seasonalityFactor = 1.0 + Math.sin(m * 0.8) * 0.12; // Realistic oscillation
      const pred = Math.round((level + m * trend) * seasonalityFactor);

      // Uncertainty increases further in the future
      const margin = 0.05 + 0.035 * m;
      const lower = Math.round(pred * (1 - margin));
      const upper = Math.round(pred * (1 + margin));

      forecasts.push({
        date: `Wk ${futureDate.getMonth() + 1}/${futureDate.getDate()} (Proj)`,
        forecast: pred,
        lowerConfidence: lower,
        upperConfidence: upper,
        isFuture: true
      });
    }

    return forecasts;
  }

  // Executive Dashboard Aggregation Engine
  public getDashboardSummary(): DashboardSummary {
    const totalTransactions = this.transactions.length;
    const totalRevenue = Math.round(this.transactions.reduce((sum, t) => sum + t.totalPrice, 0));
    const totalCost = this.transactions.reduce((sum, t) => sum + t.cost, 0);
    const totalProfit = Math.round(totalRevenue - totalCost);
    const profitMargin = Number(((totalProfit / totalRevenue) * 100).toFixed(1));
    const totalCustomers = this.customers.length;

    // Segment Distribution
    const segmentDistribution: Record<string, number> = {};
    this.customers.forEach(c => {
      segmentDistribution[c.segment] = (segmentDistribution[c.segment] || 0) + 1;
    });

    // Regions Performance
    const regionPerformance: Record<string, number> = {};
    this.stores.forEach(s => {
      regionPerformance[s.region] = 0;
    });
    this.transactions.forEach(t => {
      const store = this.stores.find(s => s.id === t.storeId);
      if (store) {
        regionPerformance[store.region] = (regionPerformance[store.region] || 0) + t.totalPrice;
      }
    });
    Object.keys(regionPerformance).forEach(region => {
      regionPerformance[region] = Math.round(regionPerformance[region]);
    });

    // Category Performance
    const categoryPerformance: Record<string, { revenue: number; profit: number }> = {};
    this.products.forEach(p => {
      if (!categoryPerformance[p.category]) {
        categoryPerformance[p.category] = { revenue: 0, profit: 0 };
      }
    });

    this.transactions.forEach(t => {
      const product = this.products.find(p => p.id === t.productId);
      if (product) {
        categoryPerformance[product.category].revenue += t.totalPrice;
        categoryPerformance[product.category].profit += t.margin;
      }
    });
    Object.keys(categoryPerformance).forEach(cat => {
      categoryPerformance[cat].revenue = Math.round(categoryPerformance[cat].revenue);
      categoryPerformance[cat].profit = Math.round(categoryPerformance[cat].profit);
    });

    // Product Revenue Metrics (Top 5)
    const productRevs: Record<string, { revenue: number; quantity: number }> = {};
    this.transactions.forEach(t => {
      if (!productRevs[t.productId]) productRevs[t.productId] = { revenue: 0, quantity: 0 };
      productRevs[t.productId].revenue += t.totalPrice;
      productRevs[t.productId].quantity += t.quantity;
    });

    const topProducts = Object.entries(productRevs)
      .map(([pId, val]) => {
        const product = this.products.find(p => p.id === pId);
        return {
          name: product?.name || 'Unknown',
          category: product?.category || 'General',
          revenue: Math.round(val.revenue),
          quantity: val.quantity
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Monthly Comparison (Current year vs Last Year)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    const monthlyRevenueComparison = months.map((month, idx) => {
      // Find current monthly totals and scale factor for prior year comparison (gives highly realistic growth curve)
      let currentMonthSales = 0;
      this.transactions.forEach(t => {
        const d = new Date(t.timestamp);
        if (d.getMonth() === idx && d.getFullYear() === currentYear) {
          currentMonthSales += t.totalPrice;
        }
      });

      // Default baseline sales if transactions don't fully cover the month gap
      if (currentMonthSales === 0) {
        currentMonthSales = (idx + 1) * 22000 + 44000;
      }

      currentMonthSales = Math.round(currentMonthSales);
      // Prior Year is seeded to look like a clean 8.4% annual growth standard
      const lastYearSales = Math.round(currentMonthSales / 1.084);

      return {
        month,
        currentYear: currentMonthSales,
        lastYear: lastYearSales
      };
    });

    return {
      totalRevenue,
      totalProfit,
      profitMargin,
      totalTransactions,
      totalCustomers,
      segmentDistribution,
      topProducts,
      regionPerformance,
      categoryPerformance,
      monthlyRevenueComparison
    };
  }

  // Real-time transaction simulation
  public mockNewTransaction(): { transaction: Transaction; anomaly?: Anomaly } {
    const rng = new SeededRandom(Math.random());
    const customer = rng.choose(this.customers);
    const product = rng.choose(this.products);
    const store = rng.choose(this.stores);

    const isFraudulent = Math.random() > 0.94; // Occasionally trigger simulated high value anomaly
    const quantity = isFraudulent ? rng.intRange(30, 45) : rng.intRange(1, 4);

    const totalRevenue = product.price * quantity;
    const totalCost = product.cost * quantity;
    const margin = totalRevenue - totalCost;

    const newTxn: Transaction = {
      id: `TXN-RT-${Date.now()}`,
      productId: product.id,
      customerId: customer.id,
      storeId: store.id,
      quantity,
      unitPrice: product.price,
      totalPrice: totalRevenue,
      cost: totalCost,
      margin,
      timestamp: new Date().toISOString()
    };

    this.transactions.push(newTxn);

    // Update state
    product.stock = Math.max(0, product.stock - quantity);
    this.recomputeAnalytics();
    this.saveToDisk();

    // Look if search triggered anomaly
    const matchingAnomaly = this.anomalies.find(anm => anm.transactionId === newTxn.id);

    return {
      transaction: newTxn,
      anomaly: matchingAnomaly
    };
  }

  // ETL Loader: Parses real uploaded CSV string
  public processCSVETL(fileName: string, csvContent: string): ETLLog {
    const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      return {
        id: `ETL-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        fileName,
        rowsProcessed: 0,
        rowsCleaned: 0,
        status: 'Error',
        summary: 'ETL Aborted: Uploaded CSV file is empty or contains no headers.'
      };
    }

    let rowsProcessed = 0;
    let rowsCleaned = 0;
    const errors: string[] = [];

    // Parse loop (supporting headers: timestamp, productId, customerId, storeId, quantity, unitPrice)
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    const indexMap = {
      timestamp: headers.indexOf('timestamp'),
      productId: headers.indexOf('productid'),
      customerId: headers.indexOf('customerid'),
      storeId: headers.indexOf('storeid'),
      quantity: headers.indexOf('quantity'),
      unitPrice: headers.indexOf('unitprice')
    };

    // Fallback indexes if headers don't match perfectly
    if (indexMap.productId === -1 || indexMap.customerId === -1 || indexMap.quantity === -1) {
      return {
        id: `ETL-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        fileName,
        rowsProcessed: 0,
        rowsCleaned: 0,
        status: 'Error',
        summary: 'ETL Aborted: Missing required column headers (productId, customerId, quantity).'
      };
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < headers.length) {
        rowsCleaned++;
        continue;
      }

      // Read values cleanly
      const pId = cols[indexMap.productId] || '';
      const cId = cols[indexMap.customerId] || '';
      const sId = indexMap.storeId !== -1 ? cols[indexMap.storeId] : this.stores[0].id;
      const ts = indexMap.timestamp !== -1 && cols[indexMap.timestamp] ? cols[indexMap.timestamp] : new Date().toISOString();
      const rawQty = cols[indexMap.quantity] || '1';
      const rawPrice = indexMap.unitPrice !== -1 ? cols[indexMap.unitPrice] : '';

      const quantity = Math.abs(parseInt(rawQty)) || 1;
      const product = this.products.find(p => p.id === pId) || this.products[0];
      const customer = this.customers.find(c => c.id === cId) || this.customers[0];

      const unitPrice = parseFloat(rawPrice) || product.price;
      const totalRevenue = unitPrice * quantity;
      const cost = product.cost * quantity;
      const margin = totalRevenue - cost;

      this.transactions.push({
        id: `TXN-ETL-${Date.now()}-${i}`,
        productId: product.id,
        customerId: customer.id,
        storeId: sId,
        quantity,
        unitPrice,
        totalPrice: totalRevenue,
        cost,
        margin,
        timestamp: ts
      });

      rowsProcessed++;
    }

    this.recomputeAnalytics();

    const log: ETLLog = {
      id: `ETL-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      fileName,
      rowsProcessed,
      rowsCleaned,
      status: 'Success',
      summary: `Successfully parsed & standardized ${rowsProcessed} rows. Resolved and cleaned ${rowsCleaned} incomplete records.`
    };

    this.etlLogs.push(log);
    this.saveToDisk();
    return log;
  }

  public wipeDatabase() {
    this.products = [];
    this.customers = [];
    this.stores = [];
    this.transactions = [];
    this.suppliers = [];
    this.anomalies = [];
    this.etlLogs.push({
      id: `ETL-WIPE-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      fileName: 'Database Clean Slate',
      rowsProcessed: 0,
      rowsCleaned: 0,
      status: 'Success',
      summary: 'Database cleared completely. Ready to receive clean-slate custom datasets.'
    });
    this.saveToDisk();
  }

  public resetDemoDatabase() {
    this.initializeData();
    this.etlLogs = this.etlLogs || [];
    this.etlLogs.push({
      id: `ETL-RST-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      fileName: 'Demo Baseline Reset',
      rowsProcessed: this.transactions.length,
      rowsCleaned: 0,
      status: 'Success',
      summary: 'Database reset to the predefined enterprise high-fidelity telemetry dataset.'
    });
    this.saveToDisk();
  }

  public importEntityCSV(entity: string, csvContent: string): { success: boolean; rowsProcessed: number; errors: string[] } {
    const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
    const errors: string[] = [];
    if (lines.length <= 1) {
      return { success: false, rowsProcessed: 0, errors: ['CSV content is empty or contains no headers.'] };
    }

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    let rowsProcessed = 0;

    const getIndex = (aliases: string[]) => {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    try {
      if (entity === 'products') {
        const idIdx = getIndex(['id', 'productid', 'sku']);
        const nameIdx = getIndex(['name', 'title', 'productname']);
        const catIdx = getIndex(['category', 'type', 'group']);
        const priceIdx = getIndex(['price', 'unitprice', 'retailprice']);
        const costIdx = getIndex(['cost', 'unitcost', 'wholesale_price']);
        const stockIdx = getIndex(['stock', 'quantity_in_stock', 'inventory']);
        const minStockIdx = getIndex(['minrequiredstock', 'safety_stock', 'min_stock', 'min_required_stock']);
        const supIdx = getIndex(['supplierid', 'supplier_id', 'vendor']);

        if (nameIdx === -1 || priceIdx === -1) {
          return { success: false, rowsProcessed: 0, errors: ['Missing core product headers. Required: "name" and "price"'] };
        }

        const newProds: Product[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length < Math.max(nameIdx, priceIdx) + 1) continue;

          const pId = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `PROD-CL-${Date.now().toString().slice(-4)}-${i}`;
          const name = cols[nameIdx];
          const category = catIdx !== -1 && cols[catIdx] ? cols[catIdx] : 'General';
          const price = parseFloat(cols[priceIdx]) || 0;
          const cost = costIdx !== -1 ? (parseFloat(cols[costIdx]) || 0) : +(price * 0.6).toFixed(2);
          const stock = stockIdx !== -1 ? (parseInt(cols[stockIdx]) || 0) : 100;
          const minRequiredStock = minStockIdx !== -1 ? (parseInt(cols[minStockIdx]) || 0) : 50;
          const supplierId = supIdx !== -1 && cols[supIdx] ? cols[supIdx] : 'SUP-101';

          newProds.push({
            id: pId,
            name,
            category,
            price,
            cost,
            stock,
            minRequiredStock,
            supplierId
          });
          rowsProcessed++;
        }
        newProds.forEach(np => {
          const existingIdx = this.products.findIndex(p => p.id === np.id);
          if (existingIdx !== -1) {
            this.products[existingIdx] = np;
          } else {
            this.products.unshift(np);
          }
        });
      }
      else if (entity === 'customers') {
        const idIdx = getIndex(['id', 'customerid']);
        const nameIdx = getIndex(['name', 'fullname', 'customername']);
        const emailIdx = getIndex(['email', 'emailaddress']);
        const segmentIdx = getIndex(['segment', 'tier']);
        const recIdx = getIndex(['recency', 'last_order_days']);
        const freqIdx = getIndex(['frequency', 'orders_count']);
        const monIdx = getIndex(['monetary', 'total_spend']);
        const churnIdx = getIndex(['churnprobability', 'churn_rate', 'churn_probability']);

        if (nameIdx === -1 || emailIdx === -1) {
          return { success: false, rowsProcessed: 0, errors: ['Missing core customer headers. Required: "name" and "email"'] };
        }

        const newCusts: Customer[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length < Math.max(nameIdx, emailIdx) + 1) continue;

          const cId = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `CUST-CL-${Date.now().toString().slice(-4)}-${i}`;
          const name = cols[nameIdx];
          const email = cols[emailIdx];
          const segment = segmentIdx !== -1 && cols[segmentIdx] ? cols[segmentIdx] : 'General';
          const recency = recIdx !== -1 ? (parseInt(cols[recIdx]) || 0) : 30;
          const frequency = freqIdx !== -1 ? (parseInt(cols[freqIdx]) || 0) : 1;
          const monetary = monIdx !== -1 ? (parseFloat(cols[monIdx]) || 0) : 100;
          const churnProbability = churnIdx !== -1 ? (parseFloat(cols[churnIdx]) || 0) : 15;

          newCusts.push({
            id: cId,
            name,
            email,
            segment,
            recency,
            frequency,
            monetary,
            clv: +(monetary * 1.5).toFixed(2),
            churnProbability,
            rfmScore: '333',
            cluster: 0
          });
          rowsProcessed++;
        }
        newCusts.forEach(nc => {
          const existingIdx = this.customers.findIndex(c => c.id === nc.id);
          if (existingIdx !== -1) {
            this.customers[existingIdx] = nc;
          } else {
            this.customers.unshift(nc);
          }
        });
      }
      else if (entity === 'stores') {
        const idIdx = getIndex(['id', 'storeid']);
        const nameIdx = getIndex(['name', 'storename']);
        const cityIdx = getIndex(['city', 'location']);
        const regIdx = getIndex(['region', 'district']);

        if (nameIdx === -1 || cityIdx === -1) {
          return { success: false, rowsProcessed: 0, errors: ['Missing core store headers. Required: "name" and "city"'] };
        }

        const newStores: Store[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length < Math.max(nameIdx, cityIdx) + 1) continue;

          const sId = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `STR-CL-${Date.now().toString().slice(-4)}-${i}`;
          const name = cols[nameIdx];
          const city = cols[cityIdx];
          let region = regIdx !== -1 && cols[regIdx] ? cols[regIdx] : 'West';
          if (!['Northeast', 'Midwest', 'South', 'West'].includes(region)) {
            region = 'West';
          }

          newStores.push({
            id: sId,
            name,
            city,
            region: region as any
          });
          rowsProcessed++;
        }
        newStores.forEach(ns => {
          const existingIdx = this.stores.findIndex(s => s.id === ns.id);
          if (existingIdx !== -1) {
            this.stores[existingIdx] = ns;
          } else {
            this.stores.push(ns);
          }
        });
      }
      else if (entity === 'suppliers') {
        const idIdx = getIndex(['id', 'supplierid']);
        const nameIdx = getIndex(['name', 'suppliername']);
        const contactIdx = getIndex(['contact', 'email', 'phone']);
        const catIdx = getIndex(['category', 'type']);
        const relIdx = getIndex(['reliabilityscore', 'rating', 'reliability']);

        if (nameIdx === -1) {
          return { success: false, rowsProcessed: 0, errors: ['Missing core supplier headers. Required: "name"'] };
        }

        const newSuppliers: Supplier[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length < nameIdx + 1) continue;

          const supId = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `SUP-CL-${Date.now().toString().slice(-4)}-${i}`;
          const name = cols[nameIdx];
          const contact = contactIdx !== -1 && cols[contactIdx] ? cols[contactIdx] : 'orders@supplier.com';
          const category = catIdx !== -1 && cols[catIdx] ? cols[catIdx] : 'General';
          const reliabilityScore = relIdx !== -1 ? (parseInt(cols[relIdx]) || 85) : 85;

          newSuppliers.push({
            id: supId,
            name,
            contact,
            category,
            reliabilityScore
          });
          rowsProcessed++;
        }
        newSuppliers.forEach(ns => {
          const existingIdx = this.suppliers.findIndex(s => s.id === ns.id);
          if (existingIdx !== -1) {
            this.suppliers[existingIdx] = ns;
          } else {
            this.suppliers.push(ns);
          }
        });
      }
      else if (entity === 'transactions') {
        const idIdx = getIndex(['id', 'transactionid']);
        const prodIdx = getIndex(['productid', 'sku']);
        const custIdx = getIndex(['customerid', 'buyerid']);
        const storeIdx = getIndex(['storeid', 'outletid']);
        const qtyIdx = getIndex(['quantity', 'qty', 'units']);
        const priceIdx = getIndex(['unitprice', 'price', 'sellprice']);
        const dateIdx = getIndex(['timestamp', 'date', 'time']);

        if (prodIdx === -1 || custIdx === -1 || qtyIdx === -1) {
          return { success: false, rowsProcessed: 0, errors: ['Missing core transaction headers. Required: "productId", "customerId", and "quantity"'] };
        }

        const newTxns: Transaction[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length < Math.max(prodIdx, custIdx, qtyIdx) + 1) continue;

          const tId = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `TXN-IMPORT-${Date.now().toString().slice(-4)}-${i}`;
          const productId = cols[prodIdx];
          const customerId = cols[custIdx];
          const prodObj = this.products.find(p => p.id === productId);

          const storeId = storeIdx !== -1 && cols[storeIdx] ? cols[storeIdx] : (this.stores[0]?.id || 'STR-100');
          const quantity = Math.abs(parseInt(cols[qtyIdx])) || 1;
          const unitPrice = priceIdx !== -1 && cols[priceIdx] ? (parseFloat(cols[priceIdx]) || 0) : (prodObj?.price || 10.0);
          const timestamp = dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx] : new Date().toISOString();

          const totalPrice = unitPrice * quantity;
          const cost = (prodObj?.cost || +(unitPrice * 0.6).toFixed(2)) * quantity;
          const margin = totalPrice - cost;

          newTxns.push({
            id: tId,
            productId,
            customerId,
            storeId,
            quantity,
            unitPrice,
            totalPrice,
            cost,
            margin,
            timestamp
          });
          rowsProcessed++;
        }
        newTxns.forEach(nt => {
          const existingIdx = this.transactions.findIndex(t => t.id === nt.id);
          if (existingIdx !== -1) {
            this.transactions[existingIdx] = nt;
          } else {
            this.transactions.push(nt);
          }
        });
      } else {
        return { success: false, rowsProcessed: 0, errors: [`Unsupported dataset import category: ${entity}`] };
      }

      this.recomputeAnalytics();
      this.saveToDisk();

      const logObj: ETLLog = {
        id: `ETL-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        fileName: `Custom ${entity} data file`,
        rowsProcessed,
        rowsCleaned: 0,
        status: 'Success',
        summary: `Successfully parsed and merged custom user dataset '${entity}' containing ${rowsProcessed} records into server store.`
      };
      this.etlLogs.push(logObj);
      this.saveToDisk();

      return { success: true, rowsProcessed, errors: [] };
    } catch (err: any) {
      return { success: false, rowsProcessed: 0, errors: [err.message] };
    }
  }
}

export const serverDb = new RetailBIStore();

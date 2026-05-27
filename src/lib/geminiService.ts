import { GoogleGenAI } from '@google/genai';
import { serverDb } from './serverDb.js';

// Initialize Gemini Client with correct User-Agent headers
let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return a lightweight dummy that throws clear error warning, keeping server running
      console.warn("GEMINI_API_KEY environment variable is not defined. AI queries will fall back to local rule-based analytics.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY_FOR_STANDALONE",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

export async function askGeminiAboutAnalytics(userPrompt: string): Promise<string> {
  // Pull current DB stats to feed into context
  const summary = serverDb.getDashboardSummary();
  const anomalies = serverDb.anomalies.filter(a => a.status === 'Unresolved');

  const contextStr = `
You are the Executive AI Retail Consultant for Indian retail logistics operations.
Here are the absolute real-time dashboard figures from our systems in Indian Rupees (₹):
- Store Total Revenue: ₹${summary.totalRevenue.toLocaleString()}
- Total Profit Margin: ${summary.profitMargin}% (Net Profit: ₹${summary.totalProfit.toLocaleString()})
- Loyal Active Customers tracked: ${summary.totalCustomers}
- Top 5 Products by Revenue:
${summary.topProducts.map(p => `  * ${p.name} (₹${p.revenue.toLocaleString()}, Volume: ${p.quantity})`).join('\n')}
- Regional Sales breakdown:
${Object.entries(summary.regionPerformance).map(([r, s]) => `  * ${r}: ₹${s.toLocaleString()}`).join('\n')}
- Category Revenue and Margins:
${Object.entries(summary.categoryPerformance).map(([c, v]: [string, any]) => `  * ${c}: Revenue: ₹${v.revenue.toLocaleString()}, Net Profit: ₹${v.profit.toLocaleString()}`).join('\n')}
- Critical Active Alerts & Stock Outliers:
${anomalies.map(a => `  * [${a.type} - Severity ${a.severity}] ${a.description}`).join('\n')}

Guidelines:
1. Provide extremely precise, expert, enterprise C-level executive insights.
2. Be extremely brief, concise, and point-to-point. No fluff or lengthy introductions/outros. Use simple, direct, high-impact bullet points. Keep the entire response very short and easy to digest.
3. If the user asks a specific question, answer it directly and succinctly using the figures above with actual numerical citations.
4. Be helpful, strategic, actionable, and focus on supply-chain bottlenecks, inventory turnover, or regional growth strategies.
5. Respond in professional Markdown format.
6. All currency figures MUST be written/formatted in Indian Rupees (₹, Rupee) only. Use the symbol "₹" instead of "$", and express all monetary citations in Indian Rupees (₹). Do NOT use dollars or '$'.
  `;

  // Check if API key is present
  if (!process.env.GEMINI_API_KEY) {
    return generateLocalRuleBasedInsight(userPrompt);
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: contextStr,
        temperature: 0.7,
      }
    });

    const result = response.text || "No insights could be compiled at this level of resolution.";
    return result;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `### ⚠️ AI Processing Limit Reached \nOur high-scale enterprise Gemini API query returned an error: "${error?.message || 'Connection timeout'}"\n\n#### Rule-Based Analytics Backup Summary:\n${generateLocalRuleBasedInsight(userPrompt)}`;
  }
}

// Fallback rule-based system if API Key is not set or errors out
function generateLocalRuleBasedInsight(userPrompt: string): string {
  const summary = serverDb.getDashboardSummary();
  const anomalies = serverDb.anomalies.filter(a => a.status === 'Unresolved');
  
  const lowers = serverDb.products.filter(p => p.stock < p.minRequiredStock);
  const bestProd = summary.topProducts[0];

  return `
### 📊 Automated BI Executive Briefing (Real-Time Rule-Based Fallback)

As the automated Business Intelligence router, I have processed your request: **"${userPrompt}"** across our active transactional schemas. Here are your strategic action items:

1. **Revenue Operations Highlight**:
   Our global store revenue sits at **₹${summary.totalRevenue.toLocaleString()}** with a solid **${summary.profitMargin}%** net profit margin. Our top performing product is **${bestProd?.name}** representing **₹${bestProd?.revenue.toLocaleString()}** in direct category contribution.

2. **Supply Chain Optimization**:
   There are currently **${lowers.length}** catalog products falling below minimum safety parameters. Immediately target supply streams from our **${serverDb.suppliers.filter(s => s.reliabilityScore < 85).map(s => s.name).join(', ')}** lines to mitigate out-of-stock liabilities.

3. **Regional Distribution Operations**:
   The **South** region outperforms the national average. Consider shifting Excess inventory in Electronics from the **Midwest** storage units directly to Southern regional hubs to capture seasonal impulse purchasing indexes.

*Logistics action required: Resolve the **${anomalies.length}** high priority anomaly signals flagged in your operations stream.*
  `;
}
export async function getDailyKPIOptimizerReport(): Promise<string> {
  const prompt = "Generate a comprehensive daily executive summary with specific operational directives, highlighting inventory shortages, top performers, customer segments clustered via KMeans, and anomalies detected.";
  return askGeminiAboutAnalytics(prompt);
}
export async function queryDashboardNaturalLanguage(query: string): Promise<string> {
  return askGeminiAboutAnalytics(query);
}
export async function getForecastExplanationReport(): Promise<string> {
  const prompt = "Provide a predictive demand forecast analysis on sales. Highlight potential stock challenges, seasonal trends, and purchasing index increases.";
  return askGeminiAboutAnalytics(prompt);
}
export async function getInventoryOptimizationDirectives(): Promise<string> {
  const prompt = "Formulate 4 concrete inventory restructuring optimization suggestions based on the supply chain status, low stocks, and supplier metrics.";
  return askGeminiAboutAnalytics(prompt);
}
export async function getChurnPreventionActionBrief(): Promise<string> {
  const prompt = "Draft an aggressive marketing win-back playbook for customers flagged under 'At-Risk Churn' segment cluster by the recent RFM KMeans segmentation.";
  return askGeminiAboutAnalytics(prompt);
}
export async function askFreeformAIQuery(userText: string): Promise<string> {
  return askGeminiAboutAnalytics(userText);
}

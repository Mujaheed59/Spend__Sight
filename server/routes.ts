// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertExpenseSchema, insertCategorySchema, insertBudgetSchema } from "@shared/schema";
import { categorizeExpense, generateInsights, generateBudgetRecommendations } from "./openai";
import { getUserExpenseSummary } from "./services/expenseSummary";  // new
import { InsightModel as Insight } from "./models.js";                             // new
import { z } from "zod";

export async function registerRoutes(app: Express, httpServer?: any): Promise<Server> {
  // Auth middleware
  setupAuth(app);

  // Initialize default categories
  await initializeDefaultCategories();

  // -----------------------
  // Finance News API
  // -----------------------
  app.get("/api/finance-news", async (req, res) => {
    try {
      // Mock finance news data based on real Indian fintech trends
      const financeNews = [
        {
          title: "India's Fintech Sector Ranks 3rd Globally in H1 2025 Funding",
          description: "India's fintech companies received $889 million in funding this half-year, showing strong investor confidence. This means more digital payment and lending apps are being developed, which could lead to better financial services for everyday users like easier loan approvals and lower transaction fees.",
          url: "https://www.business-standard.com/industry/news/india-fintech-funding-h1-2025-tracxn-startups-ma-deals-125070400644_1.html",
          source: "Business Standard",
          publishedAt: new Date().toISOString(),
          category: "fintech"
        },
        {
          title: "MoneyView Becomes India's Latest Fintech Unicorn at $1.21B Valuation",
          description: "MoneyView, a personal loan platform, is now valued at over $1 billion (called a 'unicorn' in startup terms). This means they've grown rapidly by helping people get personal loans more easily through their app, joining 24 other billion-dollar fintech companies in India.",
          url: "https://fintechnews.sg/108940/fintech-india/the-complete-list-of-india-fintech-unicorns-2025/",
          source: "FinTech News",
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          category: "fintech"
        },
        {
          title: "Nifty 50 Hits New High: Banking Stocks Lead Rally",
          description: "India's main stock market index (Nifty 50) reached record levels, driven by banking stocks. This is good news for investors and suggests confidence in India's banking sector. For everyday users, this often means banks may offer better interest rates on savings and more competitive loan rates.",
          url: "#",
          source: "Economic Times",
          publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          category: "stocks"
        },
        {
          title: "Groww Acquires Fisdom for $150M in Largest H1 2025 Deal",
          description: "Groww, a popular investment app, bought Fisdom (a wealth management platform) for $150 million. This means Groww users will likely get access to more investment advisory services and better tools for managing their money and planning for goals like retirement or buying a home.",
          url: "#",
          source: "Economic Times",
          publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          category: "fintech"
        },
        {
          title: "IT Stocks Surge on AI Boom: TCS, Infosys Lead Gains",
          description: "Technology company stocks like TCS and Infosys are rising due to increased demand for AI services. This trend means more job opportunities in tech and could lead to salary increases in the IT sector. For investors, tech stocks are showing strong performance.",
          url: "#",
          source: "Mint",
          publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          category: "stocks"
        },
        {
          title: "RBI Governor Meets Fintech Leaders, Signals Regulatory Easing",
          description: "The Reserve Bank of India (RBI) Governor met with fintech company leaders, suggesting they may relax some rules. This could mean faster approvals for new financial apps and services, potentially leading to more innovative payment solutions and easier access to digital banking for consumers.",
          url: "#",
          source: "Mint",
          publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          category: "banking"
        },
        {
          title: "UPI International Expansion Reaches France, Singapore",
          description: "India's UPI (Unified Payments Interface) digital payment system is now available in France and Singapore. This means Indians traveling to these countries can use UPI to pay instead of carrying cash or using expensive international cards, saving money on transaction fees.",
          url: "#",
          source: "Hindu BusinessLine",
          publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          category: "payments"
        },
        {
          title: "FMCG Stocks Rally as Rural Demand Improves",
          description: "Fast-moving consumer goods (FMCG) company stocks are rising as rural areas show increased spending on everyday items like soaps, snacks, and groceries. This indicates improving economic conditions in villages and small towns, which is positive for the overall economy and stock market.",
          url: "#",
          source: "Business Standard",
          publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
          category: "stocks"
        },
        {
          title: "Indian Fintech Market to Reach $95.30B by 2030",
          description: "India's fintech market is expected to grow to $95.30 billion by 2030, expanding at 16.65% annually. This growth means more digital payment options, easier access to loans and insurance, and better financial management tools will become available to everyday users over the next few years.",
          url: "https://www.mordorintelligence.com/industry-reports/india-fintech-market",
          source: "Mordor Intelligence",
          publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          category: "markets"
        }
      ];
      
      res.json(financeNews);
    } catch (error) {
      console.error("Error fetching finance news:", error);
      res.status(500).json({ message: "Failed to fetch finance news" });
    }
  });

  // -----------------------
  // User Profile
  // -----------------------
  app.get("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let profile = await storage.getUserProfile(userId);
      
      if (!profile) {
        // Create default profile for new users
        profile = {
          id: userId,
          monthlyIncome: 50000,
          currency: 'INR',
          timezone: 'Asia/Kolkata'
        };
        await storage.updateUserProfile(userId, profile);
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { monthlyIncome, currency, timezone } = req.body;
      
      const updatedProfile = await storage.updateUserProfile(userId, {
        monthlyIncome: monthlyIncome || 50000,
        currency: currency || 'INR',
        timezone: timezone || 'Asia/Kolkata'
      });
      
      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // -----------------------
  // Categories
  // -----------------------
  app.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error creating category:", error);
        res.status(500).json({ message: "Failed to create category" });
      }
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCategory(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // -----------------------
  // Expenses
  // -----------------------
  app.get("/api/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const expenses = await storage.getExpensesByUser(userId, limit);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertExpenseSchema.parse(req.body);

      // AI categorization if no category
      let categoryId = validatedData.categoryId;
      if (!categoryId && validatedData.description) {
        const categorization = await categorizeExpense(validatedData.description, parseFloat(validatedData.amount));
        const categories = await storage.getCategories();
        const matchedCategory = categories.find(cat =>
          cat.name.toLowerCase().includes(categorization.category.toLowerCase())
        );
        if (matchedCategory) categoryId = matchedCategory.id;
      }

      const expense = await storage.createExpense({
        ...validatedData,
        categoryId,
        userId,
      });

      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error creating expense:", error);
        res.status(500).json({ message: "Failed to create expense" });
      }
    }
  });

  app.put("/api/expenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertExpenseSchema.partial().parse(req.body);
      const expense = await storage.updateExpense(id, validatedData);
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error updating expense:", error);
        res.status(500).json({ message: "Failed to update expense" });
      }
    }
  });

  app.delete("/api/expenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteExpense(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // -----------------------
  // Budgets
  // -----------------------
  app.get("/api/budgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const budgets = await storage.getBudgetsByUser(userId);
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post("/api/budgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertBudgetSchema.parse(req.body);

      const budget = await storage.createBudget({
        ...validatedData,
        userId,
      });

      res.json(budget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error creating budget:", error);
        res.status(500).json({ message: "Failed to create budget" });
      }
    }
  });

  app.delete("/api/budgets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBudget(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // -----------------------
  // Analytics
  // -----------------------
  app.get("/api/analytics/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }

      const stats = await storage.getExpenseStats(userId, startDate as string, endDate as string);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // -----------------------
  // AI Budget Recommendations
  // -----------------------
  app.get("/api/ai/budget-recommendations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const expenses = await storage.getExpensesByUser(userId);

      if (expenses.length === 0) return res.json([]);

      const expensesWithCategories = expenses.map(exp => ({
        amount: typeof exp.amount === "string" ? parseFloat(exp.amount) : exp.amount,
        categoryName: exp.category?.name || "Other",
        date: exp.date,
        description: exp.description,
      }));

      const recommendations = await generateBudgetRecommendations(expensesWithCategories);

      const formatted = Object.entries(recommendations).map(([category, amount]) => {
        const categorySpend = expensesWithCategories
          .filter(e => e.categoryName === category)
          .reduce((sum, e) => sum + e.amount, 0);

        return {
          category,
          currentSpend: categorySpend,
          recommendedBudget: amount,
          potentialSavings: Math.max(0, categorySpend - amount),
          reason: `AI suggests ₹${amount}/month for ${category} based on your spending patterns.`,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error("Error generating budget recommendations:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // -----------------------
  // AI Insights
  // -----------------------
  app.get("/api/insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const insights = await storage.getInsightsByUser(userId);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  app.post("/api/insights/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      await storage.clearUserInsights(userId);

      // Get current month expenses
      const currentDate = new Date();
      const startCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Get previous month expenses
      const startPreviousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const endPreviousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);

      const currentExpenses = await storage.getExpensesByUser(userId);
      const currentFiltered = currentExpenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= startCurrentMonth && expDate <= endCurrentMonth;
      });

      const previousFiltered = currentExpenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= startPreviousMonth && expDate <= endPreviousMonth;
      });

      const formattedCurrent = currentFiltered.map(exp => ({
        amount: typeof exp.amount === "string" ? parseFloat(exp.amount) : exp.amount,
        categoryName: exp.category?.name || "Other",
        date: exp.date,
        description: exp.description,
      }));

      const formattedPrevious = previousFiltered.map(exp => ({
        amount: typeof exp.amount === "string" ? parseFloat(exp.amount) : exp.amount,
        categoryName: exp.category?.name || "Other",
        date: exp.date,
        description: exp.description,
      }));

      const formattedBudgets: any[] = [];

      const aiInsights = await generateInsights(formattedCurrent, formattedPrevious, formattedBudgets);

      const savedInsights = await Promise.all(
        aiInsights.map(insight =>
          storage.createInsight({ ...insight, userId, isRead: "false" })
        )
      );

      res.json(savedInsights);
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  app.put("/api/insights/:id/read", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.markInsightAsRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking insight as read:", error);
      res.status(500).json({ message: "Failed to mark insight as read" });
    }
  });

  // -----------------------
  // NEW: Custom Range Insights
  // -----------------------
  app.post("/api/insights/custom", isAuthenticated, async (req: any, res) => {
    try {
      const { start, end } = req.body;
      const userId = req.user.id;

      const summary = await getUserExpenseSummary(userId, new Date(start), new Date(end));
      const insights = await generateInsights(summary, [], []);

      const saved = await Insight.create({
        userId,
        periodStart: start,
        periodEnd: end,
        recommendations: insights.length > 0 ? insights[0].description : "No recommendations available",
        savingsTips: insights.length > 1 ? insights[1].description : "No savings tips available", 
        rawResponse: insights,
      });

      res.json(saved);
    } catch (err) {
      console.error("Error generating custom insights:", err);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  // -----------------------
  // AI Categorization
  // -----------------------
  app.post("/api/ai/categorize", isAuthenticated, async (req, res) => {
    try {
      const { description, amount } = req.body;
      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }

      const categorization = await categorizeExpense(description, amount || 0);
      const categories = await storage.getCategories();
      const matchedCategory = categories.find(cat =>
        cat.name.toLowerCase().includes(categorization.category.toLowerCase())
      );

      res.json({
        ...categorization,
        suggestedCategoryId: matchedCategory?.id || null,
        suggestedCategoryName: matchedCategory?.name || "Unknown",
      });
    } catch (error) {
      console.error("Error categorizing expense:", error);
      res.status(500).json({ message: "Failed to categorize expense" });
    }
  });

  const server = httpServer || createServer(app);
  return server;
}

async function initializeDefaultCategories() {
  try {
    const existingCategories = await storage.getCategories();
    if (existingCategories.length === 0) {
      const defaultCategories = [
        { name: "Food & Dining", color: "#ef4444", icon: "🍽️" },
        { name: "Transportation", color: "#3b82f6", icon: "🚗" },
        { name: "Shopping", color: "#10b981", icon: "🛍️" },
        { name: "Entertainment", color: "#f59e0b", icon: "🎬" },
        { name: "Bills & Utilities", color: "#8b5cf6", icon: "📱" },
        { name: "Healthcare", color: "#ec4899", icon: "🏥" },
        { name: "Education", color: "#06b6d4", icon: "📚" },
        { name: "Travel", color: "#84cc16", icon: "✈️" },
      ];

      for (const category of defaultCategories) {
        await storage.createCategory(category);
      }

      console.log("Default categories initialized");
    }
  } catch (error) {
    console.error("Error initializing default categories:", error);
  }
}

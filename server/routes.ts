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

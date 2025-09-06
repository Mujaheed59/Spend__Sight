import {
  type User,
  type InsertUser,
  type UpsertUser,
  type Expense,
  type ExpenseWithCategory,
  type InsertExpense,
  type Category,
  type InsertCategory,
  type Insight,
  type InsertInsight,
  type Budget,
  type InsertBudget,
  type UserProfile,
  type InsertUserProfile,
} from "@shared/schema";
import { UserModel, CategoryModel, ExpenseModel, InsightModel, BudgetModel, UserProfileModel } from "./models";
import session from "express-session";
import MongoStore from "connect-mongo";
import MemoryStore from "memorystore";
import mongoose from "./db";

export interface IStorage {
  // User operations for local authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Session store for authentication
  sessionStore: session.Store;
  
  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Expense operations
  getExpensesByUser(userId: string, limit?: number): Promise<ExpenseWithCategory[]>;
  getExpensesByUserAndDateRange(userId: string, startDate: string, endDate: string): Promise<ExpenseWithCategory[]>;
  createExpense(expense: InsertExpense & { userId: string }): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  
  // Insight operations
  getInsightsByUser(userId: string): Promise<Insight[]>;
  createInsight(insight: InsertInsight & { userId: string }): Promise<Insight>;
  markInsightAsRead(id: string): Promise<void>;
  clearUserInsights(userId: string): Promise<void>;
  
  // Budget operations
  getBudgetsByUser(userId: string): Promise<Budget[]>;
  createBudget(budget: InsertBudget & { userId: string }): Promise<Budget>;
  deleteBudget(id: string): Promise<void>;
  
  // Enhanced category operations
  deleteCategory(id: string): Promise<void>;
  
  // User profile operations
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  updateUserProfile(userId: string, profile: Partial<InsertUserProfile & { id?: string }>): Promise<UserProfile>;
  
  // Analytics
  getExpenseStats(userId: string, startDate: string, endDate: string): Promise<{
    totalSpent: number;
    categoryBreakdown: Array<{ categoryName: string; amount: number; color: string }>;
    dailyTrend: Array<{ date: string; amount: number }>;
  }>;
}

const MemoryStoreSession = MemoryStore(session);

// In-memory storage implementation as fallback
export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private categories: Map<string, Category> = new Map();
  private expenses: Map<string, Expense> = new Map();
  private insights: Map<string, Insight> = new Map();
  private budgets: Map<string, Budget> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    // Initialize default categories
    this.initializeDefaultCategories();
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private initializeDefaultCategories() {
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

    defaultCategories.forEach(cat => {
      const id = this.generateId();
      this.categories.set(id, {
        id,
        ...cat,
        createdAt: new Date()
      });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const usersArray = Array.from(this.users.values());
    return usersArray.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.generateId();
    const user: User = {
      id,
      ...insertUser,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const id = userData.id || this.generateId();
    const existingUser = this.users.get(id);
    const user: User = {
      ...existingUser,
      ...userData,
      id,
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.generateId();
    const newCategory: Category = {
      id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      createdAt: new Date()
    };
    this.categories.set(id, newCategory);
    return newCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories.delete(id);
  }

  async getExpensesByUser(userId: string, limit = 50): Promise<ExpenseWithCategory[]> {
    const userExpenses = Array.from(this.expenses.values())
      .filter(expense => expense.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return userExpenses.map(expense => ({
      ...expense,
      category: expense.categoryId ? this.categories.get(expense.categoryId) || null : null
    }));
  }

  async getExpensesByUserAndDateRange(userId: string, startDate: string, endDate: string): Promise<ExpenseWithCategory[]> {
    const userExpenses = Array.from(this.expenses.values())
      .filter(expense => expense.userId === userId && expense.date >= startDate && expense.date <= endDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return userExpenses.map(expense => ({
      ...expense,
      category: expense.categoryId ? this.categories.get(expense.categoryId) || null : null
    }));
  }

  async createExpense(expense: InsertExpense & { userId: string }): Promise<Expense> {
    const id = this.generateId();
    const newExpense: Expense = {
      id,
      userId: expense.userId,
      categoryId: expense.categoryId,
      amount: typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount,
      description: expense.description,
      paymentMethod: expense.paymentMethod,
      date: expense.date,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.expenses.set(id, newExpense);
    return newExpense;
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense> {
    const existing = this.expenses.get(id);
    if (!existing) {
      throw new Error('Expense not found');
    }
    const updated: Expense = {
      ...existing,
      ...expense,
      amount: expense.amount ? (typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount) : existing.amount,
      updatedAt: new Date()
    };
    this.expenses.set(id, updated);
    return updated;
  }

  async deleteExpense(id: string): Promise<void> {
    this.expenses.delete(id);
  }

  async getInsightsByUser(userId: string): Promise<Insight[]> {
    return Array.from(this.insights.values())
      .filter(insight => insight.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createInsight(insight: InsertInsight & { userId: string }): Promise<Insight> {
    const id = this.generateId();
    const newInsight: Insight = {
      id,
      userId: insight.userId,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      priority: insight.priority,
      isRead: insight.isRead,
      createdAt: new Date()
    };
    this.insights.set(id, newInsight);
    return newInsight;
  }

  async markInsightAsRead(id: string): Promise<void> {
    const insight = this.insights.get(id);
    if (insight) {
      insight.isRead = "true";
      this.insights.set(id, insight);
    }
  }

  async clearUserInsights(userId: string): Promise<void> {
    for (const [id, insight] of this.insights.entries()) {
      if (insight.userId === userId) {
        this.insights.delete(id);
      }
    }
  }

  async getBudgetsByUser(userId: string): Promise<Budget[]> {
    return Array.from(this.budgets.values())
      .filter(budget => budget.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createBudget(budget: InsertBudget & { userId: string }): Promise<Budget> {
    const id = this.generateId();
    const newBudget: Budget = {
      id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      amount: typeof budget.amount === 'string' ? parseFloat(budget.amount) : budget.amount,
      period: budget.period,
      startDate: budget.startDate,
      endDate: budget.endDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.budgets.set(id, newBudget);
    return newBudget;
  }

  async deleteBudget(id: string): Promise<void> {
    this.budgets.delete(id);
  }

  async getExpenseStats(userId: string, startDate: string, endDate: string): Promise<{
    totalSpent: number;
    categoryBreakdown: Array<{ categoryName: string; amount: number; color: string }>;
    dailyTrend: Array<{ date: string; amount: number }>;
  }> {
    const expenses = await this.getExpensesByUserAndDateRange(userId, startDate, endDate);
    
    const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    const categoryMap = new Map<string, { amount: number; name: string; color: string }>();
    const dailyMap = new Map<string, number>();
    
    expenses.forEach(expense => {
      // Category breakdown
      const categoryName = expense.category?.name || 'Uncategorized';
      const categoryColor = expense.category?.color || '#6b7280';
      const categoryKey = expense.categoryId || 'uncategorized';
      
      if (categoryMap.has(categoryKey)) {
        categoryMap.get(categoryKey)!.amount += expense.amount;
      } else {
        categoryMap.set(categoryKey, {
          amount: expense.amount,
          name: categoryName,
          color: categoryColor
        });
      }
      
      // Daily trend
      if (dailyMap.has(expense.date)) {
        dailyMap.set(expense.date, dailyMap.get(expense.date)! + expense.amount);
      } else {
        dailyMap.set(expense.date, expense.amount);
      }
    });
    
    const categoryBreakdown = Array.from(categoryMap.values())
      .map(cat => ({ categoryName: cat.name, amount: cat.amount, color: cat.color }))
      .sort((a, b) => b.amount - a.amount);
      
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      totalSpent,
      categoryBreakdown,
      dailyTrend
    };
  }

  // User profile operations
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return this.userProfiles.get(userId);
  }

  async updateUserProfile(userId: string, profile: Partial<InsertUserProfile & { id?: string }>): Promise<UserProfile> {
    const existingProfile = this.userProfiles.get(userId);
    const updatedProfile: UserProfile = {
      id: userId,
      monthlyIncome: profile.monthlyIncome || existingProfile?.monthlyIncome || 50000,
      currency: profile.currency || existingProfile?.currency || 'INR',
      timezone: profile.timezone || existingProfile?.timezone || 'Asia/Kolkata'
    };
    this.userProfiles.set(userId, updatedProfile);
    return updatedProfile;
  }
}

export class MongoStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Use memory store for sessions with fallback to MongoDB when available
    try {
      if (mongoose.connection.readyState === 1) {
        this.sessionStore = MongoStore.create({
          client: mongoose.connection.getClient(),
          collectionName: 'sessions'
        });
      } else {
        this.sessionStore = new MemoryStoreSession({
          checkPeriod: 86400000 // prune expired entries every 24h
        });
      }
    } catch (error) {
      console.log('Using memory store for sessions');
      this.sessionStore = new MemoryStoreSession({
        checkPeriod: 86400000 // prune expired entries every 24h
      });
    }
  }

  // User operations for local authentication
  async getUser(id: string): Promise<User | undefined> {
    try {
      const user = await UserModel.findById(id).lean();
      return user ? this.transformUser(user) : undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  private transformUser(user: any): User {
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: user.password,
      profileImageUrl: user.profileImageUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const user = await UserModel.findOne({ username }).lean();
      return user ? this.transformUser(user) : undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user = new UserModel(insertUser);
    const savedUser = await user.save();
    return this.transformUser(savedUser.toObject());
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user = await UserModel.findOneAndUpdate(
      { _id: userData.id || userData._id },
      { ...userData, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    return this.transformUser(user!.toObject());
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    try {
      const categories = await CategoryModel.find().sort({ name: 1 }).lean();
      return categories.map(cat => this.transformCategory(cat));
    } catch (error) {
      console.log('Categories not available, returning empty array');
      return [];
    }
  }

  private transformCategory(cat: any): Category {
    return {
      id: cat._id.toString(),
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      createdAt: cat.createdAt
    };
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const newCategory = new CategoryModel(category);
    const savedCategory = await newCategory.save();
    return this.transformCategory(savedCategory.toObject());
  }

  // Expense operations
  async getExpensesByUser(userId: string, limit = 50): Promise<ExpenseWithCategory[]> {
    const expenses = await ExpenseModel.find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const result: ExpenseWithCategory[] = [];
    
    for (const expense of expenses) {
      let category = null;
      if (expense.categoryId) {
        const cat = await CategoryModel.findById(expense.categoryId).lean();
        category = cat ? { ...cat, id: cat._id.toString() } : null;
      }
      
      result.push({
        id: expense._id.toString(),
        userId: expense.userId,
        categoryId: expense.categoryId,
        amount: expense.amount,
        description: expense.description,
        paymentMethod: expense.paymentMethod,
        date: expense.date,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
        category
      });
    }
    
    return result;
  }

  async getExpensesByUserAndDateRange(userId: string, startDate: string, endDate: string): Promise<ExpenseWithCategory[]> {
    const expenses = await ExpenseModel.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1, createdAt: -1 }).lean();

    const result: ExpenseWithCategory[] = [];
    
    for (const expense of expenses) {
      let category = null;
      if (expense.categoryId) {
        const cat = await CategoryModel.findById(expense.categoryId).lean();
        category = cat ? { ...cat, id: cat._id.toString() } : null;
      }
      
      result.push({
        id: expense._id.toString(),
        userId: expense.userId,
        categoryId: expense.categoryId,
        amount: expense.amount,
        description: expense.description,
        paymentMethod: expense.paymentMethod,
        date: expense.date,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
        category
      });
    }
    
    return result;
  }

  async createExpense(expense: InsertExpense & { userId: string }): Promise<Expense> {
    const newExpense = new ExpenseModel({
      ...expense,
      amount: parseFloat(expense.amount)
    });
    const savedExpense = await newExpense.save();
    const expenseObject = savedExpense.toObject();
    return {
      id: savedExpense._id.toString(),
      userId: expenseObject.userId,
      categoryId: expenseObject.categoryId,
      amount: expenseObject.amount,
      description: expenseObject.description,
      paymentMethod: expenseObject.paymentMethod,
      date: expenseObject.date,
      createdAt: expenseObject.createdAt,
      updatedAt: expenseObject.updatedAt
    };
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense> {
    const updateData: any = { ...expense };
    if (expense.amount) {
      updateData.amount = parseFloat(expense.amount);
    }
    updateData.updatedAt = new Date();

    const updatedExpense = await ExpenseModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!updatedExpense) {
      throw new Error('Expense not found');
    }
    
    const expenseObject = updatedExpense.toObject();
    return {
      id: updatedExpense._id.toString(),
      userId: expenseObject.userId,
      categoryId: expenseObject.categoryId,
      amount: expenseObject.amount,
      description: expenseObject.description,
      paymentMethod: expenseObject.paymentMethod,
      date: expenseObject.date,
      createdAt: expenseObject.createdAt,
      updatedAt: expenseObject.updatedAt
    };
  }

  async deleteExpense(id: string): Promise<void> {
    await ExpenseModel.findByIdAndDelete(id);
  }

  // Insight operations
  async getInsightsByUser(userId: string): Promise<Insight[]> {
    const insights = await InsightModel.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    return insights.map(insight => ({
      id: insight._id.toString(),
      userId: insight.userId,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      priority: insight.priority,
      isRead: insight.isRead,
      createdAt: insight.createdAt
    }));
  }

  async createInsight(insight: InsertInsight & { userId: string }): Promise<Insight> {
    const newInsight = new InsightModel(insight);
    const savedInsight = await newInsight.save();
    const insightObject = savedInsight.toObject();
    return {
      id: savedInsight._id.toString(),
      userId: insightObject.userId,
      type: insightObject.type,
      title: insightObject.title,
      description: insightObject.description,
      priority: insightObject.priority,
      isRead: insightObject.isRead,
      createdAt: insightObject.createdAt
    };
  }

  async markInsightAsRead(id: string): Promise<void> {
    await InsightModel.findByIdAndUpdate(id, { isRead: "true" });
  }

  async clearUserInsights(userId: string): Promise<void> {
    await InsightModel.deleteMany({ userId });
  }

  // Budget operations
  async getBudgetsByUser(userId: string): Promise<Budget[]> {
    const budgets = await BudgetModel.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    return budgets.map(budget => ({
      id: budget._id.toString(),
      userId: budget.userId,
      categoryId: budget.categoryId,
      amount: budget.amount,
      period: budget.period,
      startDate: budget.startDate,
      endDate: budget.endDate,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt
    }));
  }

  async createBudget(budget: InsertBudget & { userId: string }): Promise<Budget> {
    const newBudget = new BudgetModel({
      ...budget,
      amount: parseFloat(budget.amount)
    });
    const savedBudget = await newBudget.save();
    const budgetObject = savedBudget.toObject();
    return {
      id: savedBudget._id.toString(),
      userId: budgetObject.userId,
      categoryId: budgetObject.categoryId,
      amount: budgetObject.amount,
      period: budgetObject.period,
      startDate: budgetObject.startDate,
      endDate: budgetObject.endDate,
      createdAt: budgetObject.createdAt,
      updatedAt: budgetObject.updatedAt
    };
  }

  async deleteBudget(id: string): Promise<void> {
    await BudgetModel.findByIdAndDelete(id);
  }

  // Enhanced category operations
  async deleteCategory(id: string): Promise<void> {
    await CategoryModel.findByIdAndDelete(id);
  }

  // Analytics
  async getExpenseStats(userId: string, startDate: string, endDate: string): Promise<{
    totalSpent: number;
    categoryBreakdown: Array<{ categoryName: string; amount: number; color: string }>;
    dailyTrend: Array<{ date: string; amount: number }>;
  }> {
    // Get total spent
    const totalResult = await ExpenseModel.aggregate([
      {
        $match: {
          userId,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const totalSpent = totalResult[0]?.total || 0;

    // Get category breakdown
    const categoryResult = await ExpenseModel.aggregate([
      {
        $match: {
          userId,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$categoryId",
          amount: { $sum: "$amount" }
        }
      },
      {
        $sort: { amount: -1 }
      }
    ]);

    const categoryBreakdown = [];
    for (const item of categoryResult) {
      let categoryName = 'Uncategorized';
      let color = '#6b7280';
      
      if (item._id) {
        const category = await CategoryModel.findById(item._id).lean();
        if (category) {
          categoryName = category.name;
          color = category.color;
        }
      }
      
      categoryBreakdown.push({
        categoryName,
        amount: item.amount,
        color
      });
    }

    // Get daily trend
    const dailyResult = await ExpenseModel.aggregate([
      {
        $match: {
          userId,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$date",
          amount: { $sum: "$amount" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const dailyTrend = dailyResult.map(item => ({
      date: item._id,
      amount: item.amount
    }));

    return {
      totalSpent,
      categoryBreakdown,
      dailyTrend,
    };
  }

  // User profile operations
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    try {
      const profile = await UserProfileModel.findOne({ userId }).lean();
      return profile ? {
        id: profile._id.toString(),
        monthlyIncome: profile.monthlyIncome,
        currency: profile.currency,
        timezone: profile.timezone
      } : undefined;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return undefined;
    }
  }

  async updateUserProfile(userId: string, profile: Partial<InsertUserProfile & { id?: string }>): Promise<UserProfile> {
    const profileData = {
      userId,
      monthlyIncome: profile.monthlyIncome || 50000,
      currency: profile.currency || 'INR',
      timezone: profile.timezone || 'Asia/Kolkata'
    };

    const updatedProfile = await UserProfileModel.findOneAndUpdate(
      { userId },
      profileData,
      { upsert: true, new: true }
    );

    return {
      id: updatedProfile._id.toString(),
      monthlyIncome: updatedProfile.monthlyIncome,
      currency: updatedProfile.currency,
      timezone: updatedProfile.timezone
    };
  }
}

// Initialize storage based on database availability
let storage: IStorage;

// Initialize storage - prefer MongoDB but fallback to memory
const initializeStorage = () => {
  // Start with memory storage as safe default
  storage = new MemStorage();
  console.log('🚀 Starting with enhanced in-memory storage');
  console.log('💡 To use MongoDB, set MONGODB_URI environment variable to your MongoDB connection string');
  
  // Try to upgrade to MongoDB when ready
  const attemptMongoUpgrade = () => {
    try {
      if (mongoose.connection.readyState === 1) {
        storage = new MongoStorage();
        console.log('✅ Upgraded to MongoDB storage with persistent data');
        return true;
      }
    } catch (error) {
      console.log('⚠️  MongoDB upgrade failed, staying with memory storage');
    }
    return false;
  };
  
  // Try immediate upgrade
  setTimeout(attemptMongoUpgrade, 100);
  
  // Setup retry mechanism
  const retryInterval = setInterval(() => {
    if (attemptMongoUpgrade()) {
      clearInterval(retryInterval);
    }
  }, 2000);
  
  // Stop retrying after 30 seconds
  setTimeout(() => clearInterval(retryInterval), 30000);
};

// Initialize storage immediately
initializeStorage();

// Listen for database connection events
mongoose.connection.on('connected', () => {
  if (!(storage instanceof MongoStorage)) {
    storage = new MongoStorage();
    console.log('✅ Upgraded to MongoDB storage');
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected, using memory storage');
  if (!(storage instanceof MemStorage)) {
    storage = new MemStorage();
  }
});

export { storage };
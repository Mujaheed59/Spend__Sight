import * as fs from "fs";
import { GoogleGenAI } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExpenseCategorization {
  category: string;
  confidence: number;
  reasoning: string;
}

export interface AIInsight {
  type: 'alert' | 'goal' | 'warning' | 'recommendation';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export async function categorizeExpense(description: string, amount: number): Promise<ExpenseCategorization> {
  try {
    const systemPrompt = `You are an advanced expense categorization AI. Analyze expense descriptions and amounts to categorize them accurately.
          
          Available categories:
          - transportation: Transportation (uber, ola, taxi, bus, metro, train, fuel, petrol, diesel, parking, auto, rickshaw, bike, car, vehicle maintenance, travel within city)
          - food: Food & Dining (restaurants, groceries, coffee, food delivery, zomato, swiggy, dominos, mcdonald, kfc, starbucks, snacks, beverages, dining out)
          - shopping: Shopping (clothes, electronics, household items, amazon, flipkart, myntra, online purchases, general retail, gadgets, accessories)
          - entertainment: Entertainment (movies, games, netflix, spotify, prime, youtube, subscriptions, concerts, sports events, hobbies, cinema)
          - bills: Bills & Utilities (electricity, internet, phone, rent, insurance, loan payments, emi, mobile recharge, wifi, broadband)
          - healthcare: Healthcare (doctor visits, medicines, hospital bills, dental, health insurance, pharmacy, clinic, medical tests)
          - education: Education (courses, books, tuition, school, university, online learning, certifications, coaching)
          - travel: Travel (flights, hotels, vacation expenses, travel bookings, sightseeing, tour packages, airbnb)
          
          STRICT CATEGORIZATION RULES (follow exactly):
          
          TRANSPORTATION (highest priority for these keywords):
          - ANY mention of: uber, ola, taxi, cab, bus, metro, train, auto, rickshaw, petrol, diesel, fuel, parking
          - Vehicle related: bike, car, scooter, vehicle maintenance, service
          - Even if combined with other words: "ola ride", "uber to airport", "bus fare", "metro ticket"
          
          FOOD & DINING:
          - Restaurants: starbucks, mcdonald, kfc, dominos, pizza hut, burger king, subway
          - Food delivery: zomato, swiggy, uber eats, food panda, dunzo (food)
          - Food items: coffee, tea, lunch, dinner, breakfast, groceries, vegetables, fruits
          
          SHOPPING:
          - E-commerce: amazon, flipkart, myntra, nykaa (unless food items mentioned)
          - General retail: mall, market, shopping, clothes, electronics, gadgets
          
          ENTERTAINMENT:
          - Streaming: netflix, spotify, prime, youtube premium, hotstar, disney
          - Events: movie, cinema, concert, game, sports event
          
          BILLS & UTILITIES:
          - Services: electricity, internet, wifi, broadband, mobile recharge, phone bill
          - Payments: rent, emi, loan, insurance premium
          
          IMPORTANT: If description contains "ola", "uber", "taxi", "bus", "metro" - ALWAYS categorize as TRANSPORTATION, never shopping!
          
          Confidence scoring:
          - 0.9-1.0: Very clear keywords (e.g., "Starbucks Coffee", "Uber ride")
          - 0.7-0.89: Good context clues (e.g., "Movie tickets", "Grocery shopping")
          - 0.5-0.69: Reasonable inference (e.g., "Mall purchase", "Online payment")
          - 0.3-0.49: Uncertain, default to shopping
          
          Respond with JSON: { "category": "category_name", "confidence": 0.95, "reasoning": "brief explanation why this category fits" }`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            category: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["category", "confidence", "reasoning"],
        },
      },
      contents: `Categorize this expense: "${description}" with amount ₹${amount}`,
    });

    const rawJson = response.text;
    
    if (rawJson) {
      const result = JSON.parse(rawJson);
      return {
        category: result.category || 'shopping',
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
        reasoning: result.reasoning || 'AI categorization based on description'
      };
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error('Error categorizing expense:', error);
    return {
      category: 'shopping',
      confidence: 0.1,
      reasoning: 'Default categorization due to AI service error'
    };
  }
}

export async function generateInsights(
  expenses: Array<{ amount: number; categoryName: string; date: string; description: string }>,
  previousMonthExpenses: Array<{ amount: number; categoryName: string; date: string; description: string }>,
  budgets: Array<{ categoryName: string; amount: number }>
): Promise<AIInsight[]> {
  try {
    const currentTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const previousTotal = previousMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Calculate detailed category breakdowns
    const currentCategories = expenses.reduce((acc, exp) => {
      acc[exp.categoryName] = (acc[exp.categoryName] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const previousCategories = previousMonthExpenses.reduce((acc, exp) => {
      acc[exp.categoryName] = (acc[exp.categoryName] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate spending trends and patterns
    const categoryTrends = Object.keys(currentCategories).map(category => {
      const current = currentCategories[category] || 0;
      const previous = previousCategories[category] || 0;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      return { category, current, previous, change };
    });
    
    // Budget analysis
    const budgetAnalysis = budgets.map(budget => {
      const spent = currentCategories[budget.categoryName] || 0;
      const remaining = budget.amount - spent;
      const utilization = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      return { 
        category: budget.categoryName, 
        budget: budget.amount, 
        spent, 
        remaining, 
        utilization,
        isOverBudget: spent > budget.amount
      };
    });
    
    // Prepare comprehensive expense summary for AI
    const expenseSummary = {
      currentMonth: {
        total: currentTotal,
        categoryBreakdown: currentCategories,
        expenseCount: expenses.length,
        averageExpense: expenses.length > 0 ? currentTotal / expenses.length : 0
      },
      previousMonth: {
        total: previousTotal,
        categoryBreakdown: previousCategories,
        expenseCount: previousMonthExpenses.length
      },
      trends: categoryTrends,
      budgetAnalysis,
      totalBudget: budgets.reduce((sum, b) => sum + b.amount, 0),
      savingsOpportunities: categoryTrends.filter(t => t.change > 20).map(t => ({
        category: t.category,
        increase: t.change,
        currentSpend: t.current,
        potentialSaving: t.current * 0.15 // Suggest 15% reduction
      }))
    };

    const systemPrompt = `You are an expert personal financial advisor AI. Analyze real-time spending data and provide specific, actionable insights.
          
          Generate EXACTLY 3 insights based on the comprehensive data provided. Each insight must have:
          - type: "alert" (urgent overspending/budget violations), "goal" (achievements worth celebrating), "warning" (approaching budget limits), or "recommendation" (specific improvement suggestions)
          - title: Compelling, specific title (max 45 chars)
          - description: Detailed, actionable advice with exact amounts, percentages, and timeframes
          - priority: "low", "medium", or "high" based on financial impact
          
          PRIORITY ANALYSIS AREAS:
          1. Budget violations (over 100% utilization) - HIGH priority alerts
          2. Significant spending increases (>30% vs previous month) - HIGH priority warnings
          3. Categories approaching budget limits (80-100%) - MEDIUM priority warnings
          4. Savings opportunities from high-spend categories - MEDIUM priority recommendations
          5. Positive spending behaviors - LOW priority goals
          
          INSIGHT REQUIREMENTS:
          - Include specific ₹ amounts and percentages
          - Compare current vs previous month spending
          - Mention exact savings amounts possible
          - Provide realistic timelines (weekly/monthly targets)
          - Use encouraging tone for achievements, constructive for improvements
          - Be specific: "You spent ₹X more on Y" rather than "You spent more"
          
          EXAMPLES OF GOOD INSIGHTS:
          - "You spent 35% more on Food this month (₹4,200 vs ₹3,100). If you reduce dining out by 2 meals per week, you could save ₹800/month."
          - "Great job! You stayed 15% under budget in Transportation (₹1,700 vs ₹2,000 budget). Keep using public transport!"
          
          IMPORTANT: Generate exactly 3 insights, no more, no less. Focus on the most impactful financial insights.
          
          Respond with JSON: {"insights": [{"type": "alert", "title": "Food Budget Exceeded", "description": "You spent ₹4,200 on Food this month, 40% over your ₹3,000 budget. Consider meal planning to save ₹400/month.", "priority": "high"}]}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string" },
                },
                required: ["type", "title", "description", "priority"],
              },
            },
          },
          required: ["insights"],
        },
      },
      contents: `Analyze this spending data and provide insights: ${JSON.stringify(expenseSummary)}`,
    });

    const rawJson = response.text;
    
    if (!rawJson) {
      throw new Error("Empty response from model");
    }
    
    const result = JSON.parse(rawJson);
    
    return (result.insights || []).map((insight: any) => ({
      type: ['alert', 'goal', 'warning', 'recommendation'].includes(insight.type) ? insight.type : 'recommendation',
      title: insight.title || 'Financial Insight',
      description: insight.description || 'Review your spending patterns for better financial health.',
      priority: ['low', 'medium', 'high'].includes(insight.priority) ? insight.priority : 'medium'
    }));
  } catch (error) {
    console.error('Error generating insights:', error);
    return [
      {
        type: 'recommendation',
        title: 'Track Your Expenses',
        description: 'Continue logging your expenses to get personalized AI insights and recommendations.',
        priority: 'medium'
      },
      {
        type: 'goal',
        title: 'Building Financial Habits',
        description: 'Every expense you track helps build better financial awareness and spending habits.',
        priority: 'low'
      },
      {
        type: 'warning',
        title: 'AI Insights Unavailable',
        description: 'AI insights are temporarily unavailable. Keep tracking expenses for future analysis.',
        priority: 'low'
      }
    ];
  }
}

export async function generateBudgetRecommendations(
  expenses: Array<{ amount: number; categoryName: string; date: string }>,
  income?: number
): Promise<Record<string, number>> {
  try {
    const categoryTotals = expenses.reduce((acc, exp) => {
      acc[exp.categoryName] = (acc[exp.categoryName] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);

    const systemPrompt = `You are a financial planning expert. Based on spending history, recommend monthly budgets for each category.
          Consider the 50/30/20 rule and reasonable spending patterns.
          Respond with JSON where keys are category names and values are recommended amounts.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
      contents: `Recommend monthly budgets based on this spending: ${JSON.stringify(categoryTotals)}${income ? ` with monthly income: ₹${income}` : ''}`,
    });

    const rawJson = response.text;
    
    if (!rawJson) {
      throw new Error("Empty response from model");
    }
    
    const result = JSON.parse(rawJson);
    return result;
  } catch (error) {
    console.error('Error generating budget recommendations:', error);
    return {};
  }
}

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  PiggyBank, 
  Calendar,
  DollarSign,
  BarChart3,
  Lightbulb,
  RefreshCw,
  Award,
  CheckCircle
} from "lucide-react";

interface InsightData {
  type: 'spending_pattern' | 'budget_alert' | 'savings_opportunity' | 'goal_tracking';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  category?: string;
  amount?: number;
  percentage?: number;
  recommendation: string;
  actionable: boolean;
}

interface SpendingAnalysis {
  totalSpent: number;
  avgDailySpend: number;
  topCategory: string;
  topCategoryAmount: number;
  monthOverMonth: number;
  unusualTransactions: number;
  predictedMonthlySpend: number;
}

export default function AIInsightsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ['/api/insights'],
    retry: false,
  });

  const { data: expenses } = useQuery({
    queryKey: ['/api/expenses'],
    retry: false,
  });

  const { data: budgets } = useQuery({
    queryKey: ['/api/budgets'],
    retry: false,
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai/generate-insights");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
      toast({
        title: "AI Analysis Complete",
        description: "Fresh insights generated based on your latest spending patterns.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized", 
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive",
      });
    },
  });

  const spendingAnalysis = useMemo((): SpendingAnalysis => {
    if (!expenses) return {
      totalSpent: 0,
      avgDailySpend: 0,
      topCategory: '',
      topCategoryAmount: 0,
      monthOverMonth: 0,
      unusualTransactions: 0,
      predictedMonthlySpend: 0
    };

    const expenseData = expenses as any[];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const thisMonthExpenses = expenseData.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    });

    const totalSpent = thisMonthExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const daysInMonth = new Date().getDate();
    const avgDailySpend = totalSpent / daysInMonth;

    // Category analysis
    const categoryTotals = thisMonthExpenses.reduce((acc, expense) => {
      const category = expense.categoryName || 'Other';
      acc[category] = (acc[category] || 0) + parseFloat(expense.amount);
      return acc;
    }, {} as Record<string, number>);

    const topCategory = Object.entries(categoryTotals).reduce((max: [string, number], [cat, amount]) => 
      (amount as number) > max[1] ? [cat, amount as number] : max, ['', 0] as [string, number]);

    // Predict monthly spend
    const daysRemaining = new Date(currentYear, currentMonth + 1, 0).getDate() - daysInMonth;
    const predictedMonthlySpend = totalSpent + (avgDailySpend * daysRemaining);

    return {
      totalSpent,
      avgDailySpend,
      topCategory: topCategory[0],
      topCategoryAmount: topCategory[1] as number,
      monthOverMonth: 0, // Would need previous month data
      unusualTransactions: 0, // Would need more complex analysis
      predictedMonthlySpend
    };
  }, [expenses]);

  const handleGenerateInsights = useCallback(() => {
    generateInsightsMutation.mutate();
  }, [generateInsightsMutation]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <TrendingUp className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  if (insightsLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
              <Brain className="h-8 w-8 text-purple-500" />
              <span>AI Financial Insights</span>
            </h1>
            <p className="text-gray-600 mt-2">
              Intelligent analysis of your spending patterns and personalized financial recommendations
            </p>
          </div>
          <Button 
            onClick={handleGenerateInsights}
            disabled={generateInsightsMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${generateInsightsMutation.isPending ? 'animate-spin' : ''}`} />
            {generateInsightsMutation.isPending ? 'Analyzing...' : 'Refresh Insights'}
          </Button>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">This Month</p>
                  <p className="text-2xl font-bold">{formatCurrency(spendingAnalysis.totalSpent)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Daily Average</p>
                  <p className="text-2xl font-bold">{formatCurrency(spendingAnalysis.avgDailySpend)}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Top Category</p>
                  <p className="text-lg font-bold truncate">{spendingAnalysis.topCategory || 'None'}</p>
                  <p className="text-sm text-purple-200">{formatCurrency(spendingAnalysis.topCategoryAmount)}</p>
                </div>
                <Target className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Predicted Monthly</p>
                  <p className="text-2xl font-bold">{formatCurrency(spendingAnalysis.predictedMonthlySpend)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patterns">Spending Patterns</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    <span>Smart Insights</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(insights as any) && (insights as any).length > 0 ? (
                    <div className="space-y-4">
                      {(insights as any).slice(0, 3).map((insight: InsightData, index: number) => (
                        <div key={index} className={`p-4 rounded-lg border ${getSeverityColor(insight.severity)}`}>
                          <div className="flex items-start space-x-3">
                            {getSeverityIcon(insight.severity)}
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{insight.title}</h4>
                              <p className="text-xs mt-1 opacity-90">{insight.description}</p>
                              {insight.actionable && (
                                <Badge variant="outline" className="mt-2 text-xs">
                                  <Target className="h-3 w-3 mr-1" />
                                  Actionable
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No insights generated yet</p>
                      <Button 
                        onClick={handleGenerateInsights}
                        className="mt-4"
                        disabled={generateInsightsMutation.isPending}
                      >
                        Generate Insights
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Budget Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PiggyBank className="h-5 w-5 text-green-500" />
                    <span>Budget Health</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(budgets as any) && (budgets as any).length > 0 ? (
                    <div className="space-y-4">
                      {(budgets as any).slice(0, 3).map((budget: any, index: number) => {
                        const spent = 0; // Would calculate from expenses
                        const budgetAmount = parseFloat(budget.amount) || 1;
                        const percentage = (spent / budgetAmount) * 100;
                        return (
                          <div key={index} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{budget.categoryName || 'All Categories'}</span>
                              <span>{percentage.toFixed(0)}%</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>{formatCurrency(spent)}</span>
                              <span>{formatCurrency(parseFloat(budget.amount))}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No budgets set</p>
                      <p className="text-xs text-gray-500">Create budgets to track your progress</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Spending Pattern Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Advanced pattern analysis coming soon</p>
                  <p className="text-xs text-gray-500">We're building detailed spending behavior insights</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personalized Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">AI recommendations will appear here</p>
                  <p className="text-xs text-gray-500">Based on your spending patterns and goals</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="goals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial Goals Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Goal tracking feature coming soon</p>
                  <p className="text-xs text-gray-500">Set and monitor your financial objectives</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
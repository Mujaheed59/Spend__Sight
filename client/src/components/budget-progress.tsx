import React, { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Target, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";

interface BudgetProgressProps {
  onOpenBudgetSettings?: () => void;
}

export function BudgetProgress({ onOpenBudgetSettings }: BudgetProgressProps) {
  const { data: budgets, isLoading } = useQuery({
    queryKey: ['/api/budgets'],
    retry: false,
  });

  const { data: expenses } = useQuery({
    queryKey: ['/api/expenses'],
    retry: false,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['/api/user/profile'],
    retry: false,
  });

  const { data: categories } = useQuery({
    queryKey: ['/api/categories'],
    retry: false,
  });

  const budgetData = useMemo(() => {
    if (!budgets || !expenses || !categories) return [];

    return (budgets as any[]).map((budget: any) => {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      // Get category name
      const category = (categories as any[])?.find((cat: any) => cat.id === budget.categoryId);
      const categoryName = category?.name || (budget.categoryId === 'all' ? 'All Categories' : 'Unknown Category');
      
      // Calculate spent amount for this budget's category in current period
      const categoryExpenses = (expenses as any[]).filter((expense: any) => {
        const expenseDate = new Date(expense.date);
        const isCurrentPeriod = budget.period === 'monthly' 
          ? expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear
          : true; // Add logic for weekly/yearly if needed

        return isCurrentPeriod && (
          !budget.categoryId || 
          budget.categoryId === 'all' || 
          expense.categoryId === budget.categoryId
        );
      });

      const spent = categoryExpenses.reduce((sum: number, expense: any) => sum + parseFloat(expense.amount), 0);
      const budgetAmount = parseFloat(budget.amount);
      const percentage = Math.min((spent / budgetAmount) * 100, 100);
      const remaining = Math.max(budgetAmount - spent, 0);
      
      return {
        ...budget,
        categoryName,
        spent,
        budgetAmount,
        percentage,
        remaining,
        isOverBudget: spent > budgetAmount,
        categoryExpenses: categoryExpenses.length
      };
    });
  }, [budgets, expenses, categories]);

  const monthlyIncome = useMemo(() => {
    return (userProfile as any)?.monthlyIncome || 0;
  }, [userProfile]);

  const totalBudgetedAmount = useMemo(() => {
    return budgetData.reduce((sum, budget) => sum + budget.budgetAmount, 0);
  }, [budgetData]);

  const totalSpentAmount = useMemo(() => {
    return budgetData.reduce((sum, budget) => sum + budget.spent, 0);
  }, [budgetData]);

  const incomeUtilization = useMemo(() => {
    if (!monthlyIncome) return 0;
    return Math.min((totalBudgetedAmount / monthlyIncome) * 100, 100);
  }, [monthlyIncome, totalBudgetedAmount]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressColor = (percentage: number, isOverBudget: boolean) => {
    if (isOverBudget) return "bg-red-500";
    if (percentage >= 80) return "bg-yellow-500";
    if (percentage >= 60) return "bg-orange-500";
    return "bg-green-500";
  };

  if (isLoading) {
    return (
      <Card className="bg-white shadow animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow" data-testid="budget-progress-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center space-x-2 text-lg font-medium text-gray-900">
          <Target className="h-5 w-5 text-blue-500" />
          <span>Budget Progress</span>
        </CardTitle>
        {onOpenBudgetSettings && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onOpenBudgetSettings}
            data-testid="button-manage-budgets"
          >
            Manage
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Income vs Budget Overview */}
        {monthlyIncome > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-900">Monthly Income Allocation</span>
              <span className="text-sm text-blue-700">{incomeUtilization.toFixed(1)}%</span>
            </div>
            <Progress 
              value={incomeUtilization} 
              className="h-2 mb-2" 
            />
            <div className="flex justify-between text-xs text-blue-600">
              <span>Income: {formatCurrency(monthlyIncome)}</span>
              <span>Budgeted: {formatCurrency(totalBudgetedAmount)}</span>
            </div>
          </div>
        )}

        {budgetData && budgetData.length > 0 ? (
          <div className="space-y-4" data-testid="budget-progress-list">
            {budgetData.map((budget: any, index: number) => (
              <div 
                key={budget.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                data-testid={`budget-progress-${index}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-sm text-gray-900">
                        {budget.categoryName}
                      </h4>
                      <Badge 
                        variant={budget.isOverBudget ? "destructive" : budget.percentage >= 80 ? "secondary" : "default"}
                        className="text-xs"
                      >
                        {budget.isOverBudget ? (
                          <>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Over Budget
                          </>
                        ) : budget.percentage >= 80 ? (
                          <>
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Near Limit
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            On Track
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 space-x-3">
                      <span>{budget.period} • {budget.categoryExpenses} transactions</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(budget.spent)} / {formatCurrency(budget.budgetAmount)}
                    </div>
                    <div className={`text-xs ${budget.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                      {budget.isOverBudget ? 'Exceeded by ' : 'Remaining: '}
                      {formatCurrency(budget.isOverBudget ? budget.spent - budget.budgetAmount : budget.remaining)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{budget.percentage.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={budget.percentage} 
                    className="h-2" 
                    // className={`h-2 ${getProgressColor(budget.percentage, budget.isOverBudget)}`}
                  />
                </div>
              </div>
            ))}

            {/* Total Summary */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">Total this month</span>
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {formatCurrency(totalSpentAmount)} / {formatCurrency(totalBudgetedAmount)}
                  </div>
                  <div className="text-xs text-gray-600">
                    {((totalSpentAmount / totalBudgetedAmount) * 100).toFixed(1)}% of budget used
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No budgets set</h3>
            <p className="text-gray-600 mb-4">
              Create budgets to track your spending and reach your financial goals.
            </p>
            {onOpenBudgetSettings && (
              <Button onClick={onOpenBudgetSettings}>
                <Target className="h-4 w-4 mr-2" />
                Set Your First Budget
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
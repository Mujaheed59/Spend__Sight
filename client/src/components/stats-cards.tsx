import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, CheckCircle, Tag, Lightbulb } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";

export function StatsCards() {
  const { toast } = useToast();
  
  // Memoize current month date range to prevent recalculation on every render
  const { startOfMonth, endOfMonth } = useMemo(() => {
    const now = new Date();
    return {
      startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      endOfMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    };
  }, []);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/analytics/stats', { startDate: startOfMonth, endDate: endOfMonth }],
    retry: false,
  });

  const { data: insights } = useQuery({
    queryKey: ['/api/insights'],
    retry: false,
  });

  const { data: budgets } = useQuery({
    queryKey: ['/api/budgets'],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={`skeleton-card-${i}`} className="animate-pulse">
            <CardContent className="p-5">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Memoize expensive calculations to prevent unnecessary re-computations
  const { totalSpent, categoriesUsed, topCategory, unreadInsights, budgetInfo } = useMemo(() => {
    const totalSpent = (stats as any)?.totalSpent || 0;
    const categoriesUsed = (stats as any)?.categoryBreakdown?.length || 0;
    const topCategory = (stats as any)?.categoryBreakdown?.[0];
    const unreadInsights = (insights as any)?.filter((insight: any) => insight.isRead === "false")?.length || 0;
    
    // Calculate budget status
    const currentMonthBudgets = (budgets as any)?.filter((budget: any) => {
      const budgetStart = new Date(budget.startDate);
      const budgetEnd = new Date(budget.endDate);
      const now = new Date();
      return now >= budgetStart && now <= budgetEnd && budget.period === 'monthly';
    }) || [];
    
    const totalBudget = currentMonthBudgets.reduce((sum: number, budget: any) => sum + parseFloat(budget.amount), 0);
    const budgetRemaining = totalBudget - totalSpent;
    const budgetStatus = totalBudget === 0 ? 'No Budget Set' : 
                        budgetRemaining >= 0 ? 'On Track' : 'Over Budget';
    const budgetStatusColor = totalBudget === 0 ? 'text-gray-600' :
                             budgetRemaining >= 0 ? 'text-green-600' : 'text-red-600';
    
    return {
      totalSpent,
      categoriesUsed,
      topCategory,
      unreadInsights,
      budgetInfo: { totalBudget, budgetRemaining, budgetStatus, budgetStatusColor }
    };
  }, [stats, insights, budgets]);

  // Memoize currency formatter to prevent recreation on every render
  const formatCurrency = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    });
    return (amount: number) => formatter.format(amount);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Spent Card */}
      <Card className="bg-white overflow-hidden shadow">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Spent</dt>
                <dd className="text-lg font-medium text-gray-900" data-testid="text-total-spent">
                  {formatCurrency(totalSpent)}
                </dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="font-medium text-gray-600">This month</span>
          </div>
        </div>
      </Card>

      {/* Budget Status Card */}
      <Card className="bg-white overflow-hidden shadow">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                budgetInfo.totalBudget === 0 ? 'bg-gray-100' : budgetInfo.budgetRemaining >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <CheckCircle className={`w-5 h-5 ${
                  budgetInfo.totalBudget === 0 ? 'text-gray-600' : budgetInfo.budgetRemaining >= 0 ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Budget Status</dt>
                <dd className="text-lg font-medium text-gray-900" data-testid="text-budget-status">
                  {budgetInfo.budgetStatus}
                </dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className={`font-medium ${budgetInfo.budgetStatusColor}`}>
              {budgetInfo.totalBudget === 0 
                ? 'Set budgets to track spending' 
                : budgetInfo.budgetRemaining >= 0 
                  ? `${formatCurrency(budgetInfo.budgetRemaining)} remaining` 
                  : `${formatCurrency(Math.abs(budgetInfo.budgetRemaining))} over budget`}
            </span>
          </div>
        </div>
      </Card>

      {/* Categories Used Card */}
      <Card className="bg-white overflow-hidden shadow">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Tag className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Categories Used</dt>
                <dd className="text-lg font-medium text-gray-900" data-testid="text-categories-count">
                  {categoriesUsed}
                </dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="font-medium text-gray-600" data-testid="text-top-category">
              {topCategory ? `${topCategory.categoryName} (${((topCategory.amount / totalSpent) * 100).toFixed(0)}%)` : 'No expenses yet'}
            </span>
          </div>
        </div>
      </Card>

      {/* AI Insights Card */}
      <Card className="bg-white overflow-hidden shadow">
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">AI Insights</dt>
                <dd className="text-lg font-medium text-gray-900" data-testid="text-insights-count">
                  {unreadInsights} New
                </dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="font-medium text-purple-600">
              {unreadInsights > 0 ? 'New recommendations available' : 'All insights reviewed'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

export function ExpenseChart() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("30");

  // Memoize date range calculation to prevent unnecessary API calls
  const dateRange = useMemo(() => {
    const days = parseInt(period);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, [period]);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/stats', dateRange],
    queryFn: async () => {
      const response = await fetch('/api/analytics/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return response.json();
    },
    retry: false,
  });

  const { data: financeNews, isLoading: newsLoading } = useQuery({
    queryKey: ['/api/finance-news'],
    queryFn: async () => {
      const response = await fetch('/api/finance-news');
      if (!response.ok) {
        throw new Error('Failed to fetch finance news');
      }
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Memoize currency formatter - MOVED BEFORE EARLY RETURNS
  const formatCurrency = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    });
    return (value: number) => formatter.format(value);
  }, []);

  // Memoize chart data to prevent unnecessary re-renders - MOVED BEFORE EARLY RETURNS
  const categoryData = useMemo(() => {
    const data = (stats as any)?.categoryBreakdown?.map((cat: any) => ({
      name: cat.categoryName,
      value: cat.amount,
      color: cat.color,
    })) || [];
    
    return data;
  }, [stats]);

  // Color palette for pie chart
  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

  if (isLoading || newsLoading) {
    return (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleNewsClick = (newsItem: any) => {
    // Open news article in new tab/window
    if (newsItem.url) {
      window.open(newsItem.url, '_blank');
    }
  };

  return (
    <>
      {/* Finance News Feed */}
      <Card className="bg-white shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <CardTitle className="text-lg font-medium text-gray-900">📈 Finance News</CardTitle>
          <span className="text-sm text-gray-500">Latest Updates</span>
        </CardHeader>
        <CardContent>
          <div className="h-64 overflow-y-auto space-y-3" data-testid="finance-news-feed">
            {(financeNews as any) && (financeNews as any).length > 0 ? (
              (financeNews as any).map((newsItem: any, index: number) => (
                <div 
                  key={index}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleNewsClick(newsItem)}
                  data-testid={`news-item-${index}`}
                >
                  <h4 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">
                    {newsItem.title}
                  </h4>
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {newsItem.description}
                  </p>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span className="font-medium">{newsItem.source}</span>
                    <span>{newsItem.publishedAt}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="text-sm font-medium">📰 Finance news loading...</p>
                  <p className="text-xs">Stay updated with latest market trends</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Category Breakdown Chart */}
      <Card className="bg-white shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <CardTitle className="text-lg font-medium text-gray-900">💰 Spending Breakdown</CardTitle>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32" data-testid="select-category-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-64" data-testid="chart-category-breakdown">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={30}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((entry: any, index: number) => (
                      <Cell 
                        key={`category-cell-${entry.name}-${index}`} 
                        fill={entry.color || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    labelFormatter={(label) => `Category: ${label}`}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="text-lg font-medium">📊 No expenses yet</p>
                  <p className="text-sm">Add your first expense to see the breakdown</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

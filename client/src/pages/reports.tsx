import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { 
  FileText, 
  Calendar, 
  Filter,
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3
} from "lucide-react";

interface ReportFilters {
  startDate: string;
  endDate: string;
  category: string;
  minAmount: string;
  maxAmount: string;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    category: 'all',
    minAmount: '',
    maxAmount: ''
  });
  const [reportType, setReportType] = useState('summary');

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['/api/expenses'],
    retry: false,
  });

  const { data: categories } = useQuery({
    queryKey: ['/api/categories'],
    retry: false,
  });

  const { data: budgets } = useQuery({
    queryKey: ['/api/budgets'],
    retry: false,
  });

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    
    return (expenses as any[]).filter(expense => {
      const expenseDate = new Date(expense.date);
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      const amount = parseFloat(expense.amount);
      
      // Date filter
      if (expenseDate < startDate || expenseDate > endDate) return false;
      
      // Category filter
      if (filters.category !== 'all' && expense.categoryId !== filters.category) return false;
      
      // Amount filters
      if (filters.minAmount && amount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && amount > parseFloat(filters.maxAmount)) return false;
      
      return true;
    });
  }, [expenses, filters]);

  const reportData = useMemo(() => {
    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const avgAmount = filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0;
    
    // Category breakdown
    const categoryBreakdown = filteredExpenses.reduce((acc, expense) => {
      const category = expense.categoryName || 'Other';
      const amount = parseFloat(expense.amount);
      acc[category] = (acc[category] || 0) + (isNaN(amount) ? 0 : amount);
      return acc;
    }, {} as Record<string, number>);

    const categoryData = Object.entries(categoryBreakdown).map(([name, value]) => ({
      name,
      value,
      percentage: totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : "0"
    }));

    // Daily spending trend
    const dailySpending = filteredExpenses.reduce((acc, expense) => {
      const date = new Date(expense.date).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + parseFloat(expense.amount);
      return acc;
    }, {} as Record<string, number>);

    const trendData = Object.entries(dailySpending)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date,
        amount,
        formattedDate: new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      }));

    return {
      totalAmount,
      avgAmount,
      transactionCount: filteredExpenses.length,
      categoryData,
      trendData,
      topCategory: categoryData.length > 0 ? categoryData.reduce((max, cat) => cat.value > max.value ? cat : max) : null
    };
  }, [filteredExpenses]);

  const handleFilterChange = useCallback((key: keyof ReportFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };



  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

  if (expensesLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center space-x-3">
              <FileText className="h-6 md:h-8 w-6 md:w-8 text-blue-500" />
              <span>Financial Reports</span>
            </h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Comprehensive analysis of your spending patterns and financial health
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-lg">
              <Filter className="h-5 w-5" />
              <span>Report Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="startDate" className="text-sm">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-sm">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="category" className="text-sm">Category</Label>
                <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {(categories as any)?.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="minAmount" className="text-sm">Min Amount (₹)</Label>
                <Input
                  id="minAmount"
                  type="number"
                  placeholder="0"
                  value={filters.minAmount}
                  onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="maxAmount" className="text-sm">Max Amount (₹)</Label>
                <Input
                  id="maxAmount"
                  type="number"
                  placeholder="No limit"
                  value={filters.maxAmount}
                  onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Content */}
        <div id="report-content" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-xs md:text-sm">Total Spent</p>
                    <p className="text-lg md:text-2xl font-bold">{formatCurrency(reportData.totalAmount)}</p>
                  </div>
                  <DollarSign className="h-6 md:h-8 w-6 md:w-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-xs md:text-sm">Average</p>
                    <p className="text-lg md:text-2xl font-bold">{formatCurrency(reportData.avgAmount)}</p>
                  </div>
                  <TrendingUp className="h-6 md:h-8 w-6 md:w-8 text-green-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-xs md:text-sm">Transactions</p>
                    <p className="text-lg md:text-2xl font-bold">{reportData.transactionCount}</p>
                  </div>
                  <BarChart3 className="h-6 md:h-8 w-6 md:w-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-xs md:text-sm">Top Category</p>
                    <p className="text-sm md:text-lg font-bold truncate">
                      {reportData.topCategory?.name || 'None'}
                    </p>
                    {reportData.topCategory && (
                      <p className="text-xs text-orange-200">
                        {formatCurrency(Number(reportData.topCategory.value))}
                      </p>
                    )}
                  </div>
                  <PieChartIcon className="h-6 md:h-8 w-6 md:w-8 text-orange-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spending Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 md:h-80">
                  {reportData.trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reportData.trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="formattedDate" 
                          stroke="#666"
                          fontSize={12}
                        />
                        <YAxis 
                          tickFormatter={(value) => `₹${value}`}
                          stroke="#666"
                          fontSize={12}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'Amount']}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="#2563eb" 
                          strokeWidth={2}
                          dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm">No data for selected period</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 md:h-80">
                  {reportData.categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportData.categoryData}
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          innerRadius={30}
                          dataKey="value"
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                          labelLine={false}
                          fontSize={12}
                        >
                          {reportData.categoryData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend fontSize={12} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <PieChartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm">No expenses in selected period</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transaction Details */}
          {filteredExpenses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transaction Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-right p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.slice(0, 20).map((expense: any, index: number) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-2">{new Date(expense.date).toLocaleDateString('en-IN')}</td>
                          <td className="p-2 truncate max-w-xs">{expense.description}</td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-xs">
                              {expense.categoryName || 'Other'}
                            </Badge>
                          </td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(parseFloat(expense.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredExpenses.length > 20 && (
                    <p className="text-center text-gray-500 text-sm mt-4">
                      Showing 20 of {filteredExpenses.length} transactions. Export for full data.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
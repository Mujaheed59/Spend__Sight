import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, TrendingUp, DollarSign, Building, Globe, RefreshCw } from "lucide-react";

interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
}

interface FinanceNewsProps {
  compact?: boolean;
}

export function FinanceNews({ compact = false }: FinanceNewsProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: financeNews, isLoading, refetch } = useQuery({
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

  const handleNewsClick = useCallback((newsItem: NewsItem) => {
    if (newsItem.url) {
      window.open(newsItem.url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
    toast({
      title: "Refreshing News",
      description: "Getting latest finance updates...",
    });
  }, [refetch, toast]);

  const categories = useMemo(() => {
    if (!financeNews) return [];
    const cats = ['all', ...new Set((financeNews as NewsItem[]).map(item => item.category))];
    return cats;
  }, [financeNews]);

  const filteredNews = useMemo(() => {
    if (!financeNews) return [];
    if (selectedCategory === 'all') return financeNews as NewsItem[];
    return (financeNews as NewsItem[]).filter(item => item.category === selectedCategory);
  }, [financeNews, selectedCategory]);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'fintech': return <TrendingUp className="h-3 w-3" />;
      case 'banking': return <Building className="h-3 w-3" />;
      case 'markets': return <DollarSign className="h-3 w-3" />;
      default: return <Globe className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <Card className={`bg-white shadow ${compact ? 'h-64' : 'h-96'}`}>
        <CardHeader className="pb-3">
          <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(compact ? 3 : 5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white shadow ${compact ? 'h-64' : 'h-96'}`} data-testid="finance-news-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg font-medium text-gray-900">
          <TrendingUp className="h-5 w-5 text-orange-500" />
          <span>📈 Finance News</span>
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isLoading}
          data-testid="button-refresh-news"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {!compact && categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedCategory(category)}
              >
                {getCategoryIcon(category)}
                <span className="ml-1 capitalize">{category}</span>
              </Badge>
            ))}
          </div>
        )}

        <div 
          className={`${compact ? 'h-44' : 'h-64'} overflow-y-auto space-y-3`} 
          data-testid="finance-news-feed"
        >
          {filteredNews && filteredNews.length > 0 ? (
            filteredNews.slice(0, compact ? 4 : 8).map((newsItem: NewsItem, index: number) => (
              <div 
                key={index}
                className="p-3 border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-300 cursor-pointer transition-all duration-200 group"
                onClick={() => handleNewsClick(newsItem)}
                data-testid={`news-item-${index}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-sm text-gray-900 group-hover:text-orange-700 line-clamp-2 flex-1">
                    {newsItem.title}
                  </h4>
                  <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-orange-500 ml-2 flex-shrink-0" />
                </div>
                
                {!compact && (
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {newsItem.description}
                  </p>
                )}
                
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-xs">
                      {getCategoryIcon(newsItem.category)}
                      <span className="ml-1">{newsItem.source}</span>
                    </Badge>
                  </div>
                  <span className="text-gray-500">
                    {new Date(newsItem.publishedAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium">📰 Loading finance news...</p>
                <p className="text-xs">Stay updated with latest market trends</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
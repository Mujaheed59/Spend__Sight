"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, CheckCircle, AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const getInsightIcon = (type: string) => {
  switch (type) {
    case "alert":
      return <Info className="w-5 h-5 text-blue-600" />;
    case "goal":
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case "warning":
      return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    case "recommendation":
      return <Lightbulb className="w-5 h-5 text-purple-600" />;
    default:
      return <Info className="w-5 h-5 text-blue-600" />;
  }
};

const getInsightColor = (type: string, priority: string) => {
  if (priority === "high") {
    switch (type) {
      case "alert":
        return "bg-red-50 border-red-300 text-red-900";
      case "warning":
        return "bg-orange-50 border-orange-300 text-orange-900";
      default:
        return "bg-red-50 border-red-300 text-red-900";
    }
  }

  switch (type) {
    case "alert":
      return "bg-red-50 border-red-200 text-red-800";
    case "goal":
      return "bg-green-50 border-green-200 text-green-800";
    case "warning":
      return "bg-amber-50 border-amber-200 text-amber-800";
    case "recommendation":
      return "bg-blue-50 border-blue-200 text-blue-800";
    default:
      return "bg-gray-50 border-gray-200 text-gray-800";
  }
};

export function AIInsights() {
  const { toast } = useToast();
  const [customInsights, setCustomInsights] = useState<any>(null);

  const { data: insights, isLoading } = useQuery({
    queryKey: ["/api/insights"],
    retry: false,
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/insights/generate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      toast({
        title: "New Insights Generated",
        description:
          "AI has analyzed your spending and generated new recommendations.",
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
        description: "Failed to generate new insights. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markInsightReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PUT", `/api/insights/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
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
    },
  });

  const handleGenerateInsights = () => {
    generateInsightsMutation.mutate();
  };

  const handleMarkAsRead = (id: string) => {
    markInsightReadMutation.mutate(id);
  };

  // 🔹 New: Fetch custom range insights
  const handleCustomInsights = async () => {
    try {
      const res = await apiRequest("POST", "/api/insights/custom", {
        start: "2025-08-01",
        end: "2025-08-31",
      });
      setCustomInsights(res);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to fetch custom insights.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white shadow animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
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
    <Card className="bg-white shadow" data-testid="card-ai-insights">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <span>AI Insights</span>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateInsights}
              disabled={generateInsightsMutation.isPending}
              data-testid="button-generate-insights"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${
                  generateInsightsMutation.isPending ? "animate-spin" : ""
                }`}
              />
              {generateInsightsMutation.isPending ? "Generating..." : "Generate"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCustomInsights}
              data-testid="button-custom-insights"
            >
              Custom Range
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 🔹 Default saved insights */}
        {(insights as any) && (insights as any).length > 0 ? (
          <div className="space-y-4" data-testid="insights-list">
            {(insights as any)
              .sort((a: any, b: any) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return (
                  (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
                  (priorityOrder[a.priority as keyof typeof priorityOrder] || 0)
                );
              })
              .map((insight: any) => (
                <div
                  key={insight.id}
                  className={`p-4 rounded-lg border ${getInsightColor(
                    insight.type,
                    insight.priority
                  )} transition-all hover:shadow-md`}
                  data-testid={`insight-${insight.id}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className="text-sm font-medium mb-1"
                        data-testid={`insight-title-${insight.id}`}
                      >
                        {insight.title}
                      </h4>
                      <p
                        className="text-sm opacity-90 leading-relaxed"
                        data-testid={`insight-message-${insight.id}`}
                      >
                        {insight.description || insight.message}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-600">
                          {insight.priority === "high" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              High Priority
                            </span>
                          )}
                          {insight.priority === "medium" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Medium Priority
                            </span>
                          )}
                          {insight.priority === "low" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Low Priority
                            </span>
                          )}
                        </span>
                        {insight.isRead === "false" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMarkAsRead(insight.id)}
                            className="text-xs"
                            data-testid={`button-mark-read-${insight.id}`}
                          >
                            Mark as Read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Lightbulb className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No insights yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Add some expenses to get AI-powered insights and recommendations.
            </p>
            <div className="mt-6">
              <Button
                onClick={handleGenerateInsights}
                disabled={generateInsightsMutation.isPending}
                data-testid="button-generate-first-insights"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    generateInsightsMutation.isPending ? "animate-spin" : ""
                  }`}
                />
                Generate First Insights
              </Button>
            </div>
          </div>
        )}

        {/* 🔹 Custom insights result */}
        {customInsights && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-bold text-lg">Custom Insights (Aug 2025)</h3>
            <p className="mt-2 text-sm text-gray-700">
              <strong>Recommendations:</strong> {customInsights.recommendations}
            </p>
            <p className="mt-2 text-sm text-gray-700">
              <strong>Savings Tips:</strong> {customInsights.savingsTips}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

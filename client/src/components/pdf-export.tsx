import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PDFExportProps {
  onClose: () => void;
}

export function PDFExport({ onClose }: PDFExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const { data: expenses = [] } = useQuery({
    queryKey: ['/api/expenses'],
  });

  const { data: analytics } = useQuery({
    queryKey: ['/api/analytics/stats'],
  });

  const { data: insights = [] } = useQuery({
    queryKey: ['/api/insights'],
  });

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      // Create a temporary container for the report
      const reportElement = document.createElement('div');
      reportElement.style.width = '800px';
      reportElement.style.padding = '20px';
      reportElement.style.backgroundColor = 'white';
      reportElement.style.fontFamily = 'Arial, sans-serif';
      reportElement.style.position = 'absolute';
      reportElement.style.left = '-9999px';
      
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      reportElement.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="/@assets/generated_images/SpendSight_finance_tracker_logo_f7c8de5f.png" 
               alt="SpendSight Logo" 
               style="width: 50px; height: 50px; margin-bottom: 10px;">
          <h1 style="color: #2563eb; margin: 10px 0;">SpendSight Financial Report</h1>
          <p style="color: #666; margin: 0;">Generated on ${currentDate}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #333; border-bottom: 2px solid #6366f1; padding-bottom: 5px;">Financial Summary</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 15px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
              <h3 style="margin: 0 0 5px 0; color: #333;">Total Spent</h3>
              <p style="font-size: 24px; font-weight: bold; color: #ef4444; margin: 0;">₹${(analytics as any)?.totalSpent || 0}</p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
              <h3 style="margin: 0 0 5px 0; color: #333;">Total Expenses</h3>
              <p style="font-size: 24px; font-weight: bold; color: #6366f1; margin: 0;">${(expenses as any[]).length}</p>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #333; border-bottom: 2px solid #6366f1; padding-bottom: 5px;">Category Breakdown</h2>
          <div style="margin-top: 15px;">
            ${(analytics as any)?.categoryBreakdown?.map((cat: any) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #e5e7eb;">
                <div style="display: flex; align-items: center;">
                  <div style="width: 12px; height: 12px; background-color: ${cat.color}; border-radius: 50%; margin-right: 10px;"></div>
                  <span style="font-weight: 500;">${cat.categoryName}</span>
                </div>
                <span style="font-weight: bold;">₹${cat.amount}</span>
              </div>
            `).join('') || '<p>No category data available</p>'}
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #333; border-bottom: 2px solid #6366f1; padding-bottom: 5px;">AI Insights</h2>
          <div style="margin-top: 15px;">
            ${Array.isArray(insights) ? insights.slice(0, 3).map((insight: any, index: number) => 
              `<div style="background: ${insight.type === 'alert' ? '#fef2f2' : insight.type === 'warning' ? '#fffbeb' : insight.type === 'goal' ? '#f0fdf4' : '#f8fafc'}; 
                          border-left: 4px solid ${insight.type === 'alert' ? '#ef4444' : insight.type === 'warning' ? '#f59e0b' : insight.type === 'goal' ? '#10b981' : '#6366f1'}; 
                          padding: 15px; margin-bottom: 15px; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">• ${insight.title}</h3>
                <p style="margin: 0; color: #666; line-height: 1.5;">${insight.description}</p>
              </div>`
            ).join('') : '<p>No insights available</p>'}
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #333; border-bottom: 2px solid #6366f1; padding-bottom: 5px;">Recent Expenses</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Date</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Category</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${Array.isArray(expenses) ? expenses.slice(0, 10).map((expense: any) => 
                `<tr>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date(expense.date).toLocaleDateString()}</td>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">${expense.description}</td>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">${expense.category?.name || 'Uncategorized'}</td>
                  <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">₹${expense.amount}</td>
                </tr>`
              ).join('') : '<tr><td colspan="4" style="padding: 20px; text-align: center;">No expenses found</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #666; font-size: 12px; margin: 0;">Generated by ExpenseAI - Smart Financial Management</p>
        </div>
      `;

      document.body.appendChild(reportElement);

      // Generate canvas from the element
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff'
      });

      // Remove temporary element
      document.body.removeChild(reportElement);

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Download the PDF
      const fileName = `ExpenseAI_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      toast({
        title: "Export Successful",
        description: "Your financial report has been downloaded as PDF.",
      });

      onClose();
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-primary" />
          <span>Export PDF Report</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>Generate a comprehensive financial report including:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Financial summary and statistics</li>
            <li>Category breakdown with visualizations</li>
            <li>AI-generated insights and recommendations</li>
            <li>Recent expense transactions</li>
          </ul>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            onClick={generatePDF} 
            disabled={isGenerating}
            className="flex-1"
            data-testid="button-generate-pdf"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Plus, 
  Tags, 
  FileText, 
  Brain,
  Target,
  LogOut,
  User
} from "lucide-react";

const navigation = [
  { name: 'Dashboard', href: '#', icon: LayoutDashboard, current: true, action: null },
  { name: 'Add Expense', href: '#', icon: Plus, current: false, action: 'add-expense' },
  { name: 'Categories', href: '#', icon: Tags, current: false, action: 'manage-categories' },
  { name: 'Budgets', href: '#', icon: Target, current: false, action: 'budget-settings' },
  { name: 'Reports', href: '#', icon: FileText, current: false, action: 'export-reports' },
  { name: 'AI Insights', href: '#', icon: Brain, current: false, action: 'generate-insights' },
];

interface SidebarProps {
  onNavigate?: (action: string) => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleNavClick = (item: any) => {
    if (item.action && onNavigate) {
      onNavigate(item.action);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-4">
          <img 
            src="/@assets/generated_images/SpendSight_finance_tracker_logo_f7c8de5f.png" 
            alt="SpendSight Logo" 
            className="w-8 h-8 rounded-lg"
          />
          <span className="ml-2 text-xl font-semibold text-gray-900">SpendSight</span>
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex-1" data-testid="sidebar-navigation">
          <div className="px-2 space-y-1">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavClick(item)}
                className={cn(
                  item.current
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left'
                )}
                data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* User Profile */}
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <div className="flex-shrink-0 group block w-full">
          <div className="flex items-center">
            <div>
              {(user as any)?.profileImageUrl ? (
                <img 
                  className="inline-block h-9 w-9 rounded-full object-cover" 
                  src={(user as any).profileImageUrl} 
                  alt="User avatar"
                  data-testid="img-user-avatar"
                />
              ) : (
                <div className="inline-block h-9 w-9 rounded-full bg-gray-300 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
              )}
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900" data-testid="text-user-name">
                {(user as any)?.firstName && (user as any)?.lastName 
                  ? `${(user as any).firstName} ${(user as any).lastName}`
                  : (user as any)?.email || 'User'
                }
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-xs text-gray-500 hover:text-gray-700 p-0 h-auto"
                data-testid="button-logout"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

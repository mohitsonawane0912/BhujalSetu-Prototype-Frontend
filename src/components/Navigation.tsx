import React from 'react';
import {
  Home,
  Scale,
  LineChart,
  CheckSquare,
  Users,
} from 'lucide-react';

export type TabType = 'home' | 'balance' | 'trends' | 'actions' | 'community';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  openActionCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  openActionCount = 3,
}) => {
  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'balance', label: 'Water Balance', icon: Scale },
    { id: 'trends', label: 'Trends', icon: LineChart },
    { id: 'actions', label: 'Actions', icon: CheckSquare, badge: openActionCount },
    { id: 'community', label: 'Community', icon: Users },
  ];

  return (
    <>
      {/* Desktop Sub-Header Navigation Tabs */}
      <nav aria-label="Desktop primary" className="hidden md:block bg-[#EAE5DB] border-b border-[#D8D2C4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#1F5A48] text-[#F5F1E8] shadow-xs'
                      : 'text-[#1E2A28]/80 hover:text-[#1E2A28] hover:bg-[#DCD6CA]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#A7D7D7]' : 'text-[#3B7C8A]'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`ml-1.5 text-[11px] font-semibold px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-[#A7D7D7] text-[#1E2A28]'
                          : 'bg-[#C56B4C] text-[#F5F1E8]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F5F1E8] border-t border-[#D8D2C4] shadow-lg">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`relative flex flex-col items-center justify-center py-1 transition-colors ${
                  isActive ? 'text-[#1F5A48]' : 'text-[#1E2A28]/60 hover:text-[#1E2A28]'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#1F5A48]' : 'text-[#3B7C8A]'}`} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-[#C56B4C] text-[#F5F1E8] text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'font-bold text-[#1F5A48]' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 w-8 h-0.5 bg-[#1F5A48] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

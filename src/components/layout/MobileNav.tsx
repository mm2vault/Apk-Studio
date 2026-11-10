import React from 'react';
import { Layers, FolderTree, Code, Settings, Cpu, Download } from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'Panel', icon: Layers },
    { id: 'files', label: 'Dosyalar', icon: FolderTree },
    { id: 'editor', label: 'Editör', icon: Code },
    { id: 'config', label: 'Ayarlar', icon: Settings },
    { id: 'build', label: 'Derle', icon: Cpu },
    { id: 'export', label: 'İndir', icon: Download }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d14]/95 backdrop-blur-lg border-t border-white/10 pb-safe">
      <div className="grid grid-cols-6 h-16 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[48px] w-full transition-all relative ${
                isActive ? 'text-purple-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-purple-500/15 text-purple-400 shadow-sm shadow-purple-500/20' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-medium tracking-tight mt-0.5 ${isActive ? 'font-semibold text-purple-300' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 bg-purple-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React, { useEffect, useState } from 'react';
import { Layers, FolderTree, Code, Settings, Cpu, Download, RefreshCw } from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

/**
 * Ekran klavyesinin açık olup olmadığını tahmin eder. Görünür alan
 * (visualViewport) pencereye göre belirgin biçimde küçülürse klavye açıktır.
 * Böylece alt gezinme çubuğu klavyenin üstünde yer kaplamaz.
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const shrunk = window.innerHeight - vv.height;
      setOpen(shrunk > 150);
    };
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  return open;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab }) => {
  const keyboardOpen = useKeyboardOpen();

  const tabs = [
    { id: 'dashboard', label: 'Panel', icon: Layers },
    { id: 'files', label: 'Dosyalar', icon: FolderTree },
    { id: 'editor', label: 'Editör', icon: Code },
    { id: 'config', label: 'Ayarlar', icon: Settings },
    { id: 'build', label: 'Derle', icon: Cpu },
    { id: 'export', label: 'İndir', icon: Download },
    { id: 'updates', label: 'Güncelle', icon: RefreshCw }
  ];

  return (
    <nav
      aria-label="Ana gezinme"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d14]/95 backdrop-blur-lg border-t border-white/10 pb-safe ${keyboardOpen ? 'nav-hidden' : ''}`}
    >
      <div className="grid grid-cols-7 h-16 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center min-h-[48px] w-full transition-colors relative ${isActive ? 'text-purple-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-purple-500/15 text-purple-400' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-medium tracking-tight mt-0.5 ${isActive ? 'font-semibold text-purple-300' : ''}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

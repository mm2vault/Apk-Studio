import React, { useEffect, useState } from 'react';
import { Layers, FolderTree, Code, Cpu, MoreHorizontal, Settings, Download, RefreshCw, X } from 'lucide-react';

interface MobileNavProps { activeTab: string; setActiveTab: (tab: string) => void; }

/**
 * Ekran klavyesi açıkken görünür alan (visualViewport) belirgin biçimde küçülür.
 * Bu durumda alt gezinme gizlenir; böylece klavyenin üstünde yer kaplamaz.
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setOpen(window.innerHeight - vv.height > 150);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);
  return open;
}

const primaryTabs = [
  { id: 'dashboard', label: 'Panel', icon: Layers },
  { id: 'files', label: 'Dosyalar', icon: FolderTree },
  { id: 'editor', label: 'Editör', icon: Code },
  { id: 'build', label: 'Derle', icon: Cpu }
];

const extraTabs = [
  { id: 'config', label: 'Yapılandırma', icon: Settings, description: 'Uygulama ayarları ve Android seçenekleri' },
  { id: 'export', label: 'Dışa aktar', icon: Download, description: 'Proje dosyalarını dışa aktar' },
  { id: 'updates', label: 'Güncellemeler', icon: RefreshCw, description: 'Yeni APK Studio sürümlerini kontrol et' }
];

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  useEffect(() => { if (keyboardOpen) setMoreOpen(false); }, [keyboardOpen]);
  const isExtraTabActive = extraTabs.some(tab => tab.id === activeTab);
  const MoreIcon = moreOpen ? X : MoreHorizontal;
  const selectTab = (tab: string) => { setActiveTab(tab); setMoreOpen(false); };

  return (
    <>
      {moreOpen && <button type="button" aria-label="Menüyü kapat" className="md:hidden fixed inset-0 z-40 bg-black/45" onClick={() => setMoreOpen(false)} />}
      {moreOpen && (
        <div className="md:hidden fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-50 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-[#141622] p-2 shadow-2xl shadow-black/50">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Diğer araçlar</p>
          {extraTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => selectTab(tab.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${isActive ? 'bg-purple-500/15 text-purple-200' : 'text-slate-200 hover:bg-white/5'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-slate-400'}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{tab.label}</span><span className="mt-0.5 block text-[11px] text-slate-500">{tab.description}</span></span>
              </button>
            );
          })}
        </div>
      )}
      <nav aria-label="Ana gezinme" className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0c0d14]/95 pb-safe backdrop-blur-xl ${keyboardOpen ? 'nav-hidden' : ''}`}>
        <div className="grid h-[4.25rem] grid-cols-5 items-center px-2">
          {primaryTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return <button key={tab.id} type="button" aria-current={isActive ? 'page' : undefined} onClick={() => selectTab(tab.id)} className={`relative flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl transition-colors ${isActive ? 'text-purple-300' : 'text-slate-400 hover:text-slate-200'}`}><span className={`flex h-7 w-10 items-center justify-center rounded-xl ${isActive ? 'bg-purple-500/15' : ''}`}><Icon className="h-5 w-5" /></span><span className="text-[10px] font-medium leading-none">{tab.label}</span>{isActive && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-purple-400" />}</button>;
          })}
          <button type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen(open => !open)} className={`relative flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl transition-colors ${moreOpen || isExtraTabActive ? 'text-purple-300' : 'text-slate-400 hover:text-slate-200'}`}><span className={`flex h-7 w-10 items-center justify-center rounded-xl ${moreOpen || isExtraTabActive ? 'bg-purple-500/15' : ''}`}><MoreIcon className="h-5 w-5" /></span><span className="text-[10px] font-medium leading-none">Daha fazla</span>{isExtraTabActive && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-purple-400" />}</button>
        </div>
      </nav>
    </>
  );
};
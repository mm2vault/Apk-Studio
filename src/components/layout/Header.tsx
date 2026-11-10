import React from 'react';
import { Smartphone, Layers, FolderTree, Code, Settings, Cpu, Download, Plus } from 'lucide-react';
import { Project } from '../../types/project';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentProject: Project | null;
  projects: Project[];
  onSelectProject: (id: string) => void;
  onCreateProjectClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentProject,
  projects,
  onSelectProject,
  onCreateProjectClick
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Panel', icon: Layers },
    { id: 'files', label: 'Dosyalar', icon: FolderTree },
    { id: 'editor', label: 'Editör', icon: Code },
    { id: 'config', label: 'Yapılandırma', icon: Settings },
    { id: 'build', label: 'Derle', icon: Cpu },
    { id: 'export', label: 'Dışa Aktar', icon: Download }
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-[#08090d]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-purple-900/30 flex items-center justify-center">
            <div className="w-full h-full bg-[#0c0d14] rounded-[11px] flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white font-mono">
                APK Studio
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Mobile
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1 bg-[#12141f] p-1 rounded-xl border border-white/5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Project Selector & Quick Action */}
        <div className="flex items-center gap-2 shrink-0">
          {projects.length > 0 && (
            <div className="relative">
              <select
                value={currentProject?.id || ''}
                onChange={(e) => onSelectProject(e.target.value)}
                className="bg-[#12141f] text-slate-200 text-xs font-mono font-medium rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-purple-500 max-w-[130px] sm:max-w-[180px] truncate cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#12141f] text-slate-200">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onCreateProjectClick}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shadow-md shadow-purple-900/40 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Yeni Proje</span>
          </button>
        </div>
      </div>
    </header>
  );
};

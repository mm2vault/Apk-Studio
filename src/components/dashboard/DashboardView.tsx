import React, { useState } from 'react';
import { 
  FolderPlus, 
  Upload, 
  FileArchive, 
  Sparkles, 
  Trash2, 
  ChevronRight, 
  Cpu, 
  Code2, 
  Smartphone,
  HardDrive,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Project } from '../../types/project';
import { detectProjectType, formatFileSize } from '../../services/typeDetector';
import { DEFAULT_CONFIG } from '../../services/storage';
import { extractZipArchive } from '../../services/fileService';

interface DashboardViewProps {
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (id: string) => void;
  onCreateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  setActiveTab: (tab: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  setActiveTab,
  isCreateModalOpen,
  setIsCreateModalOpen
}) => {
  // Create Modal state
  const [newProjectName, setNewProjectName] = useState('');
  const [newPackageId, setNewPackageId] = useState('');
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [importStatusText, setImportStatusText] = useState('');

  // Total stats
  const totalFiles = projects.reduce((acc, p) => acc + p.files.length, 0);
  const totalBytes = projects.reduce((acc, p) => acc + p.files.reduce((fAcc, f) => fAcc + f.size, 0), 0);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim() || 'Yeni Proje';
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app';
    const pkg = newPackageId.trim() || `com.mobile.${slug}`;

    // Start empty: users bring their own source files or import a project ZIP.
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name,
      description: 'Kullanıcının kendi dosyalarını eklemesi için boş proje',
      type: 'custom',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: {
        ...DEFAULT_CONFIG,
        name,
        packageId: pkg
      },
      cloudConfig: {
        provider: 'github-actions',
        webhookUrl: '',
        apiToken: '',
        autoDeploy: false
      },
      files: []
    };

    onCreateProject(newProject);
    setIsCreateModalOpen(false);
    setNewProjectName('');
    setNewPackageId('');
    setActiveTab('files');
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingZip(true);
    setImportStatusText('ZIP arşivi çözülüyor...');

    try {
      const extractedFiles = await extractZipArchive(file);
      const metadataFile = extractedFiles.find(item =>
        !item.isBinary && item.path.toLowerCase().endsWith('.apkstudio-meta.json')
      );
      let metadata: Record<string, unknown> = {};
      if (metadataFile) {
        try {
          const parsed = JSON.parse(metadataFile.content);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed;
        } catch {
          // Ignore invalid optional metadata and continue with automatic detection.
        }
      }

      const projectFiles = extractedFiles.filter(item => item !== metadataFile);
      if (projectFiles.length === 0) throw new Error('ZIP arşivinde içe aktarılabilir proje dosyası bulunamadı.');

      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\- ]/g, '');
      const metadataName = typeof metadata.name === 'string' ? metadata.name.trim() : '';
      const projName = metadataName || cleanName || 'İçe Aktarılan Proje';
      const rawSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const safeSlug = rawSlug ? (/^[a-z]/.test(rawSlug) ? rawSlug : `app${rawSlug}`) : 'app';
      const metadataPackage = typeof metadata.packageId === 'string' ? metadata.packageId : '';
      const packageIdRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
      const pkg = packageIdRegex.test(metadataPackage) ? metadataPackage : `com.imported.${safeSlug}`;
      const detected = detectProjectType(projectFiles);
      const metadataVersionName = typeof metadata.versionName === 'string' && metadata.versionName.trim()
        ? metadata.versionName.trim() : DEFAULT_CONFIG.versionName;
      const metadataVersionCode = Number(metadata.versionCode);
      const versionCode = Number.isInteger(metadataVersionCode) && metadataVersionCode > 0
        ? metadataVersionCode : DEFAULT_CONFIG.versionCode;

      const newProject: Project = {
        id: `proj_${Date.now()}`,
        name: projName,
        description: `${file.name} arşivinden içe aktarıldı (${projectFiles.length} dosya) · ${detected.title}`,
        type: detected.type,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        config: {
          ...DEFAULT_CONFIG,
          name: projName,
          packageId: pkg,
          versionName: metadataVersionName,
          versionCode
        },
        cloudConfig: {
          provider: 'github-actions',
          webhookUrl: '',
          apiToken: '',
          autoDeploy: false
        },
        files: projectFiles
      };

      onCreateProject(newProject);
      setIsCreateModalOpen(false);
      setActiveTab('files');
    } catch (err: any) {
      alert(`ZIP içe aktarma hatası: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsImportingZip(false);
      setImportStatusText('');
      e.target.value = '';
    }
  };

  return (
    <div className="page-shell space-y-6 max-w-7xl mx-auto w-full px-4 pt-4">
      {/* Active Project Highlight Banner */}
      {currentProject ? (
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden border border-purple-500/20 glow-purple">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-[#161926] border border-white/10 flex items-center justify-center shrink-0 p-2 shadow-inner">
                {currentProject.config.iconDataUrl ? (
                  <img
                    src={currentProject.config.iconDataUrl}
                    alt={currentProject.name}
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <Smartphone className="w-7 h-7 text-purple-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {currentProject.name}
                  </h1>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    v{currentProject.config.versionName}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {currentProject.config.packageId}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 font-mono">
                  <span>{currentProject.files.length} dosya</span>
                  <span>·</span>
                  <span>{formatFileSize(currentProject.files.reduce((a, f) => a + f.size, 0))}</span>
                  <span>·</span>
                  <span className="capitalize">{currentProject.type.replace('-', ' ')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('editor')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-200 border border-white/10 transition-colors"
              >
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span>Kod Editörü</span>
              </button>
              <button
                onClick={() => setActiveTab('build')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-md shadow-purple-900/30 transition-all active:scale-95"
              >
                <Cpu className="w-4 h-4" />
                <span>APK Derle</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Toplam Projeler</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {projects.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Aktif ve kaydedilmiş</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Proje Dosyaları</span>
            <Code2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {totalFiles}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">HTML, JS, Lua, XML vb.</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Yerel Bellek</span>
            <HardDrive className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {formatFileSize(totalBytes)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Tarayıcıda kalıcı</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Derleme Durumu</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-semibold font-mono text-emerald-400 mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Bulut Hazır</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">GitHub Actions CI/CD</div>
        </div>
      </div>

      {/* Projects List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Projeleriniz
          </h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Yeni Ekle</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((proj) => {
            const isCurrent = proj.id === currentProject?.id;
            const projSize = proj.files.reduce((a, f) => a + f.size, 0);

            return (
              <div
                key={proj.id}
                onClick={() => onSelectProject(proj.id)}
                className={`glass-panel p-4 rounded-xl border transition-all cursor-pointer relative group ${
                  isCurrent
                    ? 'border-purple-500/40 bg-purple-950/10'
                    : 'border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#161824] border border-white/10 flex items-center justify-center shrink-0">
                      {proj.config.iconDataUrl ? (
                        <img
                          src={proj.config.iconDataUrl}
                          alt={proj.name}
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <Smartphone className="w-5 h-5 text-purple-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                          {proj.name}
                        </h3>
                        {isCurrent && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">
                            Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[200px] sm:max-w-xs">
                        {proj.config.packageId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {projects.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${proj.name}" projesini silmek istediğinize emin misiniz?`)) {
                            onDeleteProject(proj.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Projeyi Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-400 font-mono">
                  <span>{proj.files.length} dosya · {formatFileSize(projSize)}</span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    {new Date(proj.updatedAt).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Honest Architecture & Diagnostics Callout */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              APK Studio Derleme Mimarisi
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mt-1">
              APK derleme işlemi Android SDK araçları (<code className="text-cyan-300">aapt2</code>, <code className="text-cyan-300">d8/dx</code>, <code className="text-cyan-300">zipalign</code>, <code className="text-cyan-300">apksigner</code>) ve <code className="text-purple-300">OpenJDK 17</code> gerektirir. 
              Uygulamamız yapay veya sahte APK butonları üretmez; projelerinizi hem tam Android Gradle yapısında bilgisayarınıza indirmenizi sağlar hem de <strong className="text-slate-200">GitHub Actions Bulut Derleme (Cloud Build)</strong> iş akışıyla ücretsiz derlenebilmesini sağlar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">Yerel Derleme (Local CLI)</span>
            <span className="text-[11px] font-mono text-cyan-400">Android Studio / Gradle</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">Bulut Derleme (Cloud CI/CD)</span>
            <span className="text-[11px] font-mono text-purple-400">GitHub Actions Workflow</span>
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-white/15 p-6 shadow-2xl space-y-5 animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Yeni APK Projesi Oluştur</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Uygulama Adı
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Mobil Oyunum, E-Ticaret WebView"
                  value={newProjectName}
                  onChange={(e) => {
                    setNewProjectName(e.target.value);
                    if (!newPackageId) {
                      const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                      setNewPackageId(slug ? `com.mobile.${slug}` : '');
                    }
                  }}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Paket Kimliği (Package ID)
                </label>
                <input
                  type="text"
                  required
                  placeholder="com.sirket.uygulama"
                  value={newPackageId}
                  onChange={(e) => setNewPackageId(e.target.value)}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Benzersiz ters alan adı formatı (örn: com.dev.myapp)
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#12141f] p-3">
                <div className="text-xs font-semibold text-slate-200">Boş proje</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hazır oyun veya demo eklenmez. Kendi dosyalarını tek tek ekleyebilir ya da mevcut projenin ZIP arşivini içe aktarabilirsin.
                </p>
              </div>

              {/* ZIP import option */}
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Veya var olan ZIP projenizi yükleyin:</span>
                </div>
                <label className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border border-dashed border-white/20 hover:border-purple-400 bg-white/[0.02] hover:bg-purple-950/10 cursor-pointer transition-all">
                  <FileArchive className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-slate-300">
                    {isImportingZip ? importStatusText : 'ZIP Dosyası Seç (.zip)'}
                  </span>
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    onChange={handleZipUpload}
                    disabled={isImportingZip}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isImportingZip}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-purple-900/40 active:scale-95"
                >
                  Projeyi Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

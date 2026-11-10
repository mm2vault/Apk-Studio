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
import { Project, ProjectType } from '../../types/project';
import { formatFileSize } from '../../services/typeDetector';
import { DEFAULT_CONFIG } from '../../services/storage';
import { extractZipArchive, readBrowserFile } from '../../services/fileService';

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
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectType>('web-to-apk');
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [importStatusText, setImportStatusText] = useState('');

  // Total stats
  const totalFiles = projects.reduce((acc, p) => acc + p.files.length, 0);
  const totalBytes = projects.reduce((acc, p) => acc + p.files.reduce((fAcc, f) => fAcc + f.size, 0), 0);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim() || 'Yeni Mobil Proje';
    const pkg = newPackageId.trim() || `com.mobile.${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app'}`;

    let initialFiles = [];

    if (selectedTemplate === 'web-to-apk') {
      initialFiles = [
        {
          id: `f_${Date.now()}_1`,
          name: 'index.html',
          path: 'index.html',
          size: 620,
          type: 'text/html',
          isBinary: false,
          lastModified: Date.now(),
          content: `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>${name}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="app-card">
    <div class="logo">🚀</div>
    <h1>${name}</h1>
    <p>Mobil web uygulamanız başarıyla oluşturuldu!</p>
    <button onclick="alert('Mobil dokunmatik etkileşim çalışıyor!')">Tıkla & Dene</button>
  </main>
  <script src="app.js"></script>
</body>
</html>`
        },
        {
          id: `f_${Date.now()}_2`,
          name: 'style.css',
          path: 'style.css',
          size: 450,
          type: 'text/css',
          isBinary: false,
          lastModified: Date.now(),
          content: `body {
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #0f111a;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.app-card {
  text-align: center;
  padding: 32px 24px;
  background: #1a1d2d;
  border-radius: 20px;
  max-width: 340px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.logo { font-size: 52px; margin-bottom: 12px; }
h1 { font-size: 22px; margin: 0 0 8px 0; color: #8b5cf6; }
p { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
button {
  background: linear-gradient(135deg, #7c3aed, #06b6d4);
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}`
        },
        {
          id: `f_${Date.now()}_3`,
          name: 'app.js',
          path: 'app.js',
          size: 280,
          type: 'application/javascript',
          isBinary: false,
          lastModified: Date.now(),
          content: `console.log('${name} başlatıldı.');
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM hazır, dokunmatik kontroller bağlandı.');
});`
        }
      ];
    } else if (selectedTemplate === 'love2d-lua') {
      initialFiles = [
        {
          id: `f_${Date.now()}_1`,
          name: 'main.lua',
          path: 'main.lua',
          size: 780,
          type: 'text/x-lua',
          isBinary: false,
          lastModified: Date.now(),
          content: `-- LÖVE2D Mobile Game Script
function love.load()
    player = { x = 160, y = 300, radius = 24, speed = 200 }
    score = 0
    love.graphics.setBackgroundColor(0.08, 0.09, 0.15)
end

function love.update(dt)
    -- Dokunmatik kontroller
    local touches = love.touch.getTouches()
    for _, id in ipairs(touches) do
        local x, y = love.touch.getPosition(id)
        player.x = x
        player.y = y
    end
end

function love.draw()
    love.graphics.setColor(0.55, 0.36, 0.96)
    love.graphics.circle("fill", player.x, player.y, player.radius)
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("Dokunarak daireyi hareket ettirin", 20, 40)
end`
        },
        {
          id: `f_${Date.now()}_2`,
          name: 'conf.lua',
          path: 'conf.lua',
          size: 260,
          type: 'text/x-lua',
          isBinary: false,
          lastModified: Date.now(),
          content: `function love.conf(t)
    t.identity = "${name.toLowerCase().replace(/[^a-z0-9]/g, '')}"
    t.window.title = "${name}"
    t.window.width = 360
    t.window.height = 640
    t.window.fullscreen = true
    t.modules.touch = true
end`
        }
      ];
    } else if (selectedTemplate === 'python-mobile') {
      initialFiles = [
        {
          id: `f_${Date.now()}_1`,
          name: 'main.py',
          path: 'main.py',
          size: 580,
          type: 'text/x-python',
          isBinary: false,
          lastModified: Date.now(),
          content: `from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label

class MobileApp(App):
    def build(self):
        layout = BoxLayout(orientation='vertical', padding=20, spacing=15)
        self.label = Label(text='${name}\\nPython Kivy Mobil', font_size='20sp', halign='center')
        btn = Button(text='Dokun ve Test Et', size_hint_y=0.3, background_color=(0.55, 0.36, 0.96, 1))
        btn.bind(on_press=self.on_click)
        layout.add_widget(self.label)
        layout.add_widget(btn)
        return layout

    def on_click(self, instance):
        self.label.text = 'Python mobil motoru çalışıyor! ✅'

if __name__ == '__main__':
    MobileApp().run()`
        }
      ];
    } else {
      // Custom / Native Android
      initialFiles = [
        {
          id: `f_${Date.now()}_1`,
          name: 'AndroidManifest.xml',
          path: 'AndroidManifest.xml',
          size: 450,
          type: 'application/xml',
          isBinary: false,
          lastModified: Date.now(),
          content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${name}"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`
        }
      ];
    }

    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name,
      description: `${selectedTemplate} tabanlı APK projesi`,
      type: selectedTemplate,
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
      files: initialFiles
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
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\- ]/g, '');
      const projName = cleanName || 'İçe Aktarılan Proje';
      const pkg = `com.imported.${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app'}`;

      const newProject: Project = {
        id: `proj_${Date.now()}`,
        name: projName,
        description: `${file.name} arşivinden içe aktarıldı (${extractedFiles.length} dosya)`,
        type: extractedFiles.some(f => f.name.toLowerCase() === 'index.html') ? 'web-to-apk' : 'custom',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        config: {
          ...DEFAULT_CONFIG,
          name: projName,
          packageId: pkg
        },
        cloudConfig: {
          provider: 'github-actions',
          webhookUrl: '',
          apiToken: '',
          autoDeploy: false
        },
        files: extractedFiles
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
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-4 pt-4">
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

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Proje Şablonu Seçin
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'web-to-apk', name: 'Web to APK', desc: 'HTML5, CSS, JS WebView' },
                    { id: 'love2d-lua', name: 'Lua / LÖVE2D', desc: 'Mobil 2D Oyun Motoru' },
                    { id: 'python-mobile', name: 'Python Kivy', desc: 'Python Mobil Arayüz' },
                    { id: 'custom', name: 'Boş / Özel', desc: 'Manuel kaynak kod' }
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTemplate(tpl.id as ProjectType)}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        selectedTemplate === tpl.id
                          ? 'border-purple-500 bg-purple-950/30 text-white'
                          : 'border-white/5 bg-[#12141f] text-slate-300 hover:border-white/15'
                      }`}
                    >
                      <div className="text-xs font-bold">{tpl.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
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

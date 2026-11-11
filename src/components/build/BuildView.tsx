import React, { useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Cloud, ExternalLink,
  Hammer, Loader2, RefreshCw, Server, Smartphone, Terminal, XCircle
} from 'lucide-react';
import { PageContainer, PageHeader, Notice } from '../ui/Page';
import { BuildLog, Project, ToolchainStatus, ValidationResult } from '../../types/project';
import { BuildApiService } from '../../services/buildService';
import { triggerDownload } from '../../services/fileService';

interface BuildViewProps {
  project: Project;
  onUpdateProject: (updated: Project) => void;
  setActiveTab: (tab: string) => void;
}

export const BuildView: React.FC<BuildViewProps> = ({ project, setActiveTab }) => {
  const [toolchain, setToolchain] = useState<ToolchainStatus | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [projectPath, setProjectPath] = useState('.');
  const [buildVariant, setBuildVariant] = useState<'debug' | 'release'>('debug');
  const [apiKey, setApiKey] = useState('');
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [localBuilding, setLocalBuilding] = useState(false);
  const [cloudBuilding, setCloudBuilding] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string; url?: string } | null>(null);\n  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);

  const refreshStatus = async () => {
    setLoadingCheck(true);
    try {
      const [status, result] = await Promise.all([
        BuildApiService.checkSystemToolchain(),
        BuildApiService.validateProject(project)
      ]);
      setToolchain(status);
      setValidation(result);
    } finally {
      setLoadingCheck(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, [project.id, project.updatedAt]);

  const handleLocalBuild = async () => {
    setLocalBuilding(true);
    setMessage(null);
    try {
      const result = await BuildApiService.requestLocalBuild(project, apiKey);
      if (result.success && result.apk) {
        const safeName = project.config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        triggerDownload(result.apk, `${safeName || 'app'}-debug.apk`);
        setMessage({ kind: 'success', text: 'APK oluşturuldu ve indirme başlatıldı.' });
      } else {
        setMessage({ kind: 'error', text: result.message });
      }
    } finally {
      setLocalBuilding(false);
    }
  };

  const handleCloudBuild = async () => {
    setCloudBuilding(true);
    setMessage(null);
    try {
      const result = await BuildApiService.triggerCloudBuild(project, projectPath, apiKey, buildVariant);
      setMessage(result.success
        ? { kind: 'success', text: result.message, url: result.workflowUrl }
        : { kind: 'error', text: result.message });
    } finally {
      setCloudBuilding(false);
    }
  };

  const statusRow = (label: string, available: boolean | undefined, detail?: string) => (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <div className="text-xs text-slate-200">{label}</div>
        {detail && <div className="text-[10px] text-slate-500 mt-0.5 break-words">{detail}</div>}
      </div>
      {available === undefined
        ? <span className="text-[10px] text-slate-500">Bilinmiyor</span>
        : available
          ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Hazır</span>
          : <span className="inline-flex items-center gap-1 text-[10px] text-rose-400"><XCircle className="w-3.5 h-3.5" /> Eksik</span>}
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="APK Derleme Merkezi"
        description="Yerel Gradle derlemesi veya GitHub Actions bulut derlemesi."
        icon={<Hammer className="w-5 h-5 text-purple-400 shrink-0" />}
        actions={
          <button onClick={refreshStatus} disabled={loadingCheck} className="tap-target inline-flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 disabled:opacity-50" title="Durumu yenile" aria-label="Durumu yenile">
            <RefreshCw className={`w-4 h-4 ${loadingCheck ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {message && (
        <Notice kind={message.kind}>
          <p>{message.text}</p>
          {message.url && <a href={message.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-cyan-300 underline">GitHub Actions'ı aç <ExternalLink className="w-3 h-3" /></a>}
        </Notice>
      )}

      <section className="glass-panel rounded-2xl border border-white/10 p-4 space-y-2">
        <label htmlFor="apk-build-api-key" className="text-xs font-semibold text-slate-200">Build API anahtarı</label>
        <input id="apk-build-api-key" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Sunucudaki APK_STUDIO_BUILD_API_KEY değeri" className="w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500" />
        <p className="text-[10px] text-slate-500">Bu anahtar yalnızca bu oturumda tutulur. GitHub erişim token'ı değildir; GitHub token sunucuda ayrı saklanır.</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass-panel rounded-2xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-300"><Smartphone className="w-5 h-5" /></div>
            <div>
              <h3 className="text-sm font-bold text-white">Telefonda / Yerel Sunucuda Derle</h3>
              <p className="text-[10px] text-slate-500">Yerel Android SDK + OpenJDK 17 + Gradle gerekir.</p>
            </div>
          </div>
          <div className="rounded-xl bg-black/30 border border-white/5 p-3">
            {statusRow('Java', toolchain?.toolchain.java.available, toolchain?.toolchain.java.details)}
            {statusRow('Gradle', toolchain?.toolchain.gradle.available, toolchain?.toolchain.gradle.details)}
            {statusRow('Android SDK', toolchain?.toolchain.androidSdk.available, toolchain?.toolchain.androidSdk.details)}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Güvenlik için yerel derleme varsayılan olarak kapalıdır. Sunucuyu yalnızca localhost üzerinde çalıştırıp APK_STUDIO_ENABLE_LOCAL_BUILD=true ayarını açmalısınız.
          </p>
          <button onClick={handleLocalBuild} disabled={localBuilding || !apiKey.trim() || !toolchain?.readyForLocalBuild} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold">
            {localBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}
            {localBuilding ? 'APK derleniyor…' : 'Yerel APK Oluştur'}
          </button>
        </section>

        <section className="glass-panel rounded-2xl border border-purple-500/25 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-300"><Cloud className="w-5 h-5" /></div>
            <div>
              <h3 className="text-sm font-bold text-white">GitHub Actions Cloud Build</h3>
              <p className="text-[10px] text-slate-500">GitHub sunucusunda gerçek Gradle APK derlemesi.</p>
            </div>
          </div>
          <label className="block text-[11px] text-slate-300" htmlFor="apk-project-path">GitHub deposundaki Android proje klasörü</label>
          <input id="apk-project-path" value={projectPath} onChange={e => setProjectPath(e.target.value)} placeholder="." className="w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setBuildVariant('debug')} className={`rounded-lg py-2 text-xs font-semibold border ${buildVariant === 'debug' ? 'bg-purple-600/20 border-purple-400 text-purple-200' : 'bg-white/5 border-white/10 text-slate-400'}`}>Debug APK</button>
            <button type="button" onClick={() => setBuildVariant('release')} className={`rounded-lg py-2 text-xs font-semibold border ${buildVariant === 'release' ? 'bg-purple-600/20 border-purple-400 text-purple-200' : 'bg-white/5 border-white/10 text-slate-400'}`}>Release APK</button>
          </div>
          <div className="rounded-xl bg-black/30 border border-white/5 p-3 space-y-2">
            <p className="text-[11px] text-slate-300">Önce <button onClick={() => setActiveTab('export')} className="text-cyan-300 underline">Android Gradle ZIP</button> dosyasını indirip GitHub deponuza yükleyin.</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">Ardından sunucuya GITHUB_REPOSITORY, GITHUB_TOKEN ve GITHUB_BUILD_REF ortam değişkenlerini ekleyin. Token için Actions: write izni gerekir; token tarayıcıya gönderilmez.</p>
          </div>
          <button onClick={handleCloudBuild} disabled={cloudBuilding || !apiKey.trim() || !validation?.valid || !projectPath.trim()} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold">
            {cloudBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            {cloudBuilding ? 'GitHub Actions başlatılıyor…' : 'Cloud APK Oluştur'}
          </button>
        </section>
      </div>

      <section className="glass-panel rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Terminal className="w-4 h-4 text-cyan-300" /> Proje Kontrolü</h3>
          <span className="text-[10px] text-slate-500">{validation?.fileCount ?? project.files.length} dosya</span>
        </div>
        {!validation && <p className="text-xs text-slate-500">Proje doğrulanıyor…</p>}
        {validation?.errors.map((item, index) => <p key={index} className="flex gap-2 text-xs text-rose-300"><XCircle className="w-3.5 h-3.5 shrink-0" />{item}</p>)}
        {validation?.warnings.map((item, index) => <p key={index} className="flex gap-2 text-xs text-amber-300"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{item}</p>)}
        {validation?.suggestions.map((item, index) => <p key={index} className="text-xs text-cyan-300">{item}</p>)}
        {validation?.valid && <p className="flex gap-2 text-xs text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" />Temel proje kontrolleri başarılı. Bu, derlemenin kesin başarılı olacağı anlamına gelmez.</p>}
      </section>

      {buildLogs.length > 0 && (
        <section className="glass-panel rounded-2xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Terminal className="w-4 h-4 text-cyan-300" /> Yerel Derleme Günlükleri</h3>
            <span className="text-[10px] text-slate-500">{buildLogs.length} satır</span>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl bg-[#080a10] border border-white/5 p-3 space-y-1" role="log" aria-label="Gradle derleme günlükleri">
            {buildLogs.map(log => (
              <div key={log.id} className="font-mono text-[10px] leading-relaxed break-words">
                <span className="text-slate-600 mr-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={log.level === 'error' ? 'text-rose-300' : log.level === 'warn' ? 'text-amber-300' : 'text-slate-300'}>{log.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="text-[10px] text-slate-500 leading-relaxed">
        <Server className="w-3 h-3 inline mr-1" />
        Yerel derleme sunucu tarafında SDK gerektirir. Bulut derleme ise Android Gradle projesinin GitHub deposunda bulunmasını ve Actions erişim iznini gerektirir.
      </div>
    </PageContainer>
  );
};

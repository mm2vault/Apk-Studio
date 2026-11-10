import React, { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, RefreshCw, ShieldCheck, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

const CURRENT_VERSION = '0.1.0';
const RELEASES_API = 'https://api.github.com/repos/mm2vault/Apk-Studio/releases/latest';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  assets: Array<{ name: string; browser_download_url: string; size: number }>;
  prerelease: boolean;
  draft: boolean;
}

function normalizeVersion(value: string): number[] {
  return value.replace(/^v/i, '').split('.').map(part => Number.parseInt(part, 10) || 0);
}

function isNewer(latest: string, current: string): boolean {
  const a = normalizeVersion(latest);
  const b = normalizeVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

export const UpdateView: React.FC = () => {
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const checkForUpdates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(RELEASES_API, {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store'
      });
      if (response.status === 404) {
        setRelease(null);
        setError('Henüz yayınlanmış bir GitHub sürümü bulunamadı. İlk sürüm yayınlandığında burada görünecek.');
        return;
      }
      if (!response.ok) throw new Error(`GitHub yanıtı: ${response.status}`);
      const data = await response.json() as GitHubRelease;
      if (data.draft || data.prerelease) {
        setRelease(null);
        setError('Henüz kararlı bir sürüm yayınlanmadı.');
      } else {
        setRelease(data);
      }
      setCheckedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellemeler kontrol edilemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkForUpdates();
  }, [checkForUpdates]);

  const updateAvailable = release ? isNewer(release.tag_name, CURRENT_VERSION) : false;
  const apkAsset = release?.assets.find(asset => asset.name.toLowerCase().endsWith('.apk'));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-[0.2em] mb-2">
            <Sparkles className="w-4 h-4" /> APK Studio
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Güncelleme Merkezi</h1>
          <p className="text-sm text-slate-400 mt-2">Yeni sürümleri kontrol et, değişiklikleri oku ve yayınlanan dosyaları indir.</p>
        </div>
        <button onClick={() => void checkForUpdates()} disabled={loading} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Kontrol ediliyor…' : 'Yeniden kontrol et'}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#11131d] p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Yüklü sürüm</p>
          <p className="text-2xl font-bold text-white mt-2">v{CURRENT_VERSION}</p>
          <p className="text-xs text-slate-500 mt-2">Bu arayüzün sürüm numarası</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#11131d] p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider">GitHub sürümü</p>
          <p className="text-2xl font-bold text-white mt-2">{release?.tag_name || 'Kontrol bekleniyor'}</p>
          <p className="text-xs text-slate-500 mt-2">{checkedAt ? `Son kontrol: ${checkedAt.toLocaleString()}` : 'GitHub Releases üzerinden kontrol edilir'}</p>
        </div>
      </div>

      {loading && !release && (
        <div className="rounded-2xl border border-white/10 bg-[#11131d] p-6 flex items-center gap-3 text-slate-300">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" /> GitHub sürümleri okunuyor…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 text-sm text-amber-200">
          <AlertCircle className="w-5 h-5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {release && (
        <section className="rounded-2xl border border-white/10 bg-[#11131d] overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">En son kararlı sürüm</p>
              <h2 className="text-xl font-bold text-white mt-1">{release.name || release.tag_name}</h2>
              <p className="text-xs text-slate-500 mt-1">Yayın tarihi: {new Date(release.published_at).toLocaleDateString()}</p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${updateAvailable ? 'bg-cyan-400/10 text-cyan-300 border border-cyan-400/20' : 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20'}`}>
              {updateAvailable ? <Download className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {updateAvailable ? 'Yeni güncelleme var' : 'En güncel sürümdesin'}
            </span>
          </div>
          <div className="p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Sürüm notları</h3>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-300">{release.body?.trim() || 'Bu sürüm için açıklama eklenmemiş.'}</pre>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {apkAsset ? (
                <a href={apkAsset.browser_download_url} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm px-4 py-3" target="_blank" rel="noreferrer">
                  <Download className="w-4 h-4" /> APK indir
                </a>
              ) : (
                <a href={release.html_url} className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm px-4 py-3" target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4" /> Sürümü aç / dosyaları indir
                </a>
              )}
              <a href={release.html_url} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 text-slate-200 text-sm px-4 py-3" target="_blank" rel="noreferrer">
                GitHub sürüm sayfası <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0d1018] p-4 flex gap-3 text-xs leading-5 text-slate-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <p>Güvenlik: Güncellemeler resmi mm2vault/Apk-Studio GitHub Releases sayfasından okunur. Web sürümü yayınlandıktan sonra sayfayı yenilemen gerekir. Android APK güncellemesi için aynı uygulama imzasıyla oluşturulmuş APK'yı indirip Android'in kurulum onayını vermelisin.</p>
      </div>
    </div>
  );
};

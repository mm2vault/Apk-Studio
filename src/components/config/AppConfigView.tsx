import React, { useState } from 'react';
import { 
  Smartphone, 
  Upload, 
  ShieldCheck, 
  Sliders, 
  Check, 
  Sparkles, 
  AlertCircle,
  Maximize,
  Compass,
  FileCode2,
  Trash2,
  Plus
} from 'lucide-react';
import { Project, AppConfig, AndroidPermissions } from '../../types/project';

interface AppConfigViewProps {
  project: Project;
  onUpdateProject: (updated: Project) => void;
}

export const AppConfigView: React.FC<AppConfigViewProps> = ({
  project,
  onUpdateProject
}) => {
  const [config, setConfig] = useState<AppConfig>({ ...project.config });
  const [customPermInput, setCustomPermInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Validate package ID format
  const packageIdRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
  const isPackageIdValid = packageIdRegex.test(config.packageId);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setConfig(prev => ({
        ...prev,
        iconDataUrl: dataUrl
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePermissionToggle = (key: keyof AndroidPermissions) => {
    if (key === 'custom') return;
    setConfig(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  const handleAddCustomPermission = (e: React.FormEvent) => {
    e.preventDefault();
    const perm = customPermInput.trim();
    if (!perm) return;
    const fullPerm = perm.startsWith('android.permission.') ? perm : `android.permission.${perm}`;
    if (config.permissions.custom.includes(fullPerm)) return;

    setConfig(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        custom: [...prev.permissions.custom, fullPerm]
      }
    }));
    setCustomPermInput('');
  };

  const handleRemoveCustomPermission = (perm: string) => {
    setConfig(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        custom: prev.permissions.custom.filter(p => p !== perm)
      }
    }));
  };

  const handleSave = () => {
    onUpdateProject({
      ...project,
      name: config.name,
      config: { ...config },
      updatedAt: Date.now()
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Mask CSS helper
  const getMaskClass = (shape: AppConfig['iconShape']) => {
    switch (shape) {
      case 'circle': return 'rounded-full';
      case 'squircle': return 'rounded-[26%]';
      case 'teardrop': return 'rounded-tr-none rounded-3xl';
      case 'rounded': return 'rounded-2xl';
      default: return 'rounded-none';
    }
  };

  return (
    <div className="page-shell space-y-6 max-w-5xl mx-auto w-full px-4 pt-4">
      {/* Top Title & Save Button */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-400" />
            <span>Uygulama Yapılandırması</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Android Manifest, paket kimliği, SDK seviyeleri ve izinleri özelleştirin.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/40 active:scale-95 transition-all"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" />
              <span>Kaydedildi!</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Ayarları Kaydet</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Basic App Details & Icon */}
        <div className="md:col-span-7 space-y-5">
          {/* Identity Card */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Temel Kimlik Bilgileri</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Uygulama Adı (Görünen Başlık)
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                placeholder="Örn: My Awesome App"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Paket Kimliği (Package ID / Application ID)
              </label>
              <input
                type="text"
                value={config.packageId}
                onChange={(e) => setConfig({ ...config, packageId: e.target.value })}
                className={`w-full bg-[#12141f] border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none ${
                  isPackageIdValid ? 'border-white/10 focus:border-purple-500' : 'border-red-500/50 focus:border-red-500'
                }`}
                placeholder="com.sirket.uygulama"
              />
              {!isPackageIdValid && (
                <span className="text-[10px] text-red-400 flex items-center gap-1 mt-1 font-mono">
                  <AlertCircle className="w-3 h-3" />
                  Geçersiz paket adı. Ters alan adı formatı gereklidir (en az 2 parça, harfle başlayan).
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Versiyon Adı (Version Name)
                </label>
                <input
                  type="text"
                  value={config.versionName}
                  onChange={(e) => setConfig({ ...config, versionName: e.target.value })}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  placeholder="1.0.0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Versiyon Kodu (Version Code)
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.versionCode}
                  onChange={(e) => setConfig({ ...config, versionCode: parseInt(e.target.value, 10) || 1 })}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Android SDK & Display Card */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-400" />
              <span>Android SDK & Ekran Davranışı</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Minimum SDK
                </label>
                <select
                  value={config.minSdk}
                  onChange={(e) => setConfig({ ...config, minSdk: parseInt(e.target.value, 10) })}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                >
                  <option value={21}>API 21 (Android 5.0 Lollipop)</option>
                  <option value={24}>API 24 (Android 7.0 Nougat - Önerilen)</option>
                  <option value={26}>API 26 (Android 8.0 Oreo)</option>
                  <option value={29}>API 29 (Android 10)</option>
                  <option value={33}>API 33 (Android 13 Tiramisu)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Hedef (Target) SDK
                </label>
                <select
                  value={config.targetSdk}
                  onChange={(e) => setConfig({ ...config, targetSdk: parseInt(e.target.value, 10) })}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                >
                  <option value={33}>API 33 (Android 13)</option>
                  <option value={34}>API 34 (Android 14 - Play Store 2024+)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ekran Yönü (Orientation)
                </label>
                <select
                  value={config.orientation}
                  onChange={(e) => setConfig({ ...config, orientation: e.target.value as any })}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                >
                  <option value="portrait">Dikey (Portrait)</option>
                  <option value="landscape">Yatay (Landscape)</option>
                  <option value="sensor">Otomatik / Sensör</option>
                  <option value="unspecified">Belirtilmemiş</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 p-2 bg-[#12141f] rounded-xl border border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.fullscreen}
                    onChange={(e) => setConfig({ ...config, fullscreen: e.target.checked })}
                    className="rounded text-purple-600 focus:ring-0"
                  />
                  <span className="text-xs font-medium text-slate-200">Tam Ekran (Fullscreen)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: App Icon & Permissions */}
        <div className="md:col-span-5 space-y-5">
          {/* App Icon & Adaptive Mask Preview */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Uygulama İkonu & Önizleme</span>
            </h3>

            {/* Preview Box */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#0a0b12] rounded-2xl border border-white/5 space-y-3">
              <div
                className={`w-24 h-24 bg-gradient-to-tr from-purple-700 via-indigo-600 to-cyan-400 p-[2px] shadow-xl ${getMaskClass(config.iconShape)} transition-all duration-300 flex items-center justify-center`}
              >
                <div
                  className={`w-full h-full bg-[#12141f] flex items-center justify-center overflow-hidden ${getMaskClass(config.iconShape)}`}
                >
                  {config.iconDataUrl ? (
                    <img
                      src={config.iconDataUrl}
                      alt="Uygulama İkonu"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Smartphone className="w-10 h-10 text-purple-400" />
                  )}
                </div>
              </div>

              <div className="text-center">
                <span className="text-xs font-bold text-white block">{config.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">Android Başlatıcı Önizlemesi</span>
              </div>

              {/* Mask Selector */}
              <div className="flex items-center gap-1 pt-2">
                {(['squircle', 'circle', 'rounded', 'teardrop', 'square'] as const).map(shape => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => setConfig({ ...config, iconShape: shape })}
                    className={`px-2 py-1 rounded text-[10px] font-mono capitalize transition-all ${
                      config.iconShape === shape
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon File Upload */}
            <label className="flex items-center justify-center gap-2 w-full p-2.5 rounded-xl border border-dashed border-white/20 hover:border-purple-400 bg-white/[0.02] cursor-pointer transition-all">
              <Upload className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-slate-300">Yeni İkon Yükle (PNG/JPG)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleIconUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Android Permissions Manager */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Android İzinleri (Permissions)</span>
            </h3>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {[
                { key: 'internet', label: 'İnternet Erişimi (INTERNET)', desc: 'Web içerikleri ve API istekleri için' },
                { key: 'networkState', label: 'Ağ Durumu (ACCESS_NETWORK_STATE)', desc: 'Wi-Fi / Mobil bağlantı kontrolü' },
                { key: 'camera', label: 'Kamera (CAMERA)', desc: 'Fotoğraf ve video çekimi' },
                { key: 'audioRecord', label: 'Mikrofon (RECORD_AUDIO)', desc: 'Ses kaydı' },
                { key: 'locationFine', label: 'Hassas Konum (ACCESS_FINE_LOCATION)', desc: 'GPS tabanlı tam konum' },
                { key: 'vibrate', label: 'Titreşim (VIBRATE)', desc: 'Dokunmatik geri bildirim' },
                { key: 'readStorage', label: 'Harici Depolama Okuma', desc: 'Dosya ve medya erişimi' },
                { key: 'writeStorage', label: 'Harici Depolama Yazma', desc: 'Dosya kaydetme' }
              ].map(({ key, label, desc }) => (
                <label
                  key={key}
                  className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(config.permissions[key as keyof AndroidPermissions])}
                    onChange={() => handlePermissionToggle(key as keyof AndroidPermissions)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-medium text-slate-200">{label}</div>
                    <div className="text-[10px] text-slate-500">{desc}</div>
                  </div>
                </label>
              ))}

              {/* Custom permissions list */}
              {config.permissions.custom.map(cp => (
                <div
                  key={cp}
                  className="flex items-center justify-between p-2 rounded-xl bg-purple-950/20 border border-purple-500/20"
                >
                  <span className="text-xs font-mono text-purple-300 truncate">{cp}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomPermission(cp)}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Custom permission add form */}
            <form onSubmit={handleAddCustomPermission} className="flex items-center gap-2 pt-2 border-t border-white/5">
              <input
                type="text"
                placeholder="Özel İzin (örn: BLUETOOTH)"
                value={customPermInput}
                onChange={(e) => setCustomPermInput(e.target.value)}
                className="flex-1 bg-[#12141f] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

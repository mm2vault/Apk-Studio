import { Project, BuildLog, ToolchainStatus, ValidationResult } from '../types/project';
import { generateFullAndroidGradleProjectZip } from './fileService';

export interface LocalBuildResponse {
  success: boolean;
  message: string;
  errorType?: string;
  instructions?: string[];
  logs?: BuildLog[];
  apk?: Blob;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma < 0) reject(new Error('APK proje arşivi okunamadı.'));
      else resolve(result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı.'));
    reader.readAsDataURL(blob);
  });
}

function getUnsupportedProjectMessage(type: Project['type']): string {
  if (type === 'love2d-lua') {
    return 'Lua dosyaları içe aktarılıp düzenlenebilir; doğrudan APK derlemek için LÖVE Android runtime içeren bir Android Gradle projesi gerekir.';
  }
  if (type === 'python-mobile') {
    return 'Python dosyaları içe aktarılıp düzenlenebilir; APK üretmek için Kivy/Buildozer veya Chaquopy ile oluşturulmuş Android Gradle projesi gerekir.';
  }
  if (type === 'custom') {
    return 'Bu proje henüz doğrudan APK paketlenemiyor. React/Vue/Vite/Angular kaynaklarını önce npm run build ile derleyip dist/ veya build/ çıktısını içe aktarın; Node.js sunucu ve SSR özellikleri WebView APK içine otomatik eklenmez.';
  }
  return '';
}

function getWebViewWarnings(project: Project): string[] {
  if (project.type !== 'web-to-apk') return [];
  const permissions = project.config.permissions;
  const warnings: string[] = [];
  if (permissions.camera || permissions.audioRecord || permissions.locationFine || permissions.locationCoarse) {
    warnings.push('Manifest izinleri eklenecek; ancak WebView için kamera/mikrofon/konum runtime izin köprüsü henüz tamamlanmadı. Bu özellikler APK içinde çalışmayabilir.');
  }
  if (permissions.readStorage || permissions.writeStorage) {
    warnings.push('Depolama izinleri tek başına HTML file picker desteği sağlamaz; WebView dosya seçici köprüsü henüz eklenmedi.');
  }
  if (!permissions.internet) {
    warnings.push('INTERNET izni kapalı. Uygulamanın uzaktaki API, görsel veya web kaynaklarına erişimi olmayabilir.');
  }
  if (project.config.webSettings?.allowJavaScript === false && project.files.some(file => /\\.(js|mjs|cjs)$/i.test(file.path))) {
    warnings.push('JavaScript kapalı olmasına rağmen projede JavaScript dosyaları var; uygulama işlevleri çalışmayabilir.');
  }
  return warnings;
}

function decodeBuildLogs(encoded: string | null): BuildLog[] {
  if (!encoded) return [];
  try {
    const parsed = JSON.parse(atob(encoded));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.message === 'string').map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `local-${index}`,
      timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
      level: ['info', 'warn', 'error', 'success'].includes(item.level) ? item.level : 'info',
      message: item.message,
      step: typeof item.step === 'string' ? item.step : 'Gradle'
    }));
  } catch {
    return [];
  }
}

export const BuildApiService = {
  async checkSystemToolchain(): Promise<ToolchainStatus> {
    try {
      const response = await fetch('/api/system/check');
      if (!response.ok) throw new Error(`Sunucu yanıt vermedi: ${response.statusText}`);
      return await response.json();
    } catch (err: any) {
      return {
        timestamp: new Date().toISOString(),
        toolchain: {
          java: { available: false, version: 'Bilinmiyor', details: 'Backend bağlantı hatası' },
          gradle: { available: false, version: 'Bilinmiyor', details: 'Backend bağlantı hatası' },
          androidSdk: { available: false, path: null, details: 'Sunucuya ulaşılamadı' }
        },
        readyForLocalBuild: false,
        recommendation: `Backend API bağlantısı sağlanamadı (${err?.message || 'Bilinmeyen hata'}). Bulut derleme için GitHub Actions yapılandırın.`
      };
    }
  },

  async validateProject(project: Project): Promise<ValidationResult> {
    try {
      const response = await fetch('/api/build/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project.config.name,
          packageId: project.config.packageId,
          versionCode: project.config.versionCode,
          versionName: project.config.versionName,
          minSdk: project.config.minSdk,
          targetSdk: project.config.targetSdk,
          files: project.files.map(f => ({ name: f.name, path: f.path, size: f.size }))
        })
      });
      if (!response.ok) throw new Error('Doğrulama servisi hatası');
      const result = await response.json() as ValidationResult;
      const unsupportedMessage = getUnsupportedProjectMessage(project.type);
      if (unsupportedMessage) {
        return {
          ...result,
          valid: false,
          errors: [...result.errors, unsupportedMessage]
        };
      }
      return {
        ...result,
        warnings: [...result.warnings, ...getWebViewWarnings(project)]
      };
    } catch {
      const errors: string[] = [];
      const warnings: string[] = getWebViewWarnings(project);
      const suggestions: string[] = [];

      if (!project.config.name.trim()) errors.push('Uygulama adı boş bırakılamaz.');
      const pkgRegex = /^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$/i;
      if (!pkgRegex.test(project.config.packageId || '')) {
        errors.push('Geçersiz Paket Kimliği. Örnek: com.ornek.app');
      }
      if (project.config.targetSdk < 35) warnings.push('Target SDK 35 veya üzeri önerilir.');
      if (project.files.length === 0) errors.push('Projede derlenecek dosya bulunmuyor.');
      const unsupportedMessage = getUnsupportedProjectMessage(project.type);
      if (unsupportedMessage) errors.push(unsupportedMessage);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        detectedType: project.type,
        fileCount: project.files.length
      };
    }
  },

  async requestLocalBuild(project: Project, apiKey: string): Promise<LocalBuildResponse> {
    try {
      const projectZip = await generateFullAndroidGradleProjectZip(project);
      const archiveBase64 = await blobToBase64(projectZip);
      const response = await fetch('/api/build/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-APK-Studio-Key': apiKey },
        body: JSON.stringify({ archiveBase64, fileName: `${project.id}.zip` })
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/vnd.android.package-archive')) {
        return {
          success: true,
          message: 'APK başarıyla oluşturuldu.',
          logs: decodeBuildLogs(response.headers.get('x-apk-studio-build-logs')),
          apk: await response.blob()
        };
      }

      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        errorType: data.errorType || 'LOCAL_BUILD_FAILED',
        message: data.message || `Yerel derleme başarısız oldu (HTTP ${response.status}).`,
        instructions: data.instructions || [],
        logs: Array.isArray(data.logs) ? data.logs : []
      };
    } catch (err: any) {
      return {
        success: false,
        errorType: 'NETWORK_ERROR',
        message: `Yerel derleme isteği başarısız: ${err?.message || 'Bilinmeyen hata'}`,
        instructions: ['Yerel derleme için APK Studio sunucusunu Android SDK, OpenJDK 17 ve Gradle yüklü cihazda çalıştırın.']
      };
    }
  },

  async triggerCloudBuild(project: Project, projectPath = '.', apiKey = '', buildVariant: 'debug' | 'release' = 'debug'): Promise<any> {
    try {
      const response = await fetch('/api/build/cloud/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-APK-Studio-Key': apiKey },
        body: JSON.stringify({
          projectPath,
          buildVariant,
          projectConfig: project.config
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          message: data.message || `GitHub Actions tetiklenemedi (HTTP ${response.status}).`
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: `Bulut derleme servisine bağlanılamadı: ${err?.message || 'Bilinmeyen hata'}`
      };
    }
  }
};

import { Project, BuildLog, ToolchainStatus, ValidationResult } from '../types/project';
import JSZip from 'jszip';
import { generateFullAndroidGradleProjectZip } from './fileService';
import { detectProjectType } from './typeDetector';

export interface CloudBuildProgress {
  status?: string;
  message?: string;
  workflowUrl?: string;
  logs?: BuildLog[];
}

export interface CloudBuildResponse extends LocalBuildResponse {
  workflowUrl?: string;
  apkFileName?: string;
}

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

const BACKEND_URL_STORAGE_KEY = 'apk-studio-backend-url';

function apiUrl(path: string): string {
  let base = '';
  try {
    if (typeof window !== 'undefined') {
      base = window.localStorage.getItem(BACKEND_URL_STORAGE_KEY)?.trim() || '';
    }
  } catch {
    // Relative same-origin API remains available when browser storage is disabled.
  }
  return `${base.replace(/\\/+$/, '')}${path}`;
}

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
  const permissions = project.config?.permissions;
  if (!permissions) return [];
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
  if (project.config.webSettings?.allowJavaScript === false && project.files.some(file => /\.(js|mjs|cjs)$/i.test(file.path))) {
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
      const response = await fetch(apiUrl('/api/system/check'));
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
    const detection = detectProjectType(project.files);
    try {
      const response = await fetch(apiUrl('/api/build/validate'), {
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
      const unsupportedMessage = getUnsupportedProjectMessage(detection.type);
      if (unsupportedMessage) {
        return {
          ...result,
          valid: false,
          detectedType: detection.title,
          errors: [...result.errors, unsupportedMessage],
          suggestions: [...new Set([...result.suggestions, ...detection.recommendations])]
        };
      }
      return {
        ...result,
        detectedType: detection.title,
        suggestions: [...new Set([...result.suggestions, ...detection.recommendations])],
        warnings: [...result.warnings, ...getWebViewWarnings({ ...project, type: detection.type })]
      };
    } catch {
      const errors: string[] = [];
      const warnings: string[] = getWebViewWarnings({ ...project, type: detection.type });
      const suggestions: string[] = [];

      if (!project.config.name.trim()) errors.push('Uygulama adı boş bırakılamaz.');
      const pkgRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
      if (!pkgRegex.test(project.config.packageId || '')) {
        errors.push('Geçersiz Paket Kimliği. Örnek: com.ornek.app');
      }
      if (project.config.targetSdk < 35) warnings.push('Target SDK 35 veya üzeri önerilir.');
      if (project.files.length === 0) errors.push('Projede derlenecek dosya bulunmuyor.');
      const unsupportedMessage = getUnsupportedProjectMessage(detection.type);
      if (unsupportedMessage) errors.push(unsupportedMessage);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        suggestions: [...new Set([...suggestions, ...detection.recommendations])],
        detectedType: detection.title,
        fileCount: project.files.length
      };
    }
  },

  async requestLocalBuild(project: Project, apiKey: string): Promise<LocalBuildResponse> {
    try {
      const projectZip = await generateFullAndroidGradleProjectZip({ ...project, type: detectProjectType(project.files).type });
      const archiveBase64 = await blobToBase64(projectZip);
      const response = await fetch(apiUrl('/api/build/local'), {
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

  async triggerCloudBuild(
    project: Project,
    apiKey = '',
    buildVariant: 'debug' | 'release' = 'debug',
    onProgress?: (progress: CloudBuildProgress) => void
  ): Promise<CloudBuildResponse> {
    try {
      const detection = detectProjectType(project.files);
      const buildProject = { ...project, type: detection.type };
      const projectZip = await generateFullAndroidGradleProjectZip(buildProject);
      if (projectZip.size > 30 * 1024 * 1024) {
        throw new Error('Bulut derleme için ZIP boyutu en fazla 30 MB olabilir.');
      }

      const archiveBase64 = await blobToBase64(projectZip);
      const response = await fetch(apiUrl('/api/build/cloud/trigger'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-APK-Studio-Key': apiKey },
        body: JSON.stringify({ archiveBase64, buildVariant, projectName: project.name })
      });
      const dispatch = await response.json().catch(() => ({}));
      if (!response.ok || !dispatch.success || typeof dispatch.branch !== 'string') {
        return {
          success: false,
          message: dispatch.message || ('GitHub Actions tetiklenemedi (HTTP ' + response.status + ').')
        };
      }

      const workflowUrl = typeof dispatch.workflowUrl === 'string' ? dispatch.workflowUrl : undefined;
      onProgress?.({
        status: 'dispatched',
        message: 'Proje özel build deposuna yüklendi. GitHub Actions derlemesi bekleniyor.',
        workflowUrl
      });

      const deadline = Date.now() + 50 * 60 * 1000;
      while (Date.now() < deadline) {
        const statusResponse = await fetch(apiUrl('/api/build/cloud/status/' + encodeURIComponent(dispatch.branch)), {
          headers: { 'X-APK-Studio-Key': apiKey, 'Cache-Control': 'no-store' }
        });
        const status = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok || !status.success) {
          return {
            success: false,
            message: status.message || ('Cloud Build durumu okunamadı (HTTP ' + statusResponse.status + ').'),
            workflowUrl: status.workflowUrl || workflowUrl,
            logs: Array.isArray(status.logs) ? status.logs : []
          };
        }

        const progress: CloudBuildProgress = {
          status: status.status,
          message: status.message || 'GitHub Actions derlemesi sürüyor.',
          workflowUrl: status.workflowUrl || workflowUrl,
          logs: Array.isArray(status.logs) ? status.logs : []
        };
        onProgress?.(progress);

        if (status.status === 'completed') {
          if (status.conclusion !== 'success' || !status.artifactId) {
            return {
              success: false,
              message: status.message || 'Cloud Build tamamlandı, ancak APK çıktısı alınamadı.',
              workflowUrl: progress.workflowUrl,
              logs: progress.logs
            };
          }

          const artifactResponse = await fetch(apiUrl('/api/build/cloud/artifact/' + encodeURIComponent(String(status.artifactId))), {
            headers: { 'X-APK-Studio-Key': apiKey, 'Cache-Control': 'no-store' }
          });
          if (!artifactResponse.ok) {
            const error = await artifactResponse.json().catch(() => ({}));
            return {
              success: false,
              message: error.message || ('APK artifact indirilemedi (HTTP ' + artifactResponse.status + ').'),
              workflowUrl: progress.workflowUrl,
              logs: progress.logs
            };
          }

          const artifactZip = await JSZip.loadAsync(await artifactResponse.blob());
          const apkEntries = Object.values(artifactZip.files)
            .filter(entry => !entry.dir && entry.name.toLowerCase().endsWith('.apk'))
            .sort((a, b) => {
              const score = (name: string) => /universal/i.test(name) ? 0
                : /app-(debug|release)\.apk$/i.test(name) ? 1 : 2;
              return score(a.name) - score(b.name);
            });

          if (apkEntries.length === 0) {
            return {
              success: false,
              message: 'GitHub artifact indirildi, ancak ZIP içinde APK dosyası bulunamadı.',
              workflowUrl: progress.workflowUrl,
              logs: progress.logs
            };
          }

          const apkEntry = apkEntries[0];
          const apk = await apkEntry.async('blob');
          return {
            success: true,
            message: 'APK başarıyla derlendi ve telefona indirmeye hazır.',
            workflowUrl: progress.workflowUrl,
            apkFileName: apkEntry.name.split('/').pop() || ('app-' + buildVariant + '.apk'),
            apk,
            logs: progress.logs
          };
        }

        await wait(10000);
      }

      return {
        success: false,
        message: 'Cloud Build 50 dakika içinde tamamlanmadı. GitHub Actions sayfasından işlemi kontrol edebilirsiniz.',
        workflowUrl
      };
    } catch (err: any) {
      return {
        success: false,
        errorType: 'CLOUD_BUILD_FAILED',
        message: 'Bulut derleme servisine bağlanılamadı: ' + (err?.message || 'Bilinmeyen hata')
      };
    }
  }
};

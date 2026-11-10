import { Project, BuildLog, ToolchainStatus, ValidationResult } from '../types/project';

export interface LocalBuildResponse {
  success: boolean;
  message: string;
  errorType?: string;
  instructions?: string[];
  logs?: BuildLog[];
}

export const BuildApiService = {
  async checkSystemToolchain(): Promise<ToolchainStatus> {
    try {
      const response = await fetch('/api/system/check');
      if (!response.ok) {
        throw new Error(`Sunucu yanıt vermedi: ${response.statusText}`);
      }
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
        recommendation: `Backend API bağlantısı sağlanamadı (${err?.message || 'Bilinmeyen hata'}). Lütfen yerel sunucuyu kontrol edin veya Bulut Derleme (Cloud Build) kullanın.`
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
      return await response.json();
    } catch {
      // Client-side fallback validator
      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      if (!project.config.name) errors.push('Uygulama adı boş bırakılamaz.');
      const pkgRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
      if (!project.config.packageId || !pkgRegex.test(project.config.packageId)) {
        errors.push('Geçersiz Paket Kimliği (Package ID). En az iki segment içermelidir (Örn: com.ornek.app).');
      }
      if (project.config.targetSdk < 33) {
        warnings.push('Target SDK 33 veya üzeri olmalıdır.');
      }
      if (project.files.length === 0) {
        errors.push('Projede derlenecek hiçbir dosya bulunmuyor.');
      }

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

  async requestLocalBuild(project: Project): Promise<LocalBuildResponse> {
    try {
      const response = await fetch('/api/build/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, config: project.config })
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        errorType: 'NETWORK_ERROR',
        message: `Yerel derleme API isteği başarısız oldu: ${err?.message || 'Bilinmeyen hata'}`,
        instructions: [
          'Sunucu konsolunun çalıştığını teyit edin.',
          'Projeyi doğrudan ZIP olarak dışa aktararak yerel terminalinizde "./gradlew assembleRelease" komutunu çalıştırabilirsiniz.'
        ]
      };
    }
  },

  async triggerCloudBuild(project: Project, webhookUrl?: string, token?: string): Promise<any> {
    try {
      const response = await fetch('/api/build/cloud/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudProvider: project.cloudConfig.provider,
          webhookUrl: webhookUrl || project.cloudConfig.webhookUrl,
          token: token || project.cloudConfig.apiToken,
          projectConfig: project.config
        })
      });

      return await response.json();
    } catch (err: any) {
      return {
        success: false,
        message: `Bulut derleme servisine bağlanılamadı: ${err?.message}`
      };
    }
  }
};

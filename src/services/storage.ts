import { Project, AppConfig } from '../types/project';

const STORAGE_KEY = 'apk_studio_mobile_projects_v1';
const ACTIVE_PROJECT_KEY = 'apk_studio_active_project_id';
export const STORAGE_ERROR_EVENT = 'apkstudio:storage-error';

export const DEFAULT_CONFIG: AppConfig = {
  name: 'Yeni Uygulama',
  packageId: 'com.ornek.uygulamam',
  versionName: '1.0.0',
  versionCode: 1,
  minSdk: 24, // Android 7.0
  targetSdk: 34, // Android 14
  orientation: 'portrait',
  fullscreen: false,
  iconShape: 'squircle',
  permissions: {
    internet: true,
    networkState: true,
    camera: false,
    audioRecord: false,
    locationFine: false,
    locationCoarse: false,
    readStorage: false,
    writeStorage: false,
    vibrate: false,
    custom: []
  },
  webSettings: {
    allowJavaScript: true,
    allowDomStorage: true,
    clearCacheOnExit: false,
    enableZoom: false
  }
};

export const StorageService = {
  getProjects(): Project[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const stored = JSON.parse(data) as Project[];
      // Remove the legacy bundled Flappy Bird demo from existing installations.
      const projects = stored.filter(project =>
        project.id !== 'proj_sample_web' &&
        project.name !== 'Flappy Bird Web' &&
        !project.files?.some(file => /flappy bird/i.test(file.content || ''))
      );
      if (projects.length !== stored.length) this.saveProjects(projects);
      return projects;
    } catch (err) {
      console.error('Failed to load projects from localStorage:', err);
      return [];
    }
  },

  /**
   * Projeleri kaydeder. Başarısız olursa (ör. tarayıcı depolama kotası dolduğunda)
   * false döner ve arayüzün gösterebilmesi için STORAGE_ERROR_EVENT olayını yayar.
   */
  saveProjects(projects: Project[]): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      return true;
    } catch (err) {
      console.error('Failed to save projects to localStorage:', err);
      const quota = err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      const message = quota
        ? 'Depolama alanı doldu; değişiklikler kaydedilemedi. Büyük dosyaları silin veya projeyi ZIP olarak dışa aktarın.'
        : 'Değişiklikler cihaz depolamasına kaydedilemedi. Çalışmanızı ZIP olarak dışa aktarmanız önerilir.';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { message } }));
      }
      return false;
    }
  },

  getProject(id: string): Project | null {
    const list = this.getProjects();
    return list.find(p => p.id === id) || null;
  },

  saveProject(project: Project): void {
    const list = this.getProjects();
    const index = list.findIndex(p => p.id === project.id);
    const updated = { ...project, updatedAt: Date.now() };
    if (index >= 0) {
      list[index] = updated;
    } else {
      list.unshift(updated);
    }
    this.saveProjects(list);
  },

  deleteProject(id: string): void {
    const list = this.getProjects().filter(p => p.id !== id);
    this.saveProjects(list);
    if (this.getActiveProjectId() === id) {
      this.setActiveProjectId(list[0]?.id || null);
    }
  },

  getActiveProjectId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_PROJECT_KEY) || null;
    } catch {
      return null;
    }
  },

  setActiveProjectId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    } catch (err) {
      console.error('Failed to store active project id:', err);
    }
  }
};

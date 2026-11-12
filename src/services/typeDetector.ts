import { ProjectFile, ProjectType } from '../types/project';

export interface DetectionResult {
  type: ProjectType;
  title: string;
  badgeColor: string;
  entryPoint: string | null;
  hasManifest: boolean;
  hasGradle: boolean;
  hasIcon: boolean;
  fileCount: number;
  totalSize: number;
  notes: string[];
  recommendations: string[];
}

export function detectProjectType(files: ProjectFile[]): DetectionResult {
  const fileCount = files.length;
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  const paths = files.map(f => f.path.toLowerCase());
  const names = files.map(f => f.name.toLowerCase());

  const hasIndexHtml = names.includes('index.html') || paths.some(p => p.endsWith('/index.html'));
  const hasHtml = names.some(n => n.endsWith('.html') || n.endsWith('.htm'));
  const hasPackageJson = paths.some(p => p === 'package.json' || p.endsWith('/package.json'));
  const hasFrameworkSource = files.some(f => /\.(tsx|jsx|vue|svelte)$/i.test(f.path));
  const hasBundlerConfig = paths.some(p => /(^|\/)(vite\.config\.|next\.config\.|angular\.json$|webpack\.config\.|svelte\.config\.)/i.test(p));
  const builtWebEntry = files.find(f => /(^|\/)(dist|build|www)\/index\.html$/i.test(f.path));
  const needsWebBuild = hasPackageJson && (hasFrameworkSource || hasBundlerConfig) && !builtWebEntry;
  const hasManifest = paths.some(p => p.includes('androidmanifest.xml'));
  const hasGradle = paths.some(p => p.includes('build.gradle') || p.includes('build.gradle.kts'));
  const hasJava = names.some(n => n.endsWith('.java') || n.endsWith('.kt'));
  const hasLua = names.some(n => n.endsWith('.lua'));
  const hasPython = names.some(n => n.endsWith('.py'));
  const hasIcon = names.some(n => n.includes('icon') || n.includes('logo') || n.endsWith('ic_launcher.png'));

  const notes: string[] = [];
  const recommendations: string[] = [];
  let type: ProjectType = 'custom';
  let title = 'Özel / Karışık Proje';
  let badgeColor = 'bg-slate-700 text-slate-200';
  let entryPoint: string | null = null;

  if (hasManifest && (hasGradle || hasJava)) {
    type = 'native-android';
    title = 'Yerel Android Projesi (Gradle/Java/Kotlin)';
    badgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    const mainAct = files.find(f => f.name.includes('MainActivity') || f.name.endsWith('.java') || f.name.endsWith('.kt'));
    entryPoint = mainAct ? mainAct.path : 'AndroidManifest.xml';
    notes.push('Android Studio uyumlu yerel Gradle projesi tespit edildi.');
  } else if (needsWebBuild) {
    type = 'custom';
    title = 'Web framework source (build output required)';
    badgeColor = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    entryPoint = files.find(f => /(^|\/)package\.json$/i.test(f.path))?.path || null;
    notes.push('React/Vue/Angular/Vite gibi kaynak proje algılandı; ham TSX/JSX/Vue dosyaları WebView içinde doğrudan çalışmaz.');
    recommendations.push('Projeyi kendi araçlarıyla derleyin (genellikle npm install ve npm run build), ardından dist/ veya build/ klasöründeki index.html ve çıktı dosyalarını içe aktarın.');
    recommendations.push('Sunucu tarafı özellikler, Node.js API rotaları ve Next.js SSR doğrudan APK içine paketlenmez; statik dışa aktarma gerekir.');
  } else if (hasIndexHtml || hasHtml) {
    type = 'web-to-apk';
    title = 'Web to APK (HTML5 / WebView / PWA)';
    badgeColor = 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
    const indexF = builtWebEntry || files.find(f => f.path.toLowerCase() === 'index.html') || files.find(f => f.name.toLowerCase() === 'index.html') || files.find(f => f.name.toLowerCase().endsWith('.html'));
    entryPoint = indexF ? indexF.path : 'index.html';
    notes.push('Web tabanlı uygulama tespit edildi. Android WebView bileşeni ile paketlenebilir.');
    if (!hasIndexHtml) {
      recommendations.push('Ana başlangıç dosyası "index.html" olarak adlandırılmalıdır.');
    }
  } else if (hasLua) {
    type = 'love2d-lua';
    title = 'LÖVE2D / Lua Mobil Oyun';
    badgeColor = 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    const mainLua = files.find(f => f.name.toLowerCase() === 'main.lua');
    entryPoint = mainLua ? mainLua.path : files.find(f => f.name.endsWith('.lua'))?.path || 'main.lua';
    notes.push('Lua betikleri tespit edildi. Dosyalar içe aktarılabilir ve düzenlenebilir; LÖVE2D çalışma zamanı henüz otomatik olarak paketlenmez.');
    recommendations.push('APK üretmek için LÖVE Android runtime içeren geçerli bir Android Gradle projesi gerekir.');
    if (!mainLua) {
      recommendations.push('LÖVE2D oyunları için "main.lua" başlangıç dosyası gereklidir.');
    }
  } else if (hasPython) {
    type = 'python-mobile';
    title = 'Python Mobil (Kivy / BeeWare)';
    badgeColor = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    const mainPy = files.find(f => f.name.toLowerCase() === 'main.py');
    entryPoint = mainPy ? mainPy.path : files.find(f => f.name.endsWith('.py'))?.path || 'main.py';
    notes.push('Python dosyaları tespit edildi. Kaynaklar içe aktarılabilir ve düzenlenebilir; doğrudan APK paketleme henüz etkin değil.');
    recommendations.push('APK üretmek için Kivy/Buildozer veya Chaquopy ile oluşturulmuş Android Gradle projesi gerekir.');
    if (!mainPy) {
      recommendations.push('Kivy/BeeWare için "main.py" başlangıç dosyası gereklidir.');
    }
  } else {
    type = 'custom';
    title = 'Özel Proje';
    badgeColor = 'bg-slate-700/40 text-slate-300 border border-slate-600/40';
    entryPoint = files[0]?.path || null;
    recommendations.push('Projeye bir HTML (index.html), Lua (main.lua) veya Android kaynak dosyası ekleyin.');
  }

  if (!hasIcon) {
    recommendations.push('Uygulama için henüz özel bir ikon yüklenmedi. Varsayılan APK Studio ikonu kullanılacak.');
  }

  return {
    type,
    title,
    badgeColor,
    entryPoint,
    hasManifest,
    hasGradle,
    hasIcon,
    fileCount,
    totalSize,
    notes,
    recommendations
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

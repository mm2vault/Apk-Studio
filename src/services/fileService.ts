import JSZip from 'jszip';
import { ProjectFile, Project } from '../types/project';

// Text extensions are decoded as UTF-8 during file and ZIP import.
const TEXT_EXTENSIONS = [
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue', 'svelte',
  'json', 'json5', 'jsonc', 'xml', 'gradle', 'kt', 'kts', 'toml',
  'java', 'lua', 'py', 'txt', 'md', 'mdx',
  'properties', 'yaml', 'yml', 'svg', 'sh', 'bat', 'env',
  'ini', 'conf', 'config', 'pro', 'plist', 'strings', 'xcconfig',
  'csv', 'sql', 'dart', 'swift', 'm', 'mm', 'c', 'h', 'cc', 'cpp',
  'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'graphql', 'gql', 'ps1',
  'webmanifest', 'lock', 'lockfile', 'gitignore', 'gitattributes',
  'gitmodules', 'npmrc', 'nvmrc', 'editorconfig', 'dockerignore'
];

// Extensionless project files must remain text too. Gradle's gradlew script
// is essential when importing a native Android project.
const TEXT_FILE_NAMES = new Set([
  'gradlew', 'makefile', 'dockerfile', 'procfile', 'license', 'notice',
  'readme', 'gemfile', 'podfile', 'brewfile', 'justfile',
  '.gitignore', '.gitattributes', '.gitmodules', '.npmrc', '.nvmrc',
  '.editorconfig', '.dockerignore'
]);

/**
 * Android string kaynağı (strings.xml) için metni güvenli hale getirir:
 * XML özel karakterleri kaçırılır; apostrof, tırnak, ters eğik çizgi ve
 * satır başındaki @ / ? Android'in kendi kaçış kurallarına göre işlenir.
 */
export function escapeAndroidString(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/^([@?])/, '\\$1');
}

export function isTextFile(fileName: string): boolean {
  const baseName = fileName.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';
  if (TEXT_FILE_NAMES.has(baseName)) return true;
  const ext = baseName.split('.').pop() || '';
  return TEXT_EXTENSIONS.includes(ext);
}

export function getMimeType(fileName: string): string {
  const baseName = fileName.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';
  const ext = baseName.split('.').pop() || '';
  const map: Record<string, string> = {
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    scss: 'text/x-scss',
    sass: 'text/x-sass',
    less: 'text/x-less',
    js: 'application/javascript',
    mjs: 'application/javascript',
    cjs: 'application/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    json: 'application/json',
    json5: 'application/json5',
    jsonc: 'application/json',
    xml: 'application/xml',
    gradle: 'text/x-groovy',
    kt: 'text/x-kotlin',
    kts: 'text/x-kotlin',
    toml: 'application/toml',
    java: 'text/x-java-source',
    lua: 'text/x-lua',
    py: 'text/x-python',
    sh: 'text/x-shellscript',
    csv: 'text/csv',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    ico: 'image/x-icon',
    zip: 'application/zip',
    webmanifest: 'application/manifest+json'
  };
  return map[ext] || (isTextFile(baseName) ? 'text/plain' : 'application/octet-stream');
}

export async function readBrowserFile(file: File, relativePath?: string): Promise<ProjectFile> {
  const filePath = relativePath || (file as any).webkitRelativePath || file.name;
  const isText = isTextFile(file.name);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (isText) {
      reader.onload = () => {
        resolve({
          id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          path: filePath.replace(/^[\\/]/, ''),
          size: file.size,
          type: getMimeType(file.name),
          content: reader.result as string,
          isBinary: false,
          lastModified: file.lastModified || Date.now()
        });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        resolve({
          id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          path: filePath.replace(/^[\\/]/, ''),
          size: file.size,
          type: getMimeType(file.name),
          content: reader.result as string, // DataURL
          isBinary: true,
          lastModified: file.lastModified || Date.now()
        });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }
  });
}

export async function extractZipArchive(zipFile: File): Promise<ProjectFile[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipFile);
  const extractedFiles: ProjectFile[] = [];

  const entries = Object.keys(loadedZip.files);
  for (const entryPath of entries) {
    const zipEntry = loadedZip.files[entryPath];
    if (zipEntry.dir) continue; // Skip directory markers

    // Validate the original ZIP path before using JSZip's normalized path.
    const originalPath = String((zipEntry as any).unsafeOriginalName || entryPath).replace(/\\/g, '/');
    if (
      !originalPath ||
      originalPath.startsWith('/') ||
      /^[a-z]:\//i.test(originalPath) ||
      originalPath.split('/').some(part => part === '..')
    ) {
      throw new Error(`ZIP arşivinde güvenli olmayan dosya yolu bulundu: ${originalPath || entryPath}`);
    }

    const safePath = originalPath.split('/').filter(part => part && part !== '.').join('/');
    if (!safePath) continue;

    // Ignore OS metadata and repository history, but keep .github workflows.
    const pathParts = safePath.split('/');
    if (pathParts.includes('__MACOSX') || pathParts.includes('.DS_Store') || pathParts.includes('.git')) {
      continue;
    }

    const fileName = pathParts[pathParts.length - 1];
    const isText = isTextFile(fileName);

    if (isText) {
      const textContent = await zipEntry.async('string');
      extractedFiles.push({
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: fileName,
        path: safePath,
        size: textContent.length,
        type: getMimeType(fileName),
        content: textContent,
        isBinary: false,
        lastModified: Date.now()
      });
    } else {
      const base64Content = await zipEntry.async('base64');
      const mime = getMimeType(fileName);
      extractedFiles.push({
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: fileName,
        path: safePath,
        size: Math.round(base64Content.length * 0.75),
        type: mime,
        content: `data:${mime};base64,${base64Content}`,
        isBinary: true,
        lastModified: Date.now()
      });
    }
  }

  return extractedFiles;
}

export async function generateProjectZip(project: Project): Promise<Blob> {
  const zip = new JSZip();

  for (const file of project.files) {
    if (file.isBinary) {
      // Parse base64
      const parts = file.content.split(',');
      const base64Data = parts.length > 1 ? parts[1] : parts[0];
      zip.file(file.path, base64Data, { base64: true });
    } else {
      zip.file(file.path, file.content);
    }
  }

  // Also include project config metadata
  const metaJson = JSON.stringify({
    name: project.name,
    packageId: project.config.packageId,
    versionName: project.config.versionName,
    versionCode: project.config.versionCode,
    type: project.type,
    iconDataUrl: project.config.iconDataUrl,
    iconShape: project.config.iconShape,
    exportedWith: 'APK Studio Mobile',
    exportedAt: new Date().toISOString()
  }, null, 2);
  zip.file('.apkstudio-meta.json', metaJson);

  return await zip.generateAsync({ type: 'blob' });
}

async function addLauncherIconResources(
  zip: JSZip,
  iconDataUrl?: string,
  iconShape: Project['config']['iconShape'] = 'squircle'
): Promise<void> {
  const vector = (round: boolean) => `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="48dp"
    android:height="48dp"
    android:viewportWidth="48"
    android:viewportHeight="48">
    <path android:fillColor="#111827" android:pathData="${round
      ? 'M24,0 C37.255,0 48,10.745 48,24 C48,37.255 37.255,48 24,48 C10.745,48 0,37.255 0,24 C0,10.745 10.745,0 24,0 Z'
      : 'M8,0 H40 C44.418,0 48,3.582 48,8 V40 C48,44.418 44.418,48 40,48 H8 C3.582,48 0,44.418 0,40 V8 C0,3.582 3.582,0 8,0 Z'}" />
    <path android:fillColor="#22D3EE" android:pathData="M17,5 H31 C33.761,5 36,7.239 36,10 V38 C36,40.761 33.761,43 31,43 H17 C14.239,43 12,40.761 12,38 V10 C12,7.239 14.239,5 17,5 Z" />
    <path android:fillColor="#111827" android:pathData="M17,10 H31 V35 H17 Z" />
    <path android:fillColor="#A78BFA" android:pathData="M21,38 H27 V40 H21 Z" />
    <path android:fillColor="#A78BFA" android:pathData="M39,7 L40.5,11.5 L45,13 L40.5,14.5 L39,19 L37.5,14.5 L33,13 L37.5,11.5 Z" />
</vector>
`;

  zip.file('app/src/main/res/mipmap-anydpi-v21/ic_launcher.xml', vector(false));
  zip.file('app/src/main/res/mipmap-anydpi-v21/ic_launcher_round.xml', vector(true));

  if (!iconDataUrl || typeof Image === 'undefined' || typeof document === 'undefined') return;

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Uygulama ikonu okunamadı.'));
      image.src = iconDataUrl;
    });

    const densities = [
      { folder: 'mipmap-mdpi', size: 48 },
      { folder: 'mipmap-hdpi', size: 72 },
      { folder: 'mipmap-xhdpi', size: 96 },
      { folder: 'mipmap-xxhdpi', size: 144 },
      { folder: 'mipmap-xxxhdpi', size: 192 }
    ];

    for (const density of densities) {
      for (const round of [false, true]) {
        const canvas = document.createElement('canvas');
        canvas.width = density.size;
        canvas.height = density.size;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Uygulama ikonu için canvas oluşturulamadı.');

        const size = density.size;
        const radius = round ? size / 2 : iconShape === 'square' ? 0
          : iconShape === 'squircle' ? size * 0.23 : size * 0.17;
        context.beginPath();
        if (round) {
          context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        } else if (radius === 0) {
          context.rect(0, 0, size, size);
        } else {
          context.moveTo(radius, 0);
          context.lineTo(size - radius, 0);
          context.quadraticCurveTo(size, 0, size, radius);
          context.lineTo(size, size - radius);
          context.quadraticCurveTo(size, size, size - radius, size);
          context.lineTo(radius, size);
          context.quadraticCurveTo(0, size, 0, size - radius);
          context.lineTo(0, radius);
          context.quadraticCurveTo(0, 0, radius, 0);
        }
        context.closePath();
        context.clip();
        context.fillStyle = '#111827';
        context.fillRect(0, 0, size, size);

        const inset = size * 0.08;
        const scale = Math.min((size - inset * 2) / image.width, (size - inset * 2) / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);

        const base64 = canvas.toDataURL('image/png').split(',')[1];
        const name = round ? 'ic_launcher_round.png' : 'ic_launcher.png';
        zip.file(`app/src/main/res/${density.folder}/${name}`, base64, { base64: true });
      }
    }
  } catch (error) {
    // Keep the built-in vector icons if a user-supplied image cannot be converted.
    console.warn('Custom launcher icon could not be generated; using the default icon.', error);
  }
}

export async function generateFullAndroidGradleProjectZip(project: Project): Promise<Blob> {
  const zip = new JSZip();

  // Native Android imports must keep their original Gradle structure; do not wrap them in WebView assets.
  if (project.type === 'native-android') {
    for (const file of project.files) {
      const safePath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!safePath || safePath.split('/').some(part => part === '..')) {
        throw new Error(`Geçersiz Android proje dosya yolu: ${file.path}`);
      }
      if (file.isBinary) {
        const base64Data = file.content.includes(',') ? file.content.split(',').pop()! : file.content;
        zip.file(safePath, base64Data, { base64: true });
      } else {
        zip.file(safePath, file.content);
      }
    }
    zip.file('README_APK_STUDIO.md', `# Yerel Android Projesi

Bu arşiv, APK Studio Mobile tarafından içe aktarılan Android Gradle projesinin orijinal klasör yapısını korur.

## Bulutta APK derleme
1. Arşivi bir GitHub deposuna yükleyin.
2. Actions sekmesinden **APK Studio - Build Android APK** iş akışını çalıştırın.
3. Proje kök dizindeyse project_path alanına . yazın.
4. Debug veya Release seçip Run workflow düğmesine basın.
5. APK dosyasını çalışmanın Artifacts bölümünden indirin.

Bu işlem yalnızca geçerli bir Android Gradle projesi için çalışır.
`);
    zip.file('.github/workflows/build-apk.yml', `name: APK Studio - Build Android APK
on:
  workflow_dispatch:
    inputs:
      project_path:
        description: "Android Gradle project folder (use . for repository root)"
        required: true
        default: "."
        type: string
      build_variant:
        description: "APK build variant"
        required: true
        default: "debug"
        type: choice
        options: [debug, release]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: "17"
      - uses: gradle/actions/setup-gradle@v6
        with:
          gradle-version: "8.2.1"
      - name: Prepare Gradle wrapper
        working-directory: \${{ inputs.project_path }}
        run: |
          test -f settings.gradle -o -f settings.gradle.kts
          if [ ! -f gradlew ]; then gradle wrapper --gradle-version 8.2.1 --distribution-type bin; fi
          chmod +x gradlew
      - name: Build APK
        working-directory: \${{ inputs.project_path }}
        env:
          BUILD_VARIANT: \${{ inputs.build_variant }}
        run: ./gradlew "assemble\${BUILD_VARIANT^}" --stacktrace --no-daemon
      - uses: actions/upload-artifact@v4
        with:
          name: apk-studio-\${{ inputs.build_variant }}
          path: \${{ inputs.project_path }}/app/build/outputs/apk/**/*.apk
          if-no-files-found: error
          retention-days: 14
`);
    return await zip.generateAsync({ type: 'blob' });
  }

  if (project.type !== 'web-to-apk') {
    throw new Error('Bu proje türü otomatik WebView APK dönüşümünü desteklemiyor. Yerel Android Gradle projesi veya HTML/CSS/JavaScript web projesi kullanın. Lua için LÖVE Android, Python için Kivy/Buildozer runtime entegrasyonu gerekir.');
  }

  const cfg = project.config;
  const pkg = cfg.packageId || 'com.example.apkstudio';
  const pkgPath = pkg.replace(/\./g, '/');

  // 1. Root settings.gradle
  zip.file('settings.gradle', `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}"
include ':app'
`);

  // 2. Root build.gradle
  zip.file('build.gradle', `plugins {
    id 'com.android.application' version '8.2.2' apply false
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`);

  // 3. gradle.properties
  zip.file('gradle.properties', `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
`);

  // 4. app/build.gradle
  zip.file('app/build.gradle', `plugins {
    id 'com.android.application'
}

android {
    namespace '${pkg}'
    compileSdk ${cfg.targetSdk || 34}

    defaultConfig {
        applicationId "${pkg}"
        minSdk ${cfg.minSdk || 24}
        targetSdk ${cfg.targetSdk || 34}
        versionCode ${cfg.versionCode || 1}
        versionName "${cfg.versionName || '1.0.0'}"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.webkit:webkit:1.10.0'
}
`);

  // 5. AndroidManifest.xml
  const selectedPerms: string[] = [];
  if (cfg.permissions.internet) selectedPerms.push('android.permission.INTERNET');
  if (cfg.permissions.networkState) selectedPerms.push('android.permission.ACCESS_NETWORK_STATE');
  if (cfg.permissions.camera) selectedPerms.push('android.permission.CAMERA');
  if (cfg.permissions.audioRecord) selectedPerms.push('android.permission.RECORD_AUDIO');
  if (cfg.permissions.locationFine) selectedPerms.push('android.permission.ACCESS_FINE_LOCATION');
  if (cfg.permissions.locationCoarse) selectedPerms.push('android.permission.ACCESS_COARSE_LOCATION');
  if (cfg.permissions.readStorage) selectedPerms.push('android.permission.READ_EXTERNAL_STORAGE');
  if (cfg.permissions.writeStorage) selectedPerms.push('android.permission.WRITE_EXTERNAL_STORAGE');
  if (cfg.permissions.vibrate) selectedPerms.push('android.permission.VIBRATE');
  cfg.permissions.custom?.forEach(p => selectedPerms.push(p));

  const orientationAttr = cfg.orientation !== 'unspecified' ? `\n            android:screenOrientation="${cfg.orientation}"` : '';

  zip.file('app/src/main/AndroidManifest.xml', `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}">

    ${selectedPerms.map(p => `<uses-permission android:name="${p}" />`).join('\n    ')}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"${orientationAttr}
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`);

  const htmlEntry = project.files.find(f => f.path.toLowerCase() === 'index.html')
    || project.files.find(f => /\.html?$/i.test(f.path));
  const webEntryPath = (htmlEntry?.path || 'index.html')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(part => part && part !== '.' && part !== '..')
    .join('/');
  const escapedWebEntryPath = webEntryPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // 6. MainActivity.java
  zip.file(`app/src/main/java/${pkgPath}/MainActivity.java`, `package ${pkg};

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        webView = new WebView(this);
        setContentView(webView);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(${cfg.webSettings?.allowJavaScript ?? true});
        ws.setDomStorageEnabled(${cfg.webSettings?.allowDomStorage ?? true});
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/${escapedWebEntryPath}");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
`);

  // 7. Launcher icons: always provide valid resources; replace with user icon when available.
  await addLauncherIconResources(zip, cfg.iconDataUrl, cfg.iconShape);

  // 7. res/values/strings.xml
  zip.file('app/src/main/res/values/strings.xml', `<resources>
    <string name="app_name">${escapeAndroidString(cfg.name || project.name)}</string>
</resources>
`);

  // 8. Place web/project files inside app/src/main/assets/
  for (const file of project.files) {
    const safeAssetPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!safeAssetPath || safeAssetPath.split('/').some(part => part === '..')) {
      throw new Error(`Geçersiz web proje dosya yolu: ${file.path}`);
    }
    const assetPath = `app/src/main/assets/${safeAssetPath}`;
    if (file.isBinary) {
      const parts = file.content.split(',');
      const base64Data = parts.length > 1 ? parts[1] : parts[0];
      zip.file(assetPath, base64Data, { base64: true });
    } else {
      zip.file(assetPath, file.content);
    }
  }

  // 9. GitHub Actions workflow (manual dispatch; performs a real Gradle build)
  zip.file('.github/workflows/build-apk.yml', `name: APK Studio - Build Android APK
on:
  workflow_dispatch:
    inputs:
      project_path:
        description: "Android Gradle project folder (use . for repository root)"
        required: true
        default: "."
        type: string
      build_variant:
        description: "APK build variant"
        required: true
        default: "debug"
        type: choice
        options: [debug, release]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: "17"
      - uses: gradle/actions/setup-gradle@v6
        with:
          gradle-version: "8.2.1"
      - name: Validate Gradle project
        working-directory: \${{ inputs.project_path }}
        run: |
          test -f settings.gradle -o -f settings.gradle.kts
          if [ ! -f gradlew ]; then gradle wrapper --gradle-version 8.2.1 --distribution-type bin; fi
          chmod +x gradlew
      - name: Build APK
        working-directory: \${{ inputs.project_path }}
        env:
          BUILD_VARIANT: \${{ inputs.build_variant }}
        run: ./gradlew "assemble\${BUILD_VARIANT^}" --stacktrace --no-daemon
      - uses: actions/upload-artifact@v4
        with:
          name: ${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-apk
          path: \${{ inputs.project_path }}/app/build/outputs/apk/**/*.apk
          if-no-files-found: error
          retention-days: 14
`);

  // 10. README.md with instructions
  zip.file('README_DERLEME_TALIMATLARI.md', `# ${project.name} - Android Projesi

Bu proje **APK Studio Mobile** tarafından otomatik olarak yapılandırılmıştır.

## 🚀 Projeyi Derleme Yolları

### 1. Yol: Bilgisayarınızda (Android Studio veya Terminal)
1. Bu ZIP arşivini bir klasöre çıkartın.
2. Android Studio'yu açıp **Open an Existing Project** diyerek bu klasörü seçin.
3. Gradle senkronizasyonunun bitmesini bekleyin.
4. Menüden **Build > Build Bundle(s) / APK(s) > Build APK(s)** seçeneğine tıklayın.
5. Veya terminalde şu komutu çalıştırın:
   \`\`\`bash
   ./gradlew assembleDebug
   \`\`\`
   Çıktı APK'sı: \`app/build/outputs/apk/debug/app-debug.apk\`

### 2. Yol: GitHub Actions ile Ücretsiz Bulut Derleme (Cloud Build)
1. Bu projeyi bir GitHub deposuna yükleyin (\`git init\`, \`git push\`).
2. Deponuzdaki **Actions** sekmesine gidin.
3. Hazır oluşturulan \`.github/workflows/build-apk.yml\` iş akışı otomatik olarak Ubuntu sunucusunda OpenJDK 17 ile APK dosyanızı derleyecek ve indirilebilir Artifact olarak sunacaktır.
`);

  return await zip.generateAsync({ type: 'blob' });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

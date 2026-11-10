import JSZip from 'jszip';
import { ProjectFile, Project } from '../types/project';

// List of text extensions that should be read as UTF-8
const TEXT_EXTENSIONS = [
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'json', 'xml', 'gradle', 'java', 'kt', 'kts', 'lua', 'py', 'txt',
  'md', 'properties', 'yaml', 'yml', 'svg', 'sh', 'bat', 'env'
];

export function isTextFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return TEXT_EXTENSIONS.includes(ext);
}

export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    ts: 'text/typescript',
    json: 'application/json',
    xml: 'application/xml',
    gradle: 'text/x-groovy',
    java: 'text/x-java-source',
    kt: 'text/x-kotlin',
    lua: 'text/x-lua',
    py: 'text/x-python',
    txt: 'text/plain',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    zip: 'application/zip'
  };
  return map[ext] || 'application/octet-stream';
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

    // Ignore MacOS metadata and hidden git files
    if (entryPath.includes('__MACOSX') || entryPath.includes('.DS_Store')) {
      continue;
    }

    const fileName = entryPath.split('/').pop() || entryPath;
    const isText = isTextFile(fileName);

    if (isText) {
      const textContent = await zipEntry.async('string');
      extractedFiles.push({
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: fileName,
        path: entryPath.replace(/^[\\/]/, ''),
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
        path: entryPath.replace(/^[\\/]/, ''),
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
    exportedWith: 'APK Studio Mobile',
    exportedAt: new Date().toISOString()
  }, null, 2);
  zip.file('.apkstudio-meta.json', metaJson);

  return await zip.generateAsync({ type: 'blob' });
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

  // 7. res/values/strings.xml
  zip.file('app/src/main/res/values/strings.xml', `<resources>
    <string name="app_name">${cfg.name || project.name}</string>
</resources>
`);

  // 8. Place web/project files inside app/src/main/assets/
  const htmlEntry = project.files.find(f => f.path.toLowerCase() === 'index.html')
    || project.files.find(f => /\.html?$/i.test(f.path));
  const webEntryPath = (htmlEntry?.path || 'index.html')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(part => part && part !== '.' && part !== '..')
    .join('/');
  const escapedWebEntryPath = webEntryPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

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

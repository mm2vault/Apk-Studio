import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { execFile, execSync } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import os from 'os';
import JSZip from 'jszip';
import { timingSafeEqual } from 'crypto';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

function isAuthorizedBuildRequest(req: express.Request): boolean {
  const expected = process.env.APK_STUDIO_BUILD_API_KEY || '';
  const provided = req.get('x-apk-studio-key') || '';
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '75mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API 1: System environment & Android SDK check
  app.get('/api/system/check', (_req, res) => {
    let javaStatus = { available: false, version: 'Bulunamadı', details: 'OpenJDK bulunamadı' };
    let gradleStatus = { available: false, version: 'Bulunamadı', details: 'Gradle CLI bulunamadı' };
    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || null;

    try {
      const javaOut = execSync('java -version 2>&1', { timeout: 1500 }).toString();
      javaStatus = {
        available: true,
        version: javaOut.split('\n')[0]?.replace(/"/g, '') || 'Java Mevcut',
        details: javaOut.split('\n').slice(0, 2).join(' ')
      };
    } catch {
      // Not installed in container
    }

    try {
      const gradleOut = execSync('gradle -v 2>&1', { timeout: 1500 }).toString();
      gradleStatus = {
        available: true,
        version: gradleOut.split('\n')[0] || 'Gradle Mevcut',
        details: gradleOut.split('\n').slice(0, 2).join(' ')
      };
    } catch {
      // Not installed in container
    }

    const sdkAvailable = Boolean(androidHome);

    return res.json({
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      toolchain: {
        java: javaStatus,
        gradle: gradleStatus,
        androidSdk: {
          available: sdkAvailable,
          path: androidHome,
          details: sdkAvailable ? `Yüklü: ${androidHome}` : 'ANDROID_HOME ortam değişkeni ayarlı değil'
        }
      },
      readyForLocalBuild: javaStatus.available && gradleStatus.available && sdkAvailable && process.env.APK_STUDIO_ENABLE_LOCAL_BUILD === 'true',
      localBuildEnabled: process.env.APK_STUDIO_ENABLE_LOCAL_BUILD === 'true',
      recommendation: (!javaStatus.available || !sdkAvailable)
        ? 'Bu sunucu ortamında Android SDK & OpenJDK bulunmamaktadır. Yerel derleme için projeyi ZIP olarak indirip Android Studio / Gradle ile derleyebilir veya GitHub Actions Bulut Derleme (Cloud Build) iş akışını kullanabilirsiniz.'
        : process.env.APK_STUDIO_ENABLE_LOCAL_BUILD !== 'true'
          ? 'Derleme araçları mevcut, ancak güvenlik nedeniyle yerel derleme kapalı. Yalnızca localhost sunucusunda APK_STUDIO_ENABLE_LOCAL_BUILD=true ile açın.'
          : 'Yerel derleme ortamı hazır.'
    });
  });

  // API 2: Project validation & linting
  app.post('/api/build/validate', (req, res) => {
    const { name, packageId, versionCode, versionName, minSdk, targetSdk, files } = req.body;
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!name || name.trim().length === 0) {
      errors.push('Uygulama adı boş olamaz.');
    }

    const packageIdRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
    if (!packageId || !packageIdRegex.test(packageId)) {
      errors.push('Paket Kimliği (Package ID) geçersiz. Örnek format: "com.sirket.uygulama"');
    }

    const vCode = parseInt(versionCode, 10);
    if (isNaN(vCode) || vCode < 1) {
      errors.push('Versiyon kodu 1 veya daha büyük bir pozitif tam sayı olmalıdır.');
    }

    const min = parseInt(minSdk, 10);
    const target = parseInt(targetSdk, 10);
    if (min < 21) {
      warnings.push('Minimum SDK 21 (Android 5.0) veya üzeri önerilir. Eski cihaz desteği güvenlik açıkları yaratabilir.');
    }
    if (target < 33) {
      warnings.push('Google Play Store en az Target SDK 33 (Android 13) zorunlu tutmaktadır.');
    }

    // Check files
    const fileList = Array.isArray(files) ? files : [];
    const hasIndexHtml = fileList.some((f: { name: string; path?: string }) => 
      (f.path || f.name).toLowerCase().endsWith('index.html')
    );
    const hasManifest = fileList.some((f: { name: string; path?: string }) => 
      (f.path || f.name).toLowerCase().includes('androidmanifest.xml')
    );
    const hasGradle = fileList.some((f: { name: string; path?: string }) => 
      (f.path || f.name).toLowerCase().includes('build.gradle')
    );
    const hasLua = fileList.some((f: { name: string; path?: string }) => 
      (f.path || f.name).toLowerCase().endsWith('.lua')
    );
    const hasPython = fileList.some((f: { name: string; path?: string }) => 
      (f.path || f.name).toLowerCase().endsWith('.py')
    );

    let detectedType = 'Bilinmeyen / Özel';
    if (hasManifest && hasGradle) {
      detectedType = 'Yerel Android (Gradle/Java/Kotlin)';
    } else if (hasIndexHtml) {
      detectedType = 'Web to APK (HTML5 / WebView / PWA)';
      suggestions.push('Web to APK projesi tespit edildi. Otomatik Android WebView Wrapper ve assets/ kökü yapılandırılacaktır.');
    } else if (hasLua) {
      detectedType = 'LÖVE2D / Lua Mobile';
      suggestions.push('Lua scriptleri tespit edildi. LÖVE Android motoru veya LuaJIT köprüsü ile derlenebilir.');
    } else if (hasPython) {
      detectedType = 'Python (Kivy / BeeWare)';
      suggestions.push('Python dosyaları tespit edildi. Buildozer veya Chaquopy yapılandırması gerektirir.');
    }

    return res.json({
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      detectedType,
      fileCount: fileList.length
    });
  });

  // API 3: Generate Android Project Scaffold (build.gradle, Manifest, etc.)
  app.post('/api/build/scaffold', (req, res) => {
    const { name, packageId, versionCode, versionName, minSdk, targetSdk, permissions } = req.body;
    
    const pkg = packageId || 'com.example.apkstudio';
    const appName = name || 'MyMobileApp';
    const vCode = versionCode || '1';
    const vName = versionName || '1.0.0';
    const mSdk = minSdk || '24';
    const tSdk = targetSdk || '34';
    const selectedPerms: string[] = Array.isArray(permissions) ? permissions : ['android.permission.INTERNET'];

    const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}">

    ${selectedPerms.map(p => `<uses-permission android:name="${p}" />`).join('\n    ')}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${appName}"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

    const rootBuildGradle = `// Top-level build file where you can add configuration options common to all sub-projects/modules.
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath "com.android.tools.build:gradle:8.2.2"
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}`;

    const appBuildGradle = `plugins {
    id 'com.android.application'
}

android {
    namespace '${pkg}'
    compileSdk ${tSdk}

    defaultConfig {
        applicationId "${pkg}"
        minSdk ${mSdk}
        targetSdk ${tSdk}
        versionCode ${vCode}
        versionName "${vName}"

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
}`;

    const mainActivityJava = `package ${pkg};

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

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);

        webView.setWebViewClient(new WebViewClient());
        // Load local bundled assets from app/src/main/assets/index.html
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}`;

    const githubWorkflowYaml = `name: Build Android APK
on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v6

      - name: Set up JDK 17
        uses: actions/setup-java@v5
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: gradle

      - name: Grant execute permission for gradlew
        run: chmod +x gradlew || true

      - name: Build with Gradle
        run: ./gradlew assembleRelease --stacktrace

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-release-apk
          path: app/build/outputs/apk/release/*.apk
`;

    return res.json({
      files: {
        'AndroidManifest.xml': manifestXml,
        'build.gradle': rootBuildGradle,
        'app/build.gradle': appBuildGradle,
        'app/src/main/java/MainActivity.java': mainActivityJava,
        '.github/workflows/build-apk.yml': githubWorkflowYaml
      }
    });
  });

  // API 4: Real local Gradle build. Disabled by default; enable only on a trusted loopback host.
  app.post('/api/build/local', async (req, res) => {
    const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
    const requestHost = (req.get('host') || '').split(':')[0].replace(/^\[|\]$/g, '');
    const origin = req.get('origin');
    let originIsLoopback = true;
    if (origin) {
      try {
        originIsLoopback = ['localhost', '127.0.0.1', '::1'].includes(new URL(origin).hostname);
      } catch {
        originIsLoopback = false;
      }
    }
    if (!isAuthorizedBuildRequest(req)) {
      return res.status(401).json({ success: false, errorType: 'UNAUTHORIZED', message: 'Build API anahtarı gerekli veya geçersiz.' });
    }
    if (process.env.APK_STUDIO_ENABLE_LOCAL_BUILD !== 'true' || !isLoopback
      || !['localhost', '127.0.0.1', '::1'].includes(requestHost) || !originIsLoopback) {
      return res.status(403).json({
        success: false,
        errorType: 'LOCAL_BUILD_DISABLED',
        message: 'Yerel derleme güvenlik nedeniyle varsayılan olarak kapalıdır. APK_STUDIO_ENABLE_LOCAL_BUILD=true ayarını yalnızca localhost üzerinde çalışan güvenilir bir sunucuda etkinleştirin.'
      });
    }

    const archiveBase64 = req.body?.archiveBase64;
    if (typeof archiveBase64 !== 'string' || archiveBase64.length < 20 || archiveBase64.length > 65_000_000) {
      return res.status(400).json({ success: false, errorType: 'INVALID_ARCHIVE', message: 'Geçersiz veya çok büyük Gradle proje arşivi.' });
    }

    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (!androidHome) {
      return res.status(503).json({
        success: false,
        errorType: 'MISSING_ANDROID_SDK',
        message: 'ANDROID_HOME / ANDROID_SDK_ROOT ayarlı değil. Yerel APK derlemek için Android SDK, OpenJDK 17 ve Gradle kurulmalıdır.'
      });
    }

    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'apk-studio-build-'));
    try {
      const archive = await JSZip.loadAsync(Buffer.from(archiveBase64, 'base64'));
      const entries = Object.values(archive.files);
      for (const entry of entries) {
        if (entry.dir) continue;
        const normalized = entry.name.replace(/\\/g, '/');
        if (normalized.startsWith('/') || normalized.split('/').some((part: string) => part === '..')) {
          throw new Error(`Güvenli olmayan ZIP yolu: ${entry.name}`);
        }
        const destination = path.resolve(workspace, normalized);
        if (destination !== workspace && !destination.startsWith(workspace + path.sep)) {
          throw new Error(`ZIP yolu çalışma klasörünün dışına çıkıyor: ${entry.name}`);
        }
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, await entry.async('nodebuffer'));
      }

      const settingsExists = await fs.access(path.join(workspace, 'settings.gradle')).then(() => true).catch(() => false)
        || await fs.access(path.join(workspace, 'settings.gradle.kts')).then(() => true).catch(() => false);
      if (!settingsExists) throw new Error('Arşivde settings.gradle veya settings.gradle.kts bulunamadı.');

      await execFileAsync('gradle', ['wrapper', '--gradle-version', '8.2.1', '--distribution-type', 'bin'], {
        cwd: workspace, timeout: 180000, maxBuffer: 10 * 1024 * 1024
      });

      const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
      if (process.platform !== 'win32') await fs.chmod(path.join(workspace, 'gradlew'), 0o755);
      await execFileAsync(wrapper, ['assembleDebug', '--stacktrace', '--no-daemon'], {
        cwd: workspace,
        timeout: 900000,
        maxBuffer: 20 * 1024 * 1024,
        shell: process.platform === 'win32',
        env: { ...process.env, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome }
      });

      const apkPath = path.join(workspace, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
      const apk = await fs.readFile(apkPath);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="app-debug.apk"');
      res.setHeader('Content-Length', String(apk.length));
      return res.send(apk);
    } catch (error: any) {
      console.error('[APK Studio] Local build failed:', error);
      const output = [error?.stdout, error?.stderr]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join('\n');
      const timestamp = new Date().toISOString();
      const outputLines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(-120);
      const logs = (outputLines.length ? outputLines : [String(error?.message || 'Gradle derlemesi başarısız oldu.')])
        .map((line, index) => ({
          id: \`local-\${Date.now()}-\${index}\`,
          timestamp,
          level: /\b(error|failed|exception)\b/i.test(line) ? 'error' as const
            : /\bwarn(ing)?\b/i.test(line) ? 'warn' as const : 'info' as const,
          message: line.slice(0, 1200),
          step: 'Gradle'
        }));
      return res.status(500).json({
        success: false,
        errorType: 'GRADLE_BUILD_FAILED',
        message: error?.message || 'Gradle derlemesi başarısız oldu.',
        logs,
        instructions: ['Android SDK lisanslarını kabul edin.', 'ANDROID_HOME yolunu ve SDK Build Tools kurulumunu kontrol edin.', 'Derleme günlüklerindeki ilk gerçek hata satırını inceleyin.']
      });
    } finally {
      await fs.rm(workspace, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  // API 5: Trigger the repository's real GitHub Actions workflow.
  // The GitHub token is read only from the server environment and is never sent to the browser.
  app.post('/api/build/cloud/trigger', async (req, res) => {
    if (!isAuthorizedBuildRequest(req)) {
      return res.status(401).json({ success: false, message: 'Build API anahtarı gerekli veya geçersiz.' });
    }
    const repository = process.env.GITHUB_REPOSITORY || '';
    const token = process.env.GITHUB_TOKEN || '';
    const ref = process.env.GITHUB_BUILD_REF || 'main';
    const projectPath = typeof req.body?.projectPath === 'string' ? req.body.projectPath.trim() : '.';
    const buildVariant = req.body?.buildVariant === 'release' ? 'release' : 'debug';

    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token) {
      return res.status(503).json({
        success: false,
        message: 'Cloud Build yapılandırılmamış. Sunucu ortamına GITHUB_REPOSITORY (owner/repo) ve GITHUB_TOKEN ekleyin.'
      });
    }
    if (!projectPath || projectPath.startsWith('/') || projectPath.includes('\\\\') || projectPath.split('/').some((part: string) => part === '..')) {
      return res.status(400).json({ success: false, message: 'Geçersiz proje klasörü yolu.' });
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/build-apk.yml/dispatches`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref, inputs: { project_path: projectPath, build_variant: buildVariant } })
      });

      if (!response.ok) {
        const detail = await response.text();
        return res.status(response.status).json({
          success: false,
          message: `GitHub Actions isteği reddedildi (HTTP ${response.status}). ${detail.slice(0, 500)}`
        });
      }

      return res.status(202).json({
        success: true,
        status: 'dispatched',
        provider: 'github-actions',
        repository,
        ref,
        projectPath,
        buildVariant,
        workflowUrl: `https://github.com/${repository}/actions/workflows/build-apk.yml`,
        message: 'GitHub Actions APK derlemesi başlatıldı. Çıktı Actions sayfasındaki Artifacts bölümünde görünecek.'
      });
    } catch (error: any) {
      return res.status(502).json({ success: false, message: `GitHub bağlantı hatası: ${error?.message || 'Bilinmeyen hata'}` });
    }
  });

  // Setup Vite middlewares in development or serve static in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const host = process.env.APK_STUDIO_ENABLE_LOCAL_BUILD === 'true' ? '127.0.0.1' : '0.0.0.0';
  app.listen(port, host, () => {
    console.log(`[APK Studio Mobile] Server running at http://${host}:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[APK Studio Mobile] Failed to start server:', err);
  process.exit(1);
});

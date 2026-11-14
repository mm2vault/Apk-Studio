import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { execFile, execSync } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import os from 'os';
import JSZip from 'jszip';
import { randomUUID, timingSafeEqual } from 'crypto';
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
      const buildResult = await execFileAsync(wrapper, ['assembleDebug', '--stacktrace', '--no-daemon', '--console=plain'], {
        cwd: workspace,
        timeout: 900000,
        maxBuffer: 20 * 1024 * 1024,
        shell: process.platform === 'win32',
        env: { ...process.env, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome }
      });

      const output = [buildResult.stdout, buildResult.stderr]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join('\n');
      const outputLines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(-12);
      const successLogs = outputLines.map((line, index) => ({
        id: `local-success-${Date.now()}-${index}`,
        timestamp: new Date().toISOString(),
        level: /\b(error|failed|exception)\b/i.test(line) ? 'error'
          : /\bwarn(ing)?\b/i.test(line) ? 'warn' : 'info',
        message: line.slice(0, 220),
        step: 'Gradle'
      }));

      const apkPath = path.join(workspace, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
      const apk = await fs.readFile(apkPath);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="app-debug.apk"');
      res.setHeader('Content-Length', String(apk.length));
      res.setHeader('X-APK-Studio-Build-Logs', Buffer.from(JSON.stringify(successLogs)).toString('base64'));
      res.setHeader('Access-Control-Expose-Headers', 'X-APK-Studio-Build-Logs');
      res.setHeader('Cache-Control', 'no-store');
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
          id: 'local-' + Date.now() + '-' + index,
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

  // API 5: Upload the current project to a PRIVATE build repository and dispatch its isolated workflow.
  // The GitHub token stays on the server. User source is never uploaded to the public APK Studio source repo.
  app.post('/api/build/cloud/trigger', async (req, res) => {
    if (!isAuthorizedBuildRequest(req)) {
      return res.status(401).json({ success: false, message: 'Build API anahtarı gerekli veya geçersiz.' });
    }

    const repository = process.env.GITHUB_BUILD_REPOSITORY || '';
    const token = process.env.GITHUB_TOKEN || '';
    const ref = process.env.GITHUB_BUILD_REF || 'main';
    const archiveBase64 = req.body?.archiveBase64;
    const buildVariant = req.body?.buildVariant === 'release' ? 'release' : 'debug';

    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token) {
      return res.status(503).json({
        success: false,
        message: 'Cloud Build yapılandırılmamış. Sunucuda GITHUB_BUILD_REPOSITORY (özel depo) ve GITHUB_TOKEN ayarlayın.'
      });
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(ref)) {
      return res.status(400).json({ success: false, message: 'GITHUB_BUILD_REF yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir.' });
    }
    if (typeof archiveBase64 !== 'string' || archiveBase64.length < 32 || archiveBase64.length > 42_000_000) {
      return res.status(413).json({ success: false, message: 'Proje ZIP arşivi boş, geçersiz veya 30 MB sınırını aşıyor.' });
    }

    const archiveBuffer = Buffer.from(archiveBase64, 'base64');
    const canonicalBase64 = archiveBuffer.toString('base64');
    if (
      archiveBuffer.length < 22 ||
      archiveBuffer.length > 30 * 1024 * 1024 ||
      archiveBuffer[0] !== 0x50 ||
      archiveBuffer[1] !== 0x4b ||
      canonicalBase64.replace(/=+$/, '') !== archiveBase64.replace(/\s/g, '').replace(/=+$/, '')
    ) {
      return res.status(400).json({ success: false, message: 'Geçerli bir ZIP proje arşivi gönderilmelidir (en fazla 30 MB). ' });
    }

    const apiBase = `https://api.github.com/repos/${repository}`;
    const headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
    const apiRequest = (endpoint: string, init?: RequestInit) => fetch(`${apiBase}${endpoint}`, {
      ...init,
      headers: { ...headers, ...(init?.headers || {}) }
    });

    let branchName = '';
    try {
      const repoResponse = await apiRequest('');
      if (!repoResponse.ok) {
        const detail = await repoResponse.text();
        return res.status(repoResponse.status).json({
          success: false,
          message: `Özel build deposuna erişilemiyor (HTTP ${repoResponse.status}). Token izinlerini ve depo adını kontrol edin. ${detail.slice(0, 250)}`
        });
      }
      const repoInfo = await repoResponse.json() as { private?: boolean };
      if (repoInfo.private !== true) {
        return res.status(400).json({
          success: false,
          message: 'Güvenlik için kullanıcı projeleri yalnızca PRIVATE GitHub build deposuna gönderilir. Public depo kabul edilmiyor.'
        });
      }

      const workflowCheck = await apiRequest(`/contents/.github/workflows/build-user-project.yml?ref=${encodeURIComponent(ref)}`);
      if (!workflowCheck.ok) {
        return res.status(409).json({
          success: false,
          message: 'Özel build deposunda .github/workflows/build-user-project.yml bulunamadı. APK Studio deposundaki templates/build-user-project.yml dosyasını bu yola kopyalayın.'
        });
      }

      const baseRefResponse = await apiRequest(`/git/ref/heads/${encodeURIComponent(ref)}`);
      if (!baseRefResponse.ok) {
        return res.status(400).json({ success: false, message: `Build tabanı "${ref}" bulunamadı.` });
      }
      const baseRef = await baseRefResponse.json() as { object?: { sha?: string } };
      const baseSha = baseRef.object?.sha;
      if (!baseSha) throw new Error('GitHub build dalının başlangıç commit SHA değeri alınamadı.');

      const requestId = randomUUID();
      branchName = `apk-studio-build-${requestId}`;
      const archivePath = `cloud-builds/apk-studio-${requestId}.zip`;

      const branchResponse = await apiRequest('/git/refs', {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
      });
      if (!branchResponse.ok) {
        const detail = await branchResponse.text();
        throw new Error(`Geçici build dalı oluşturulamadı (HTTP ${branchResponse.status}): ${detail.slice(0, 300)}`);
      }

      const uploadResponse = await apiRequest(`/contents/${archivePath}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `APK Studio temporary project upload ${requestId}`,
          content: canonicalBase64,
          branch: branchName
        })
      });
      if (!uploadResponse.ok) {
        const detail = await uploadResponse.text();
        throw new Error(`Proje arşivi özel build deposuna yüklenemedi (HTTP ${uploadResponse.status}): ${detail.slice(0, 300)}`);
      }

      const dispatchResponse = await apiRequest('/actions/workflows/build-user-project.yml/dispatches', {
        method: 'POST',
        body: JSON.stringify({
          ref: branchName,
          inputs: { archive_path: archivePath, build_variant: buildVariant }
        })
      });
      if (!dispatchResponse.ok) {
        const detail = await dispatchResponse.text();
        throw new Error(`GitHub Actions başlatılamadı (HTTP ${dispatchResponse.status}): ${detail.slice(0, 300)}`);
      }

      return res.status(202).json({
        success: true,
        status: 'dispatched',
        provider: 'github-actions',
        repository,
        branch: branchName,
        buildVariant,
        workflowUrl: `https://github.com/${repository}/actions/workflows/build-user-project.yml`,
        message: 'Proje ZIP dosyası özel build deposuna geçici olarak yüklendi ve GitHub Actions başlatıldı. APK tamamlandığında Actions > Artifacts bölümünde bulunur; geçici dal işlem sonunda silinir.'
      });
    } catch (error: any) {
      if (branchName) {
        await apiRequest(`/git/refs/heads/${encodeURIComponent(branchName)}`, { method: 'DELETE' }).catch(() => undefined);
      }
      return res.status(502).json({
        success: false,
        message: error?.message || 'Cloud Build başlatılırken beklenmeyen bir hata oluştu.'
      });
    }
  });

  // API 6: Poll a private GitHub Actions build and expose its artifact through the authenticated backend.
  app.get('/api/build/cloud/status/:branch', async (req, res) => {
    if (!isAuthorizedBuildRequest(req)) {
      return res.status(401).json({ success: false, message: 'Build API anahtarı gerekli veya geçersiz.' });
    }

    const branch = req.params.branch || '';
    if (!/^apk-studio-build-[a-f0-9-]{36}$/.test(branch)) {
      return res.status(400).json({ success: false, message: 'Geçersiz geçici build kimliği.' });
    }

    const repository = process.env.GITHUB_BUILD_REPOSITORY || '';
    const token = process.env.GITHUB_TOKEN || '';
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token) {
      return res.status(503).json({ success: false, message: 'Cloud Build sunucu yapılandırması eksik.' });
    }

    const apiBase = `https://api.github.com/repos/${repository}`;
    const headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    const apiRequest = (endpoint: string) => fetch(`${apiBase}${endpoint}`, { headers });

    try {
      const runsResponse = await apiRequest(`/actions/workflows/build-user-project.yml/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=10`);
      if (!runsResponse.ok) {
        const detail = await runsResponse.text();
        return res.status(runsResponse.status).json({
          success: false,
          message: `GitHub derleme durumu okunamadı (HTTP ${runsResponse.status}). Token için Actions: Read izni gerekir. ${detail.slice(0, 180)}`
        });
      }

      const runsData = await runsResponse.json() as { workflow_runs?: Array<{
        id: number;
        head_branch: string;
        status: string;
        conclusion: string | null;
        html_url: string;
        run_number: number;
      }> };
      const run = (runsData.workflow_runs || []).find(item => item.head_branch === branch);

      if (!run) {
        return res.json({
          success: true,
          status: 'queued',
          message: 'GitHub Actions çalışması sıraya alınıyor. Birkaç saniye içinde tekrar kontrol edilecek.'
        });
      }

      const jobsResponse = await apiRequest(`/actions/runs/${run.id}/jobs?per_page=100`);
      const jobsData = jobsResponse.ok
        ? await jobsResponse.json() as { jobs?: Array<{ id: number; name: string; status: string; conclusion: string | null }> }
        : { jobs: [] };
      const jobs = jobsData.jobs || [];
      const timestamp = new Date().toISOString();
      const logs: Array<{ id: string; timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string; step: string }> = jobs.map((job, index) => ({
        id: `cloud-job-${job.id || index}`,
        timestamp,
        level: job.conclusion === 'failure' ? 'error' as const
          : job.conclusion === 'success' ? 'success' as const : 'info' as const,
        message: `${job.name}: ${job.status}${job.conclusion ? ` (${job.conclusion})` : ''}`,
        step: job.name
      }));

      if (run.status !== 'completed') {
        return res.json({
          success: true,
          status: run.status,
          runId: run.id,
          workflowUrl: run.html_url,
          jobs: jobs.map(job => ({ name: job.name, status: job.status, conclusion: job.conclusion })),
          logs,
          message: run.status === 'queued'
            ? 'GitHub Actions derlemeyi sıraya aldı.'
            : 'Android Gradle APK derlemesi GitHub sunucusunda çalışıyor.'
        });
      }

      if (run.conclusion !== 'success') {
        // GitHub returns a ZIP archive for job logs. Read only the last lines of failed jobs.
        for (const job of jobs.filter(item => item.conclusion === 'failure').slice(0, 2)) {
          try {
            const jobLogsResponse = await apiRequest(`/actions/jobs/${job.id}/logs`);
            if (!jobLogsResponse.ok) continue;
            const logBytes = Buffer.from(await jobLogsResponse.arrayBuffer());
            if (logBytes.length > 25 * 1024 * 1024) continue;
            const logArchive = await JSZip.loadAsync(logBytes);
            const textEntries = Object.values(logArchive.files).filter(entry => !entry.dir && entry.name.toLowerCase().endsWith('.txt'));
            for (const entry of textEntries) {
              const lines = (await entry.async('string')).split(/\\r?\\n/).filter(Boolean).slice(-60);
              for (const [index, line] of lines.entries()) {
                logs.push({
                  id: `cloud-log-${job.id}-${index}`,
                  timestamp: new Date().toISOString(),
                  level: /\\b(error|failed|exception)\\b/i.test(line) ? 'error'
                    : /\\bwarn(ing)?\\b/i.test(line) ? 'warn' : 'info',
                  message: line.slice(0, 700),
                  step: job.name
                });
              }
            }
          } catch {
            // Keep the job summary when GitHub no longer retains the detailed logs.
          }
        }

        return res.json({
          success: true,
          status: 'completed',
          conclusion: run.conclusion,
          runId: run.id,
          workflowUrl: run.html_url,
          jobs: jobs.map(job => ({ name: job.name, status: job.status, conclusion: job.conclusion })),
          logs,
          message: `Cloud Build başarısız oldu: ${run.conclusion || 'bilinmeyen sonuç'}. Günlüklerdeki ilk hata satırını kontrol edin.`
        });
      }

      const artifactsResponse = await apiRequest(`/actions/runs/${run.id}/artifacts?per_page=100`);
      if (!artifactsResponse.ok) {
        return res.status(502).json({ success: false, message: 'Derleme başarılı, ancak APK artifact listesi GitHub üzerinden okunamadı.' });
      }
      const artifactsData = await artifactsResponse.json() as { artifacts?: Array<{ id: number; name: string; expired: boolean }> };
      const artifact = (artifactsData.artifacts || []).find(item =>
        !item.expired && item.name.startsWith('apk-studio-user-')
      );

      if (!artifact) {
        return res.json({
          success: false,
          status: 'completed',
          conclusion: 'success',
          runId: run.id,
          workflowUrl: run.html_url,
          logs,
          message: 'Gradle işlemi başarılı görünüyor, ancak indirilebilir APK artifact bulunamadı.'
        });
      }

      logs.push({
        id: `cloud-artifact-${artifact.id}`,
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `APK artifact hazır: ${artifact.name}`,
        step: 'APK çıktısı'
      });

      return res.json({
        success: true,
        status: 'completed',
        conclusion: 'success',
        runId: run.id,
        workflowUrl: run.html_url,
        artifactId: artifact.id,
        artifactName: artifact.name,
        logs,
        message: 'APK derlemesi tamamlandı. APK dosyası güvenli sunucu bağlantısı üzerinden indiriliyor.'
      });
    } catch (error: any) {
      return res.status(502).json({
        success: false,
        message: error?.message || 'Cloud Build durumu kontrol edilirken hata oluştu.'
      });
    }
  });

  // Private Actions artifacts are proxied through this authenticated route; the GitHub token never reaches the browser.
  app.get('/api/build/cloud/artifact/:artifactId', async (req, res) => {
    if (!isAuthorizedBuildRequest(req)) {
      return res.status(401).json({ success: false, message: 'Build API anahtarı gerekli veya geçersiz.' });
    }

    const artifactId = req.params.artifactId || '';
    if (!/^\\d{1,18}$/.test(artifactId)) {
      return res.status(400).json({ success: false, message: 'Geçersiz APK artifact kimliği.' });
    }

    const repository = process.env.GITHUB_BUILD_REPOSITORY || '';
    const token = process.env.GITHUB_TOKEN || '';
    if (!/^[A-Za-z0-9_.-]+\\/[A-Za-z0-9_.-]+$/.test(repository) || !token) {
      return res.status(503).json({ success: false, message: 'Cloud Build sunucu yapılandırması eksik.' });
    }

    try {
      const artifactResponse = await fetch(`https://api.github.com/repos/${repository}/actions/artifacts/${artifactId}/zip`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      if (!artifactResponse.ok) {
        const detail = await artifactResponse.text();
        return res.status(artifactResponse.status).json({
          success: false,
          message: `APK artifact indirilemedi (HTTP ${artifactResponse.status}). ${detail.slice(0, 180)}`
        });
      }

      const archive = Buffer.from(await artifactResponse.arrayBuffer());
      if (archive.length < 22 || archive.length > 250 * 1024 * 1024
        || archive[0] !== 0x50 || archive[1] !== 0x4b) {
        return res.status(413).json({ success: false, message: 'GitHub artifact ZIP dosyası geçersiz veya 250 MB sınırını aşıyor.' });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="apk-studio-build-artifact.zip"');
      res.setHeader('Content-Length', String(archive.length));
      res.setHeader('Cache-Control', 'no-store');
      return res.send(archive);
    } catch (error: any) {
      return res.status(502).json({
        success: false,
        message: error?.message || 'APK artifact indirme işlemi başarısız oldu.'
      });
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

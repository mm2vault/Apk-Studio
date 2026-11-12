import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { generateFullAndroidGradleProjectZip } from '../src/services/fileService';
import { detectProjectType } from '../src/services/typeDetector';
import type { Project, ProjectFile } from '../src/types/project';

const now = Date.now();
const project: Project = {
  id: 'web-wrapper-smoke-test',
  name: 'APK Studio Smoke Test',
  description: 'Temporary CI-only HTML/CSS/JS project',
  type: 'web-to-apk',
  createdAt: now,
  updatedAt: now,
  files: [
    {
      id: 'index',
      name: 'index.html',
      path: 'index.html',
      size: 190,
      type: 'text/html',
      content: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="css/style.css"></head><body><h1>APK Studio</h1><script src="js/app.js"></script></body></html>',
      isBinary: false,
      lastModified: now
    },
    {
      id: 'css',
      name: 'style.css',
      path: 'css/style.css',
      size: 38,
      type: 'text/css',
      content: 'body { font-family: sans-serif; } h1 { color: #22d3ee; }',
      isBinary: false,
      lastModified: now
    },
    {
      id: 'js',
      name: 'app.js',
      path: 'js/app.js',
      size: 35,
      type: 'application/javascript',
      content: "document.body.dataset.smokeTest = 'passed';",
      isBinary: false,
      lastModified: now
    },
    {
      id: 'dist-index',
      name: 'index.html',
      path: 'dist/index.html',
      size: 220,
      type: 'text/html',
      content: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="../css/style.css"></head><body><h1>Built web output</h1><script src="../js/app.js"></script></body></html>',
      isBinary: false,
      lastModified: now
    }
  ],
  config: {
    name: 'APK Studio Smoke Test',
    packageId: 'com.apkstudio.smoketest',
    versionName: '1.0.0',
    versionCode: 1,
    minSdk: 24,
    targetSdk: 34,
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
  },
  cloudConfig: {
    provider: 'github-actions',
    webhookUrl: '',
    apiToken: '',
    autoDeploy: false
  }
};

const makeFile = (filePath: string): ProjectFile => ({
  id: filePath,
  name: filePath.split('/').pop() || filePath,
  path: filePath,
  size: 0,
  type: 'text/plain',
  content: '',
  isBinary: false,
  lastModified: now
});

assert.equal(detectProjectType(project.files).type, 'web-to-apk');
assert.equal(detectProjectType(project.files).entryPoint, 'dist/index.html');
assert.equal(detectProjectType([
  makeFile('app/src/main/AndroidManifest.xml'),
  makeFile('app/build.gradle'),
  makeFile('app/src/main/java/com/example/MainActivity.kt')
]).type, 'native-android');
assert.equal(detectProjectType([makeFile('main.lua')]).type, 'love2d-lua');
assert.equal(detectProjectType([makeFile('main.py')]).type, 'python-mobile');

const frameworkSource = [
  makeFile('package.json'),
  makeFile('vite.config.ts'),
  makeFile('src/main.tsx'),
  makeFile('index.html')
];
const frameworkDetection = detectProjectType(frameworkSource);
assert.equal(frameworkDetection.type, 'custom');
assert.match(frameworkDetection.recommendations.join(' '), /npm install/);
const builtFrameworkDetection = detectProjectType([...frameworkSource, makeFile('dist/index.html')]);
assert.equal(builtFrameworkDetection.type, 'web-to-apk');
assert.equal(builtFrameworkDetection.entryPoint, 'dist/index.html');

const archiveBlob = await generateFullAndroidGradleProjectZip(project);
const archive = await JSZip.loadAsync(Buffer.from(await archiveBlob.arrayBuffer()));
const requiredFiles = [
  'settings.gradle',
  'build.gradle',
  'app/build.gradle',
  'app/src/main/AndroidManifest.xml',
  'app/src/main/java/com/apkstudio/smoketest/MainActivity.java',
  'app/src/main/res/mipmap-anydpi-v21/ic_launcher.xml',
  'app/src/main/res/mipmap-anydpi-v21/ic_launcher_round.xml',
  'app/src/main/res/values/strings.xml',
  'app/src/main/assets/index.html',
  'app/src/main/assets/dist/index.html',
  'app/src/main/assets/css/style.css',
  'app/src/main/assets/js/app.js',
  '.github/workflows/build-apk.yml'
];

for (const filePath of requiredFiles) {
  assert.ok(archive.file(filePath), `Generated Android project is missing: ${filePath}`);
}

const manifestEntry = archive.file('app/src/main/AndroidManifest.xml');
const activityEntry = archive.file('app/src/main/java/com/apkstudio/smoketest/MainActivity.java');
assert.ok(manifestEntry && activityEntry);
const manifest = await manifestEntry.async('string');
const activity = await activityEntry.async('string');
assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
assert.match(activity, /file:\/\/\/android_asset\/dist\/index\.html/);

const workspace = await mkdtemp(path.join(tmpdir(), 'apk-studio-web-smoke-'));
try {
  for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue;
    const destination = path.resolve(workspace, entry.name);
    assert.ok(destination.startsWith(workspace + path.sep), 'Generated ZIP path escaped the build directory.');
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await entry.async('nodebuffer'));
  }

  execFileSync('gradle', ['assembleDebug', '--stacktrace', '--no-daemon'], {
    cwd: workspace,
    env: process.env,
    stdio: 'inherit'
  });
  await access(path.join(workspace, 'app/build/outputs/apk/debug/app-debug.apk'));
  console.log('PASS: HTML/CSS/JS project generated and built into a real debug APK.');
} finally {
  await rm(workspace, { recursive: true, force: true });
}

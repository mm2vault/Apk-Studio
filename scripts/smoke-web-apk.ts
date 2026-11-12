import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { extractZipArchive, generateFullAndroidGradleProjectZip } from '../src/services/fileService';
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

// Exercise the same ZIP importer used by the phone UI with text, extensionless and binary files.
const importFixture = new JSZip();
importFixture.file('index.html', '<!doctype html><html><body>Imported project</body></html>');
importFixture.file('.env', 'PUBLIC_FLAG=true');
importFixture.file('gradlew', '#!/bin/sh\necho wrapper\n');
importFixture.file('assets/icon.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const importFixtureBytes = await importFixture.generateAsync({ type: 'nodebuffer' });
const importFixtureArrayBuffer = importFixtureBytes.buffer.slice(
  importFixtureBytes.byteOffset,
  importFixtureBytes.byteOffset + importFixtureBytes.byteLength
) as ArrayBuffer;
const importedFiles = await extractZipArchive(new File([importFixtureArrayBuffer], 'import-fixture.zip', { type: 'application/zip' }));
assert.equal(importedFiles.length, 4);
assert.equal(importedFiles.find(file => file.path === '.env')?.isBinary, false);
assert.equal(importedFiles.find(file => file.path === 'gradlew')?.content, '#!/bin/sh\necho wrapper\n');
const importedIcon = importedFiles.find(file => file.path === 'assets/icon.png');
assert.equal(importedIcon?.isBinary, true);
assert.match(importedIcon?.content || '', /^data:image\/png;base64,/);
assert.equal(detectProjectType(importedFiles).type, 'web-to-apk');

// Native Android projects must be exported as their original Gradle structure, not wrapped in WebView.
const nativeProject: Project = {
  ...project,
  id: 'native-import-smoke-test',
  name: 'Native Import Smoke Test',
  type: 'native-android',
  files: [
    makeFile('settings.gradle'),
    { ...makeFile('build.gradle'), content: "plugins { id 'com.android.application' version '8.2.2' apply false }" },
    { ...makeFile('app/build.gradle'), content: "plugins { id 'com.android.application' }\nandroid { namespace 'com.example.nativeapp' }" },
    { ...makeFile('app/src/main/AndroidManifest.xml'), content: '<manifest xmlns:android="http://schemas.android.com/apk/res/android" />' },
    { ...makeFile('app/src/main/java/com/example/nativeapp/MainActivity.kt'), content: 'package com.example.nativeapp\nclass MainActivity' },
    { ...makeFile('gradlew'), content: '#!/bin/sh\necho existing-wrapper\n' }
  ]
};
const nativeArchiveBlob = await generateFullAndroidGradleProjectZip(nativeProject);
const nativeArchive = await JSZip.loadAsync(Buffer.from(await nativeArchiveBlob.arrayBuffer()));
assert.ok(nativeArchive.file('settings.gradle'));
assert.ok(nativeArchive.file('app/build.gradle'));
assert.ok(nativeArchive.file('app/src/main/java/com/example/nativeapp/MainActivity.kt'));
assert.ok(nativeArchive.file('gradlew'));
assert.ok(nativeArchive.file('README_APK_STUDIO.md'));
const nativeWorkflow = await nativeArchive.file('.github/workflows/build-apk.yml')?.async('string');
assert.match(nativeWorkflow || '', /project_path/);
assert.match(nativeWorkflow || '', /assemble/);
assert.equal(nativeArchive.file('app/src/main/assets/index.html'), null);

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
assert.match(activity, /https:\/\/appassets\.androidplatform\.net\/assets\/dist\/index\.html/);
assert.match(activity, /WebViewAssetLoader/);
assert.match(activity, /setAllowFileAccess\(false\)/);

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

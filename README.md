# APK Studio Mobile

Mobile-first workspace for importing project files, editing source files, exporting Android Gradle projects, and building APKs locally or with GitHub Actions.

## APK Studio Android app

The repository is configured with Capacitor to package the APK Studio web interface as a native Android application.

- Android application ID: `com.mm2vault.apkstudio`
- Display name: `APK Studio`
- Web assets are built with Vite and copied into the generated Android project by Capacitor.

### Build an APK with GitHub Actions

1. Open **Actions** in this repository.
2. Select **APK Studio - Build Android APK**.
3. Tap **Run workflow** and choose `debug`.
4. Wait for the workflow to finish successfully.
5. Open the completed run and download `apk-studio-debug-...` from **Artifacts**.

The workflow installs Node.js dependencies, builds the web app, generates the Android project with Capacitor, syncs the web assets, builds with JDK 17/Gradle, and uploads the APK artifact.

The Release variant currently creates an unsigned release APK unless Android signing secrets are configured. For normal testing, choose Debug.

## Supported project handling

- Import: ZIP archives, folders, multiple files, text files, and binary assets.
- Web projects: HTML/CSS/JavaScript projects can be packaged into an Android WebView Gradle project.
- Native Android: existing Gradle/Java/Kotlin Android projects retain their original directory structure when exported.
- Lua and Python: files can be imported and edited, but they are **not automatically converted into APKs**. They need a compatible runtime such as LÖVE for Android or Kivy/Buildozer.

## Cloud build API configuration

To trigger builds of user projects from the APK Studio server, configure these variables server-side:

- `GITHUB_REPOSITORY=owner/repository`
- `GITHUB_TOKEN=<token with Actions: write permission for that repository>`
- `GITHUB_BUILD_REF=main`
- `APK_STUDIO_BUILD_API_KEY=<long random secret entered in the APK Studio Build screen>`

The Android Gradle project must already exist in the target repository at the selected project path. Never expose the GitHub token in frontend code or commit secrets.

## Local APK builds

Local builds execute uploaded Gradle build scripts, so they are disabled by default.

To enable them on a trusted machine only, install OpenJDK 17, Gradle, Android SDK platform/build tools, accept Android SDK licenses, set `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and set `APK_STUDIO_ENABLE_LOCAL_BUILD=true`.

Never enable local builds on a public server. Gradle build scripts can execute arbitrary code.

## Development

```bash
npm install
npm run dev
```

Production frontend build:

```bash
npm run build
npm start
```

The project uses React, TypeScript, Vite, Express, Capacitor, and JSZip.

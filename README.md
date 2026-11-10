# APK Studio Mobile

Mobile-first workspace for importing project files, editing source files, exporting Android Gradle projects, and building APKs locally or with GitHub Actions.

## Supported project handling

- Import: ZIP archives, folders, multiple files, text files, and binary assets.
- Web projects: HTML/CSS/JavaScript projects can be packaged into an Android WebView Gradle project.
- Native Android: existing Gradle/Java/Kotlin Android projects retain their original directory structure when exported.
- Lua and Python: files can be imported and edited, but they are **not automatically converted into APKs**. They need a compatible runtime such as LÖVE for Android or Kivy/Buildozer.

## GitHub Actions cloud build

The repository includes `.github/workflows/build-apk.yml`.

1. Export an Android Gradle project ZIP from APK Studio.
2. Upload/extract the Android Gradle project into a GitHub repository.
3. Open **Actions → APK Studio - Build Android APK**.
4. Choose the Android project folder (use `.` for the repository root) and Debug or Release.
5. Run the workflow and download the APK from the run's **Artifacts** section.

The workflow uses JDK 17 and Gradle 8.2.1. It validates the selected folder, creates a Gradle wrapper if needed, runs the actual `assembleDebug` or `assembleRelease` task, and fails if no APK artifact is produced.

### Trigger cloud builds from the APK Studio UI

Configure these variables on the APK Studio server (server-side only):

- `GITHUB_REPOSITORY=owner/repository`
- `GITHUB_TOKEN=<token with Actions: write permission for that repository>`
- `GITHUB_BUILD_REF=main`

The backend dispatches the repository workflow using the server-held token. Do not put the token in frontend code or commit it to the repository. The Android Gradle project must already exist in the target repository at the selected `project_path`.

## Local APK builds

Local builds execute uploaded Gradle build scripts, so they are disabled by default.

To enable them on a trusted machine only:

- Install OpenJDK 17, Gradle 8.2.1, Android SDK platform/build tools, and accept Android SDK licenses.
- Set `ANDROID_HOME` or `ANDROID_SDK_ROOT`.
- Set `APK_STUDIO_ENABLE_LOCAL_BUILD=true`.
- Run the server on localhost. When this option is enabled, the server binds to `127.0.0.1` and rejects non-loopback build requests.

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

The project uses React, TypeScript, Vite, Express, and JSZip.

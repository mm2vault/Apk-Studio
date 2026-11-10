import React, { useState } from 'react';
import { 
  Download, 
  FileArchive, 
  Layers, 
  Sparkles, 
  ExternalLink, 
  CheckCircle2, 
  Cpu, 
  Code2, 
  Terminal,
  HelpCircle
} from 'lucide-react';
import { Project } from '../../types/project';
import { generateProjectZip, generateFullAndroidGradleProjectZip, triggerDownload } from '../../services/fileService';

interface ExportViewProps {
  project: Project;
}

export const ExportView: React.FC<ExportViewProps> = ({ project }) => {
  const [isExportingGradle, setIsExportingGradle] = useState(false);
  const [isExportingRaw, setIsExportingRaw] = useState(false);

  const handleDownloadGradleProject = async () => {
    setIsExportingGradle(true);
    try {
      const zipBlob = await generateFullAndroidGradleProjectZip(project);
      const filename = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_android_gradle.zip`;
      triggerDownload(zipBlob, filename);
    } catch (err: any) {
      alert(`Gradle projesi oluşturulamadı: ${err?.message}`);
    } finally {
      setIsExportingGradle(false);
    }
  };

  const handleDownloadRawZip = async () => {
    setIsExportingRaw(true);
    try {
      const zipBlob = await generateProjectZip(project);
      const filename = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_source.zip`;
      triggerDownload(zipBlob, filename);
    } catch (err: any) {
      alert(`Kaynak ZIP oluşturulamadı: ${err?.message}`);
    } finally {
      setIsExportingRaw(false);
    }
  };

  const handleDownloadWorkflowYaml = () => {
    const yaml = `name: APK Studio - Build Android APK
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
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"
      - uses: gradle/actions/setup-gradle@v6
        with:
          gradle-version: "8.2.1"
      - name: Create wrapper when missing
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
`;
    const blob = new Blob([yaml], { type: 'text/yaml' });
    triggerDownload(blob, 'build-apk.yml');
  };

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto px-4 pt-2">
      {/* Top Header */}
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <Download className="w-5 h-5 text-purple-400" />
          <span>APK & Proje Dışa Aktarma Merkezi</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Hazır Android Gradle projelerinizi indirin veya GitHub Actions bulut derleme boru hattını çalıştırın.
        </p>
      </div>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Full Android Studio Gradle Project */}
        <div className="glass-panel p-5 rounded-2xl border border-purple-500/30 flex flex-col justify-between glow-purple space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Cpu className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                Tam Proje (Önerilen)
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">
                Android Studio & Gradle Projesi (.ZIP)
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Tüm kaynak dosyalarınız, otomatik üretilen <code className="text-cyan-300">AndroidManifest.xml</code>, <code className="text-cyan-300">build.gradle</code>, <code className="text-purple-300">MainActivity.java</code> ve GitHub Actions iş akışını içeren eksiksiz Android projesi.
              </p>
            </div>

            <div className="text-[11px] font-mono text-slate-400 space-y-1 bg-[#0a0b12] p-3 rounded-xl border border-white/5">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Android Studio ile doğrudan açılabilir</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>./gradlew assembleRelease komutuyla derlenebilir</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tüm izinler ve paket kimliği yapılandırılmıştır</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownloadGradleProject}
            disabled={isExportingGradle}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/40 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingGradle ? 'Oluşturuluyor...' : 'Android Gradle Projesini İndir (.ZIP)'}</span>
          </button>
        </div>

        {/* Card 2: Pure Source Files ZIP */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
                <FileArchive className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Kaynak Arşivi
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">
                Saf Kaynak Dosyaları (.ZIP)
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Yalnızca projenizde oluşturduğunuz veya yüklediğiniz HTML, CSS, JavaScript, Lua veya Python dosyalarını ve <code className="text-slate-400">.apkstudio-meta.json</code> meta verisini içerir.
              </p>
            </div>

            <div className="text-[11px] font-mono text-slate-400 space-y-1 bg-[#0a0b12] p-3 rounded-xl border border-white/5">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span>Toplam Dosya Sayısı:</span>
                <span className="text-white font-bold">{project.files.length} dosya</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span>Başlangıç Türü:</span>
                <span className="text-cyan-400">{project.type}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadRawZip}
              disabled={isExportingRaw}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Kaynak Dosyalarını İndir (.ZIP)</span>
            </button>

            <button
              onClick={handleDownloadWorkflowYaml}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
              title="GitHub Actions YAML dosyasını indir"
            >
              <Code2 className="w-4 h-4 text-purple-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Step-by-Step Compilation Guide */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>İndirilen Projeyi APK Olarak Derleme Kılavuzu</span>
        </h3>

        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-[#090b12] border border-white/5 space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 text-[11px] font-mono flex items-center justify-center">1</span>
              <span>Yöntem A: Bilgisayarınızda Terminalden Derleme (En Hızlı)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              İndirdiğiniz Gradle ZIP arşivini bir klasöre çıkartın ve terminali açıp şu komutu çalıştırın:
            </p>
            <pre className="p-2.5 rounded-lg bg-black/60 font-mono text-[11px] text-cyan-300 select-all overflow-x-auto">
              ./gradlew assembleRelease
            </pre>
            <p className="text-slate-500 text-[10px]">
              Oluşan APK konumu: <code className="text-slate-400">app/build/outputs/apk/release/app-release-unsigned.apk</code>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#090b12] border border-white/5 space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-600/30 text-cyan-300 text-[11px] font-mono flex items-center justify-center">2</span>
              <span>Yöntem B: GitHub Actions ile Ücretsiz Bulutta Derleme</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              İndirdiğiniz projenin içindeki <code className="text-purple-300">.github/workflows/build-apk.yml</code> dosyasını GitHub deponuza yükleyin. Actions sekmesinden iş akışını seçin, proje klasörünü ve Debug/Release türünü belirleyip <strong>Run workflow</strong> düğmesine basın. APK tamamlandığında çalışmanın Artifacts bölümünden indirilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

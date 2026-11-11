import React, { useState, useRef } from 'react';
import { 
  FolderPlus, 
  FilePlus, 
  Upload, 
  FolderUp, 
  FileArchive, 
  Trash2, 
  Edit3, 
  Code, 
  Eye, 
  FileText, 
  FileCode, 
  Image as ImageIcon, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Search,
  Download,
  AlertTriangle,
  Sparkles,
  Layers
} from 'lucide-react';
import { Project, ProjectFile } from '../../types/project';
import { formatFileSize, detectProjectType } from '../../services/typeDetector';
import { readBrowserFile, extractZipArchive, triggerDownload } from '../../services/fileService';

interface FileManagerViewProps {
  project: Project;
  onUpdateProject: (updated: Project) => void;
  onOpenFileInEditor: (fileId: string) => void;
  setActiveTab: (tab: string) => void;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  project,
  onUpdateProject,
  onOpenFileInEditor,
  setActiveTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(project.files[0]?.id || null);
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renamingFile, setRenamingFile] = useState<ProjectFile | null>(null);
  const [renamedName, setRenamedName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const detection = detectProjectType(project.files);

  // File Icon helper
  const getFileIcon = (fileName: string, isBinary: boolean) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (isBinary || ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'ico'].includes(ext || '')) {
      return <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (['html', 'htm'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
    }
    if (['css'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    if (['js', 'mjs', 'ts', 'tsx'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
    }
    if (['json'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-amber-300 shrink-0" />;
    }
    if (['lua'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    }
    if (['py'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    if (['xml', 'gradle', 'java', 'kt'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-purple-400 shrink-0" />;
    }
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  // Build tree from files
  interface TreeNode {
    name: string;
    path: string;
    isDir: boolean;
    file?: ProjectFile;
    children: Record<string, TreeNode>;
  }

  const fileTree: Record<string, TreeNode> = {};

  project.files.forEach(file => {
    if (searchQuery && !file.path.toLowerCase().includes(searchQuery.toLowerCase())) {
      return;
    }
    const parts = file.path.split('/');
    let current = fileTree;
    let accumulatedPath = '';

    parts.forEach((part, idx) => {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = idx === parts.length - 1;

      if (!current[part]) {
        current[part] = {
          name: part,
          path: accumulatedPath,
          isDir: !isLast,
          file: isLast ? file : undefined,
          children: {}
        };
      }
      current = current[part].children;
    });
  });

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: prev[folderPath] === undefined ? true : !prev[folderPath]
    }));
  };

  // Handle Multi-file upload
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    try {
      const addedFiles: ProjectFile[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const item = fileList[i];
        const projFile = await readBrowserFile(item);
        addedFiles.push(projFile);
      }

      // Merge: replace existing file with same path or append
      const existingPaths = new Set(addedFiles.map(f => f.path));
      const remaining = project.files.filter(f => !existingPaths.has(f.path));
      const updatedFiles = [...remaining, ...addedFiles];

      onUpdateProject({
        ...project,
        files: updatedFiles,
        type: detectProjectType(updatedFiles).type,
        updatedAt: Date.now()
      });
    } catch (err: any) {
      alert(`Dosya yükleme hatası: ${err?.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Handle Folder Upload
  const handleFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    try {
      const addedFiles: ProjectFile[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const item = fileList[i];
        const projFile = await readBrowserFile(item);
        addedFiles.push(projFile);
      }

      const existingPaths = new Set(addedFiles.map(f => f.path));
      const remaining = project.files.filter(f => !existingPaths.has(f.path));
      const updatedFiles = [...remaining, ...addedFiles];

      onUpdateProject({
        ...project,
        files: updatedFiles,
        type: detectProjectType(updatedFiles).type,
        updatedAt: Date.now()
      });
    } catch (err: any) {
      alert(`Klasör yükleme hatası: ${err?.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Handle ZIP import into active project
  const handleZipSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const extracted = await extractZipArchive(file);
      const existingPaths = new Set(extracted.map(f => f.path));
      const remaining = project.files.filter(f => !existingPaths.has(f.path));

      const updatedFiles = [...remaining, ...extracted];
      onUpdateProject({
        ...project,
        files: updatedFiles,
        type: detectProjectType(updatedFiles).type,
        updatedAt: Date.now()
      });
    } catch (err: any) {
      alert(`ZIP çıkarma hatası: ${err?.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Create new file
  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const path = newFileName.trim().replace(/^[\\/]/, '');
    if (project.files.some(f => f.path === path)) {
      alert('Bu dosya yolu zaten mevcut!');
      return;
    }

    const newFile: ProjectFile = {
      id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: path.split('/').pop() || path,
      path,
      size: 0,
      type: 'text/plain',
      content: '',
      isBinary: false,
      lastModified: Date.now()
    };

    const updatedFiles = [...project.files, newFile];
    onUpdateProject({
      ...project,
      files: updatedFiles,
      type: detectProjectType(updatedFiles).type,
      updatedAt: Date.now()
    });

    setIsNewFileModalOpen(false);
    setNewFileName('');
    onOpenFileInEditor(newFile.id);
  };

  // Delete file
  const handleDeleteFile = (fileId: string) => {
    const fileToDelete = project.files.find(f => f.id === fileId);
    if (!fileToDelete) return;
    if (!confirm(`"${fileToDelete.path}" dosyasını silmek istediğinize emin misiniz?`)) return;

    const updated = project.files.filter(f => f.id !== fileId);
    onUpdateProject({
      ...project,
      files: updated,
      type: detectProjectType(updated).type,
      updatedAt: Date.now()
    });

    if (selectedFileId === fileId) {
      setSelectedFileId(updated[0]?.id || null);
    }
    if (previewFile?.id === fileId) {
      setPreviewFile(null);
    }
  };

  // Rename file
  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFile || !renamedName.trim()) return;

    const newPath = renamedName.trim().replace(/^[\\/]/, '');
    const updated = project.files.map(f => {
      if (f.id === renamingFile.id) {
        return {
          ...f,
          name: newPath.split('/').pop() || newPath,
          path: newPath,
          lastModified: Date.now()
        };
      }
      return f;
    });

    onUpdateProject({
      ...project,
      files: updated,
      type: detectProjectType(updated).type,
      updatedAt: Date.now()
    });

    setIsRenameModalOpen(false);
    setRenamingFile(null);
  };

  // Download single file
  const handleDownloadSingleFile = (file: ProjectFile) => {
    if (file.isBinary) {
      // Decode base64
      const parts = file.content.split(',');
      const base64 = parts.length > 1 ? parts[1] : parts[0];
      const byteChars = atob(base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNums);
      const blob = new Blob([byteArray], { type: file.type });
      triggerDownload(blob, file.name);
    } else {
      const blob = new Blob([file.content], { type: file.type || 'text/plain' });
      triggerDownload(blob, file.name);
    }
  };

  // Recursive Tree Node Renderer
  const renderTree = (nodes: Record<string, TreeNode>, depth = 0) => {
    const keys = Object.keys(nodes).sort((a, b) => {
      if (nodes[a].isDir && !nodes[b].isDir) return -1;
      if (!nodes[a].isDir && nodes[b].isDir) return 1;
      return a.localeCompare(b);
    });

    return keys.map(key => {
      const node = nodes[key];
      const isExpanded = expandedFolders[node.path] !== false; // Default expanded

      if (node.isDir) {
        return (
          <div key={node.path} className="select-none">
            <div
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              className="flex items-center gap-1.5 py-1.5 px-2 text-xs font-mono font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
              <span className="text-amber-400">📁</span>
              <span className="truncate">{node.name}</span>
            </div>
            {isExpanded && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      const file = node.file!;
      const isSelected = selectedFileId === file.id;

      return (
        <div
          key={file.id}
          onClick={() => setSelectedFileId(file.id)}
          style={{ paddingLeft: `${depth * 14 + 16}px` }}
          className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-mono cursor-pointer transition-all group ${
            isSelected
              ? 'bg-purple-600/20 text-purple-200 border border-purple-500/30'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {getFileIcon(file.name, file.isBinary)}
            <span className="truncate">{file.name}</span>
          </div>

          <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFileInEditor(file.id);
                setActiveTab('editor');
              }}
              title="Editörde Aç"
              className="p-1 rounded hover:bg-white/10 text-cyan-400 hover:text-cyan-300"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewFile(file);
              }}
              title="Önizle"
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenamingFile(file);
                setRenamedName(file.path);
                setIsRenameModalOpen(true);
              }}
              title="Yeniden Adlandır"
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(file.id);
              }}
              title="Sil"
              className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    });
  };

  const selectedFile = project.files.find(f => f.id === selectedFileId);

  return (
    <div className="page-shell space-y-4 max-w-7xl mx-auto w-full px-4 pt-4">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        onChange={handleFolderSelected}
        className="hidden"
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleZipSelected}
        className="hidden"
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#10121d] p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsNewFileModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Yeni Dosya</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Dosya Yükle</span>
          </button>

          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 transition-colors"
          >
            <FolderUp className="w-3.5 h-3.5 text-yellow-400" />
            <span className="hidden sm:inline">Klasör Yükle</span>
            <span className="sm:hidden">Klasör</span>
          </button>

          <button
            onClick={() => zipInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 transition-colors"
          >
            <FileArchive className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">ZIP Çıkar & Ekle</span>
            <span className="sm:hidden">ZIP</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Dosyalarda ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161826] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
          />
        </div>
      </div>

      {/* Project Type Analysis Bar */}
      <div className="glass-panel p-3.5 rounded-xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Algılanan Mimari:</span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md ${detection.badgeColor}`}>
                {detection.title}
              </span>
            </div>
            {detection.entryPoint && (
              <span className="text-[11px] text-slate-400 font-mono">
                Başlangıç Noktası: <code className="text-cyan-400">{detection.entryPoint}</code>
              </span>
            )}
          </div>
        </div>

        {detection.recommendations.length > 0 && (
          <div className="text-[11px] text-amber-300/90 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>{detection.recommendations[0]}</span>
          </div>
        )}
      </div>

      {/* Main 2-Column Split: Tree & Inspector / Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* File Tree Column */}
        <div className="lg:col-span-5 glass-panel rounded-2xl border border-white/10 p-3 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-white/5 text-xs text-slate-400 font-medium">
            <span>PROJE DOSYALARI ({project.files.length})</span>
            <span className="font-mono tabular-nums">
              {formatFileSize(project.files.reduce((a, f) => a + f.size, 0))}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 max-h-[500px]">
            {project.files.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Bu projede henüz dosya yok. Yukarıdaki butonlarla dosya veya ZIP yükleyebilirsiniz.
              </div>
            ) : (
              renderTree(fileTree)
            )}
          </div>
        </div>

        {/* Selected File Details / Preview Column */}
        <div className="lg:col-span-7 glass-panel rounded-2xl border border-white/10 p-4 flex flex-col justify-between">
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5 truncate">
                  {getFileIcon(selectedFile.name, selectedFile.isBinary)}
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono truncate">
                      {selectedFile.path}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {formatFileSize(selectedFile.size)} · {selectedFile.type}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadSingleFile(selectedFile)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-colors"
                    title="İndir"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">İndir</span>
                  </button>
                  {!selectedFile.isBinary && (
                    <button
                      onClick={() => {
                        onOpenFileInEditor(selectedFile.id);
                        setActiveTab('editor');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Editörde Düzenle</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Preview Area */}
              <div className="bg-[#0a0b12] rounded-xl border border-white/5 p-3 overflow-hidden">
                <div className="text-[10px] uppercase font-mono font-semibold text-slate-500 mb-2">
                  Hızlı Önizleme
                </div>
                {selectedFile.isBinary ? (
                  <div className="flex items-center justify-center p-8 bg-black/40 rounded-lg">
                    {selectedFile.type.startsWith('image/') ? (
                      <img
                        src={selectedFile.content}
                        alt={selectedFile.name}
                        className="max-h-48 max-w-full object-contain rounded"
                      />
                    ) : (
                      <div className="text-center text-xs text-slate-400">
                        İkili (Binary) Dosya · {selectedFile.type}
                      </div>
                    )}
                  </div>
                ) : (
                  <pre className="text-xs font-mono text-slate-300 overflow-x-auto max-h-[340px] whitespace-pre p-2 bg-[#06070a] rounded-lg leading-relaxed">
                    {selectedFile.content.slice(0, 3000)}
                    {selectedFile.content.length > 3000 && '\n\n... (Dosyanın geri kalanı için editörü açın)'}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-slate-500 text-xs">
              Detayları ve önizlemeyi görmek için soldaki ağaçtan bir dosya seçin.
            </div>
          )}
        </div>
      </div>

      {/* New File Modal */}
      {isNewFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-white/15 p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Yeni Dosya Oluştur</h3>
            <form onSubmit={handleCreateFile} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Dosya Yolu (Klasörlerle birlikte)
                </label>
                <input
                  type="text"
                  required
                  placeholder="örn: js/utils.js, res/layout.xml"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFileModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-md active:scale-95"
                >
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {isRenameModalOpen && renamingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-white/15 p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Dosyayı Yeniden Adlandır</h3>
            <form onSubmit={handleRenameSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Yeni Dosya Yolu
                </label>
                <input
                  type="text"
                  required
                  value={renamedName}
                  onChange={(e) => setRenamedName(e.target.value)}
                  className="w-full bg-[#12141f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-md active:scale-95"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

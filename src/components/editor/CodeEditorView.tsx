import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  Search, 
  X, 
  FileCode, 
  Check, 
  Copy, 
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { PageContainer, EmptyState } from '../ui/Page';
import { Project, ProjectFile } from '../../types/project';
import { formatFileSize } from '../../services/typeDetector';

interface CodeEditorViewProps {
  project: Project;
  onUpdateFileContent: (fileId: string, newContent: string) => void;
  activeFileId: string | null;
  setActiveFileId: (fileId: string) => void;
}

export const CodeEditorView: React.FC<CodeEditorViewProps> = ({
  project,
  onUpdateFileContent,
  activeFileId,
  setActiveFileId
}) => {
  // Filter only text files
  const textFiles = project.files.filter(f => !f.isBinary);
  const currentFile = textFiles.find(f => f.id === activeFileId) || textFiles[0] || null;

  const [editorContent, setEditorContent] = useState(currentFile ? currentFile.content : '');
  const [isDirty, setIsDirty] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync content when active file changes
  useEffect(() => {
    if (currentFile) {
      setEditorContent(currentFile.content);
      setIsDirty(false);
    }
  }, [currentFile?.id]);

  // Handle Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, editorContent]);

  const handleSave = () => {
    if (!currentFile) return;
    onUpdateFileContent(currentFile.id, editorContent);
    setIsDirty(false);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2000);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorContent(e.target.value);
    setIsDirty(true);
  };

  // Cursor position tracking
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const textBefore = target.value.substring(0, target.selectionStart);
    const lines = textBefore.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1
    });
  };

  // Insert symbol helper for mobile virtual keyboards
  const insertSymbol = (sym: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = editorContent;
    const updated = current.substring(0, start) + sym + current.substring(end);
    setEditorContent(updated);
    setIsDirty(true);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + sym.length, start + sym.length);
    }, 0);
  };

  // Search & Replace
  const handleReplaceAll = () => {
    if (!searchTerm) return;
    const updated = editorContent.replaceAll(searchTerm, replaceTerm);
    setEditorContent(updated);
    setIsDirty(true);
  };

  // Quick Mobile symbols
  const mobileSymbols = ['{', '}', '(', ')', '[', ']', '<', '>', '/', '=', '"', "'", ';', ':', '$', '.', '_', '-', '+', '\t'];

  const lines = editorContent.split('\n');
  const lineCount = lines.length;

  if (textFiles.length === 0) {
    return (
      <PageContainer width="xl">
        <EmptyState
          icon={<FileCode className="w-12 h-12" />}
          title="Düzenlenebilir Metin Dosyası Bulunamadı"
          description="Dosya Yöneticisi sekmesinden yeni bir dosya (.html, .js, .lua, .py) oluşturabilir veya yükleyebilirsiniz."
        />
      </PageContainer>
    );
  }

  return (
    <div className={isFullscreen
      ? 'fixed inset-0 z-50 bg-[#08090d] p-3 h-dvh overflow-y-auto space-y-2'
      : 'page-shell space-y-2 max-w-7xl mx-auto w-full px-2 sm:px-4 pt-2'}>
      {/* File Tabs Strip */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {textFiles.map((file) => {
            const isActive = currentFile?.id === file.id;
            return (
              <button
                key={file.id}
                onClick={() => {
                  if (isDirty) {
                    if (confirm('Kaydedilmemiş değişiklikler var. Dosyayı değiştirmek istiyor musunuz?')) {
                      setActiveFileId(file.id);
                    }
                  } else {
                    setActiveFileId(file.id);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-purple-600/20 text-purple-200 border-purple-500/40 shadow-sm'
                    : 'bg-[#12141f] text-slate-400 border-white/5 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span className="truncate max-w-[120px] sm:max-w-[180px]">{file.name}</span>
                {isActive && isDirty && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Kaydedilmedi" />
                )}
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              showSearch ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
            title="Bul ve Değiştir"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-xs transition-colors"
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 ${
              isDirty
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-900/40'
                : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Kaydet</span>
          </button>
        </div>
      </div>

      {/* Search & Replace Bar */}
      {showSearch && (
        <div className="glass-panel p-2.5 rounded-xl border border-white/10 flex flex-wrap items-center gap-2 animate-in fade-in duration-150">
          <input
            type="text"
            placeholder="Aranacak metin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[140px] bg-[#0c0d14] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
          />
          <input
            type="text"
            placeholder="Yeni değer..."
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            className="flex-1 min-w-[140px] bg-[#0c0d14] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleReplaceAll}
            className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium font-mono"
          >
            Tümünü Değiştir
          </button>
          <button
            onClick={() => setShowSearch(false)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor Body */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden flex flex-col shadow-2xl">
        {/* Editor Main Container */}
        <div className="relative flex flex-1 min-h-[460px] sm:min-h-[520px] bg-[#08090f]">
          {/* Line Numbers Gutter */}
          <div className="w-10 sm:w-12 bg-[#06070b] select-none text-right pr-2 pt-3 font-mono text-[11px] text-slate-600 border-r border-white/5 shrink-0 overflow-hidden leading-relaxed">
            {Array.from({ length: Math.min(lineCount, 500) }, (_, i) => (
              <div key={i + 1} className="h-5">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Textarea Area */}
          <textarea
            ref={textareaRef}
            value={editorContent}
            onChange={handleContentChange}
            onSelect={handleSelect}
            onKeyUp={handleSelect}
            onClick={handleSelect}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="w-full h-full min-h-[460px] sm:min-h-[520px] bg-transparent text-slate-100 font-mono text-xs sm:text-[13px] leading-relaxed p-3 focus:outline-none resize-none overflow-y-auto whitespace-pre selection:bg-purple-600 selection:text-white"
            placeholder="Kodunuzu buraya yazın..."
          />
        </div>

        {/* Mobile Quick Symbols Toolbar */}
        <div className="bg-[#0e101a] border-t border-white/10 px-2 py-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <span className="text-[10px] uppercase font-mono text-slate-500 px-1 hidden sm:inline">
            Hızlı Semboller:
          </span>
          {mobileSymbols.map((sym, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => insertSymbol(sym === '\t' ? '  ' : sym)}
              className="min-w-[40px] h-10 px-2 rounded-md bg-[#161928] hover:bg-purple-600/30 text-purple-300 font-mono text-sm font-semibold flex items-center justify-center border border-white/5 active:scale-90 transition-all shrink-0"
            >
              {sym === '\t' ? 'Tab' : sym}
            </button>
          ))}
        </div>

        {/* Editor Footer Status Bar */}
        <div className="bg-[#06070c] border-t border-white/5 px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span className="text-slate-300 truncate max-w-[160px] sm:max-w-xs">
              {currentFile?.path}
            </span>
            <span>·</span>
            <span className="tabular-nums">Satır {cursorPos.line}, Sütun {cursorPos.col}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="tabular-nums">{lineCount} satır</span>
            <span>·</span>
            <span className="tabular-nums">{formatFileSize(editorContent.length)}</span>
            {isDirty && (
              <span className="text-amber-400 font-medium">Değiştirildi (Kaydedilmedi)</span>
            )}
            {showSavedToast && (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" /> Kaydedildi!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

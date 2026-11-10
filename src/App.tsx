import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import { Project } from './types/project';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { FileManagerView } from './components/fileManager/FileManagerView';
import { CodeEditorView } from './components/editor/CodeEditorView';
import { AppConfigView } from './components/config/AppConfigView';
import { BuildView } from './components/build/BuildView';
import { ExportView } from './components/export/ExportView';
import { UpdateView } from './components/updates/UpdateView';

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => StorageService.getProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => StorageService.getActiveProjectId());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0] || null;

  useEffect(() => {
    if (currentProject && currentProject.files.length > 0) {
      if (!activeFileId || !currentProject.files.some(f => f.id === activeFileId)) {
        const firstTextFile = currentProject.files.find(f => !f.isBinary);
        setActiveFileId(firstTextFile?.id || currentProject.files[0].id);
      }
    }
  }, [currentProject?.id]);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    StorageService.setActiveProjectId(id);
  };

  const handleCreateProject = (newProject: Project) => {
    const updated = [newProject, ...projects];
    setProjects(updated);
    StorageService.saveProjects(updated);
    handleSelectProject(newProject.id);
  };

  const handleUpdateProject = (updatedProj: Project) => {
    const updatedList = projects.map(p => p.id === updatedProj.id ? updatedProj : p);
    setProjects(updatedList);
    StorageService.saveProjects(updatedList);
  };

  const handleDeleteProject = (id: string) => {
    StorageService.deleteProject(id);
    const updatedList = projects.filter(p => p.id !== id);
    setProjects(updatedList);
    if (activeProjectId === id) {
      const nextId = updatedList[0]?.id || null;
      setActiveProjectId(nextId);
      StorageService.setActiveProjectId(nextId);
    }
  };

  const handleUpdateFileContent = (fileId: string, newContent: string) => {
    if (!currentProject) return;
    const updatedFiles = currentProject.files.map(f => f.id === fileId
      ? { ...f, content: newContent, size: newContent.length, lastModified: Date.now() }
      : f
    );
    handleUpdateProject({ ...currentProject, files: updatedFiles, updatedAt: Date.now() });
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentProject={currentProject}
        projects={projects}
        onSelectProject={handleSelectProject}
        onCreateProjectClick={() => setIsCreateModalOpen(true)}
      />
      <main className="flex-1 pb-16 md:pb-0">
        {activeTab === 'dashboard' && (
          <DashboardView
            projects={projects}
            currentProject={currentProject}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            setActiveTab={setActiveTab}
            isCreateModalOpen={isCreateModalOpen}
            setIsCreateModalOpen={setIsCreateModalOpen}
          />
        )}
        {activeTab === 'files' && currentProject && (
          <FileManagerView project={currentProject} onUpdateProject={handleUpdateProject}
            onOpenFileInEditor={(fileId) => { setActiveFileId(fileId); setActiveTab('editor'); }}
            setActiveTab={setActiveTab} />
        )}
        {activeTab === 'editor' && currentProject && (
          <CodeEditorView project={currentProject} onUpdateFileContent={handleUpdateFileContent}
            activeFileId={activeFileId} setActiveFileId={setActiveFileId} />
        )}
        {activeTab === 'config' && currentProject && (
          <AppConfigView project={currentProject} onUpdateProject={handleUpdateProject} />
        )}
        {activeTab === 'build' && currentProject && (
          <BuildView project={currentProject} onUpdateProject={handleUpdateProject} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'export' && currentProject && <ExportView project={currentProject} />}
        {activeTab === 'updates' && <UpdateView />}
      </main>
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}


import React, { useState, useMemo, useRef } from 'react';
import { Project } from '../types';
import { TrashIcon, ArrowUpIcon, ArrowDownIcon, UploadIcon, FolderIcon } from './icons';

interface ProjectManagerProps {
  projects: Project[];
  onLoad: (id: number) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  onImportProject: (file: File) => void;
  onOpenFile?: () => Promise<void>;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ projects, onLoad, onDelete, onClose, onImportProject, onOpenFile }) => {
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent load from triggering
    if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      onDelete(id);
    }
  };
  
  const handleImportClick = async () => {
      // Use File System Access API if available
      if (onOpenFile && window.showOpenFilePicker) {
          try {
            await onOpenFile();
          } catch (err) {
            // Check if it's a user abort, otherwise fallback (e.g. Cross origin sub frames)
            if ((err as Error).name !== 'AbortError') {
                 console.warn("FS API Open failed, using fallback input", err);
                 importInputRef.current?.click();
            }
          }
      } else {
          // Fallback to classic file input
          importInputRef.current?.click();
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportProject(file);
    }
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const dateA = new Date(a[sortBy]).getTime();
      const dateB = new Date(b[sortBy]).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - a[sortBy] > b[sortBy] ? 1 : -1;
    });
  }, [projects, sortBy, sortOrder]);

  const SortButton: React.FC<{
    label: string;
    field: 'updatedAt' | 'createdAt';
  }> = ({ label, field }) => {
    const isActive = sortBy === field;
    return (
      <button
        onClick={() => setSortBy(field)}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full max-w-2xl rounded-xl shadow-2xl shadow-accent/20 border border-border-color p-6 flex flex-col gap-4 max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-4 border-b border-border-color">
            <div className="flex items-center gap-4">
                 <h2 className="text-2xl font-display font-bold">My Projects</h2>
                 <button 
                    onClick={handleImportClick}
                    className="flex items-center gap-2 px-3 py-1.5 bg-bg-secondary hover:bg-surface border border-border-color text-text-secondary font-semibold rounded-lg text-sm transition-colors"
                >
                    {onOpenFile && window.showOpenFilePicker ? <FolderIcon className="w-4 h-4" /> : <UploadIcon className="w-4 h-4" />}
                    <span>{onOpenFile && window.showOpenFilePicker ? 'Open File...' : 'Import Project'}</span>
                 </button>
                 <input type="file" ref={importInputRef} onChange={handleFileSelect} className="hidden" accept=".filmset,application/json" />
            </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-3xl">&times;</button>
        </div>

        <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-text-secondary">Sort by:</span>
            <div className="flex items-center gap-2">
                <div className="bg-bg-secondary rounded-lg p-1 flex border border-border-color">
                    <SortButton label="Last Updated" field="updatedAt" />
                    <SortButton label="Date Created" field="createdAt" />
                </div>
                <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-bg-secondary rounded-lg border border-border-color text-text-secondary hover:bg-surface hover:text-accent"
                    aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                    {sortOrder === 'asc' ? <ArrowUpIcon className="w-5 h-5" /> : <ArrowDownIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>
        
        <div className="overflow-y-auto pr-2 -mr-2 flex-grow">
            {sortedProjects.length > 0 ? (
                <ul className="space-y-3">
                    {sortedProjects.map(p => (
                        <li 
                            key={p.id} 
                            onClick={() => onLoad(p.id!)}
                            className="relative group flex justify-between items-center p-4 bg-bg-secondary rounded-lg cursor-pointer transition-all duration-200 border border-border-color hover:border-accent hover:shadow-accent-glow"
                        >
                            <div>
                                <p className="font-semibold text-lg">{p.name}</p>
                                <p className="text-sm text-text-secondary">
                                    {sortBy === 'updatedAt' ? 'Updated' : 'Created'}: {new Date(p[sortBy]).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={(e) => handleDelete(e, p.id!)}
                                className="p-2 rounded-full text-text-secondary hover:bg-red-900/50 hover:text-red-300 transition-colors z-10"
                                aria-label={`Delete project ${p.name}`}
                            >
                                <TrashIcon className="w-5 h-5"/>
                            </button>

                            {p.stage1Result?.logline && (
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-md p-3 text-sm bg-bg-primary text-text-primary rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-border-color">
                                    <p className="font-bold text-accent mb-1">Logline:</p>
                                    <p className="italic">{p.stage1Result.logline}</p>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-center py-10 text-text-secondary flex flex-col items-center justify-center h-full">
                    <p>No saved projects yet.</p>
                    <p>Complete an analysis and click "Save" to get started.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProjectManager;

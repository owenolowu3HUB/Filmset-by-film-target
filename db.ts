import { Project } from './types';

const DB_NAME = 'ScriptSentinelDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let db: IDBDatabase | null = null;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(true);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', request.error);
      reject(false);
    };

    request.onsuccess = (event) => {
      db = request.result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('name', 'name', { unique: false });
        objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
};

export const saveProject = (project: Project): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(project);

    request.onsuccess = () => {
      resolve(request.result as number);
    };

    request.onerror = () => {
      console.error('Save project error:', request.error);
      reject(request.error);
    };
  });
};

export const getProject = (id: number): Promise<Project | undefined> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result as Project);
    };

    request.onerror = () => {
      console.error('Get project error:', request.error);
      reject(request.error);
    };
  });
};

export const getAllProjects = (): Promise<Project[]> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as Project[]);
    };

    request.onerror = () => {
      console.error('Get all projects error:', request.error);
      reject(request.error);
    };
  });
};

export const deleteProject = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Delete project error:', request.error);
            reject(request.error);
        };
    });
};
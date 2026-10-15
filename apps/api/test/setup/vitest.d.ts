declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    uploadsDir: string;
  }
}

export {};

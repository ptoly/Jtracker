import type { Application, NewApplication } from '../types/application';

/** Persistence boundary. Async so a remote backend can implement it later. */
export interface StorageAdapter {
  list(): Promise<Application[]>;
  add(input: NewApplication): Promise<Application>;
  update(id: string, patch: Partial<NewApplication>): Promise<Application>;
  remove(id: string): Promise<void>;
}

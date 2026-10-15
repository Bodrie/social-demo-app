import { Injectable } from '@nestjs/common';
import type { UserSummary } from '@the-mesh/shared';

type Entry = { user: UserSummary; sockets: Set<string> };

/**
 * Who is online, deduplicated per user (several tabs = one entry).
 * In-memory: valid for a single API instance. A Redis-backed adapter would
 * replace this if the API ever runs more than one replica.
 */
@Injectable()
export class PresenceService {
  private readonly online = new Map<string, Entry>();

  /** Returns true when the user just came online. */
  add(user: UserSummary, socketId: string): boolean {
    const entry = this.online.get(user.id);
    if (entry) {
      entry.user = user;
      entry.sockets.add(socketId);
      return false;
    }
    this.online.set(user.id, { user, sockets: new Set([socketId]) });
    return true;
  }

  /** Returns true when the user just went offline (last socket closed). */
  remove(userId: string, socketId: string): boolean {
    const entry = this.online.get(userId);
    if (!entry) return false;
    entry.sockets.delete(socketId);
    if (entry.sockets.size > 0) return false;
    this.online.delete(userId);
    return true;
  }

  /** Refreshes the cached profile of an online user (name/avatar changed). */
  refresh(user: UserSummary): boolean {
    const entry = this.online.get(user.id);
    if (!entry) return false;
    entry.user = user;
    return true;
  }

  socketCount(userId: string): number {
    return this.online.get(userId)?.sockets.size ?? 0;
  }

  list(): UserSummary[] {
    return [...this.online.values()].map((entry) => entry.user);
  }
}

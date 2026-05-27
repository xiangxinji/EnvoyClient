import type { MessageAttachment } from "../types";

// ─── Service Config ──────────────────────────────────────────

export interface ServiceConfig {
  readonly myId: string;
  readonly teamName: string;
}

// ─── Message Types ───────────────────────────────────────────

export interface SendOptions {
  readonly attachments?: readonly MessageAttachment[];
  readonly source?: "human" | "ai-auto";
  readonly forwarded?: readonly import("../types").ForwardedRecord[];
  readonly quote?: import("../types").QuoteInfo;
  readonly sticker?: import("../types").StickerInfo;
  readonly channel?: string;
  readonly mentions?: readonly string[];
  readonly cloudRefs?: readonly import("../types").CloudRef[];
}

export interface SendResult {
  readonly id: string;
  readonly seq: number;
}

// ─── Task Types ──────────────────────────────────────────────

export interface TaskSubmitResult {
  readonly from: string;
  readonly success: boolean;
  readonly data?: Record<string, unknown>;
  readonly error?: string;
  readonly trace?: unknown[];
}

// ─── Cloud Types ─────────────────────────────────────────────

export interface CloudFileItem {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly type: "file" | "directory";
  readonly size: number;
  readonly uploadedBy: string;
  readonly createdAt: number;
}

export interface CloudDirListing {
  readonly id: string | null;
  readonly parentId: string | null;
  readonly name: string;
  readonly items: CloudFileItem[];
}

export interface CloudSearchResult {
  readonly id: string;
  readonly name: string;
  readonly displayPath: string;
  readonly type: "file" | "directory";
  readonly size: number;
}

export interface CloudStats {
  readonly totalFiles: number;
  readonly totalSize: number;
  readonly totalDirs: number;
  readonly byUser: readonly {
    readonly user: string;
    readonly fileCount: number;
    readonly totalSize: number;
  }[];
}

// ─── User Profile Types ──────────────────────────────────────

export interface UserProfile {
  readonly username: string;
  readonly nickname: string | null;
  readonly avatar_url: string | null;
  readonly responsibilities: string;
  readonly capabilities: string;
}

// ─── Sticker Types ───────────────────────────────────────────

export interface StickerItem {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly size: number;
  readonly mimeType: string;
  readonly createdAt: number;
}

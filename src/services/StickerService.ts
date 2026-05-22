import { managerFetch, managerDelete, managerUpload, managerPost, apiUrl } from "../api";
import type { ServiceConfig, StickerItem } from "./types";

export class StickerService {
  constructor(
    private readonly getConfig: () => Readonly<ServiceConfig>,
  ) {}

  async list(): Promise<StickerItem[]> {
    const { myId, teamName } = this.getConfig();
    const res = await managerFetch(`/api/stickers?user=${encodeURIComponent(myId)}`, {
      headers: { team: teamName },
    });
    const data = await res.json() as { stickers: StickerItem[] };
    return data.stickers;
  }

  async add(file: File): Promise<void> {
    const { myId, teamName } = this.getConfig();
    const form = new FormData();
    form.append("file", file);
    form.append("from", myId);
    await managerUpload("/api/stickers", form, { team: teamName });
  }

  async collect(stickerId: string): Promise<void> {
    const { myId, teamName } = this.getConfig();
    await managerPost("/api/stickers/collect", { sticker_id: stickerId, user_id: myId }, { team: teamName });
  }

  async remove(stickerId: string): Promise<void> {
    const { myId, teamName } = this.getConfig();
    await managerDelete(`/api/stickers/${stickerId}?from=${encodeURIComponent(myId)}`, { team: teamName });
  }

  stickerUrl(path: string): string {
    return apiUrl(path);
  }
}

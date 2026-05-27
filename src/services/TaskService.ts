import { managerPost, managerFetch, managerUpload, apiUrl } from "../api";
import type { ServiceConfig, TaskSubmitResult } from "./types";
import type { ApiTask } from "../utils/taskFormatters";

export class TaskService {
  constructor(
    private readonly getConfig: () => Readonly<ServiceConfig>,
  ) {}

  async dispatch(targetIds: readonly string[], content: string, mode: "serial" | "parallel" = "serial"): Promise<void> {
    const { myId, teamName } = this.getConfig();
    await managerPost("/api/tasks", {
      from: myId,
      content,
      subscribe: targetIds,
      mode,
    }, { team: teamName });
  }

  async start(taskId: string): Promise<void> {
    const { myId, teamName } = this.getConfig();
    await managerPost(`/api/tasks/${taskId}/start`, { from: myId }, { team: teamName });
  }

  async submitResult(taskId: string, result: Readonly<TaskSubmitResult>): Promise<void> {
    const { teamName } = this.getConfig();
    await managerPost(`/api/tasks/${taskId}/result`, result, { team: teamName });
  }

  async uploadResource(taskId: string, file: File): Promise<void> {
    const { myId, teamName } = this.getConfig();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("from", myId);
    await managerUpload(`/api/tasks/${taskId}/resources`, formData, { team: teamName });
  }

  async fetchDetail(taskId: string): Promise<ApiTask> {
    const { teamName } = this.getConfig();
    const res = await managerFetch(`/api/teams/${encodeURIComponent(teamName)}/tasks/${taskId}`);
    return res.json() as Promise<ApiTask>;
  }

  downloadResourceUrl(taskId: string, filename: string): string {
    return apiUrl(`/api/tasks/${taskId}/resources/${encodeURIComponent(filename)}`);
  }
}

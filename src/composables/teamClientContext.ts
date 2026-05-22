import { shallowRef } from "vue";
import type { useTeamClient } from "./useTeamClient";
import { useMemberSettings } from "./useMemberSettings";
import { MessageService } from "../services/MessageService";
import { CloudResourceService } from "../services/CloudResourceService";
import { TaskService } from "../services/TaskService";
import { UserProfileService } from "../services/UserProfileService";
import { StickerService } from "../services/StickerService";
import { SystemSettingService } from "../services/SystemSettingService";
import type { ServiceConfig } from "../services/types";
import type { useClientTaskQueue } from "./useClientTaskQueue";

export type TeamClientContext = ReturnType<typeof useTeamClient>;

const _instance = shallowRef<TeamClientContext | null>(null);
const _memberSettings = useMemberSettings();
let _clientTaskQueue: ReturnType<typeof useClientTaskQueue> | null = null;

const _serviceConfig = (): Readonly<ServiceConfig> => ({
  myId: _instance.value?.myId ?? "",
  teamName: _instance.value?.teamName ?? "",
});

const _messageService = new MessageService(_serviceConfig);
const _cloudResourceService = new CloudResourceService(_serviceConfig);
const _taskService = new TaskService(_serviceConfig);
const _userProfileService = new UserProfileService(_serviceConfig);
const _stickerService = new StickerService(_serviceConfig);
const _systemSettingService = new SystemSettingService();

export function setTeamClientInstance(ctx: TeamClientContext | null) {
  _instance.value = ctx;
}

export function getTeamClientInstance(): TeamClientContext | null {
  return _instance.value;
}

export function useTeamClientInstance() {
  return _instance;
}

export function setClientTaskQueue(q: ReturnType<typeof useClientTaskQueue> | null) {
  _clientTaskQueue = q;
}

export function getClientTaskQueue(): ReturnType<typeof useClientTaskQueue> {
  if (!_clientTaskQueue) throw new Error("ClientTaskQueue not initialized");
  return _clientTaskQueue;
}

export function getMemberSettings() {
  return _memberSettings;
}

export function getMessageService() {
  return _messageService;
}

export function getCloudResourceService() {
  return _cloudResourceService;
}

export function getTaskService() {
  return _taskService;
}

export function getUserProfileService() {
  return _userProfileService;
}

export function getStickerService() {
  return _stickerService;
}

export function getSystemSettingService() {
  return _systemSettingService;
}

import { i18n } from "../i18n";
import { watch } from "vue";
import type { MemberInfo } from "../types";
import type { Message } from "@envoy/core";
import type { Task } from "../../envoy/packages/core/task.js";
import { useConnection } from "./useConnection";
import type { ConnectionStatus, ConnectionClientOptions } from "./useConnection";
import { useMessages } from "./useMessages";
import { useTaskExecution } from "./useTaskExecution";
import { useAutoReply } from "./useAutoReply";
import { getMemberSettings, setTeamClientInstance, getTaskService, getBrainsSync } from "./teamClientContext";
import { clearCredentials } from "../api";
import { syncGlossary } from "./useGlossarySync";
import { useUserProfile } from "./useUserProfile";
import { sendDesktopNotification, requestTaskbarAttention, updateDockBadge, cancelTaskbarAttention, resetNotificationState } from "../utils/notification";
import { scanOutbox, submitWithRetry, deleteOutbox } from "../utils/outbox";

export type { ConnectionStatus };
export type { ConnectionClientOptions as TeamClientOptions };

export function useTeamClient(
  role: "leader" | "member",
  options: ConnectionClientOptions,
) {


  // 1. Connection layer
  const conn = useConnection(role, options);

  // 2. Message layer
  const msg = useMessages(conn.myId, conn.teamName);

  // 3. Task execution layer
  const taskExec = useTaskExecution({
    role,
    myId: conn.myId,
    teamName: conn.teamName,
  });

  // 4. Auto-reply layer
  const autoReply = useAutoReply({
    myId: conn.myId,
    teamName: conn.teamName,
    role,
    getConversation: msg.getConversation,
    sendChat: msg.sendChat,
  });

  const { settings: memberSettings, loadSettings: loadMemberSettings } = getMemberSettings();
  const userProfile = useUserProfile();

  // ─── Glue: bridge connection events to message layer ───

  let isFirstConnect = true;

  conn.client.on("connected", () => {
    const joinRole = role === "leader" ? "leader" : "member";

    if (isFirstConnect) {
      isFirstConnect = false;
    } else {
      conn.client.send("team:join", { role: joinRole });
    }

    msg.loadHistory();
    loadMemberSettings(conn.myId);

    // Flush outbox: resend any unsent task results
    flushOutbox();

    // Setup brains sync triggers after settings are loaded
    const brainsSync = getBrainsSync();
    brainsSync.setTeamName(conn.teamName);
    brainsSync.setupTriggers(conn.myId);
    brainsSync.registerTaskListener();

    // Sync glossary to local knowledge base
    syncGlossary(conn.teamName, conn.myId);

    // Load configured members (now includes profile data: nickname, avatar_url)
    conn.loadConfiguredMembers().then(() => {
      userProfile.syncFromMembers(conn.configuredMembers.value);
    });
  });

  conn.client.on("message", (msgObj: Message) => {
    // team:members handled by connection layer
    if (msgObj.type === "notify" && msgObj.subtype === "team:members") {
      const payload = msgObj.payload as { members: MemberInfo[] };
      conn.onlineIds.value = new Set(payload.members.map((m) => m.id));
      if (conn.configuredMembers.value.length === 0) {
        conn.configuredMembers.value = payload.members.map((m) => ({
          ...m,
          status: "online" as const,
        }));
      }
      return;
    }

    // channel-mention notification
    if (msgObj.type === "notify" && msgObj.subtype === "channel-mention") {
      const payload = msgObj.payload as { from: string; channel: string; text: string };
      sendDesktopNotification(
        `${payload.from} ${i18n.global.t('notification.channelMention', 'mentioned you in #General')}`,
        payload.text,
      );
      requestTaskbarAttention();
      return;
    }

    msg.handleIncomingMessage(msgObj);

    // Flash taskbar if message is from someone else (window likely unfocused)
    if (msgObj.type === "message" && msgObj.from !== conn.myId) {
      requestTaskbarAttention();
    }

    // Trigger auto-reply if enabled and message is from someone else (exclude channel messages)
    if (msgObj.type === "message" && msgObj.subtype === "chat" && msgObj.from !== conn.myId) {
      const payload = msgObj.payload as { channel?: string };
      if (payload.channel) return; // Skip auto-reply for channel messages
      if (memberSettings.value.ai_auto_reply) {
        autoReply.trigger(msgObj.from, memberSettings.value.ai_suggestion_history_count);
      }
    }
  });

  conn.client.on("task", msg.handleTaskUpdate);

  // Track previous task statuses for notification dedup
  const prevTaskStatus = new Map<string, string>();

  conn.client.on("task", (task: Task) => {
    const prev = prevTaskStatus.get(task.id);
    prevTaskStatus.set(task.id, task.status);

    // Skip notification if no previous status (first load) or status unchanged
    if (!prev || prev === task.status) return;

    const content = task.content.length > 30 ? task.content.slice(0, 30) + "..." : task.content;
    const myId = conn.myId;

    switch (task.status) {
      case "running": {
        // Dispatched to members — notify assigned members (not self if Leader)
        const isSubscriber = task.subscribe.includes(myId);
        if (isSubscriber && prev === "pending") {
          sendDesktopNotification(i18n.global.t('notification.newTask'), content);
        }
        break;
      }
      case "completed": {
        // Notify creator + all subscribers, but skip if I triggered it
        // (Leader approved → skip notifying self)
        const isRelevant = task.createBy === myId || task.subscribe.includes(myId);
        if (isRelevant) {
          sendDesktopNotification(i18n.global.t('notification.taskCompleted'), content);
        }
        // Trigger brains sync if after_task is enabled and user is a subscriber
        if (task.subscribe.includes(myId) && memberSettings.value.brains_sync_triggers.includes("after_task")) {
          const listener = getBrainsSync().getTaskListener();
          listener?.(task);
        }
        break;
      }
      case "failed": {
        const isRelevant = task.createBy === myId || task.subscribe.includes(myId);
        if (isRelevant) {
          sendDesktopNotification(i18n.global.t('notification.taskFailed'), content);
        }
        break;
      }
      case "reviewing": {
        // Notify creator (Leader), but skip if I'm the one who just completed
        if (task.createBy === myId) {
          sendDesktopNotification(i18n.global.t('notification.taskReviewing'), content);
        }
        break;
      }
    }
  });

  // Register task execution handler
  taskExec.registerHandler(conn.client);

  async function flushOutbox() {
    try {
      const taskService = getTaskService();
      const entries = await scanOutbox(conn.teamName);
      for (const entry of entries) {
        const { teamName: _, taskId, ...rest } = entry;
        const payload = { ...rest, data: rest.data as Record<string, unknown> | undefined };
        const ok = await submitWithRetry(() => taskService.submitResult(taskId, payload));
        if (ok) await deleteOutbox(conn.teamName, taskId);
      }
    } catch (e) {
      console.error("[outbox] flush failed:", e);
    }
  }

  // Sync unread counts to dock/taskbar badge (macOS Dock, Windows 10+)
  watch(msg.unreadCounts, (counts) => {
    let total = 0;
    for (const count of counts.values()) {
      total += count;
    }
    updateDockBadge(total);
  });

  // ─── Public interface ───

  function dispatchTask(targetIds: string[], content: string, mode?: "serial" | "parallel") {
    void getTaskService().dispatch(targetIds, content, mode);
  }

  function logout() {
    conn.disconnect();
    autoReply.dispose();
    getBrainsSync().cleanupTriggers();
    updateDockBadge(0);
    cancelTaskbarAttention();
    resetNotificationState();
    setTeamClientInstance(null);
    clearCredentials();
  }

  return {
    myId: conn.myId,
    role,
    teamName: conn.teamName,
    status: conn.status,
    reconnectAttempt: conn.reconnectAttempt,
    members: conn.members,
    client: conn.client,
    currentClientTask: taskExec.currentClientTask,
    currentReviewTask: taskExec.currentReviewTask,
    clientTaskQueue: taskExec.clientTaskQueue,
    isReviewing: taskExec.isReviewing,
    resolveCurrentTask: taskExec.resolveCurrentTask,
    resolveCurrentReview: taskExec.resolveCurrentReview,
    setAutoExecutor: taskExec.setAutoExecutor,
    messages: msg.messages,
    uniqueTaskCount: msg.uniqueTaskCount,
    unreadCounts: msg.unreadCounts,
    connect: conn.connect,
    disconnect: conn.disconnect,
    logout,
    sendChat: msg.sendChat,
    dispatchTask,
    getConversation: msg.getConversation,
    incrementUnread: msg.incrementUnread,
    markRead: msg.markRead,
    clearConversation: msg.clearConversation,
    revokeMessage: msg.revokeMessage,
    autoReplyDispose: autoReply.dispose,
    userProfile,
    loadConfiguredMembers: conn.loadConfiguredMembers,
    configuredMembers: conn.configuredMembers,
  };
}

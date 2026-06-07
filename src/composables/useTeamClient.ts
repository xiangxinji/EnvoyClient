import { watch } from "vue";
import { useConnection } from "./useConnection";
import type { ConnectionStatus, ConnectionClientOptions } from "./useConnection";
import { useMessages } from "./useMessages";
import { useTaskExecution } from "./useTaskExecution";
import { useAutoReply } from "./useAutoReply";
import { getMemberSettings, setTeamClientInstance, getTaskService, getBrainsSync } from "./teamClientContext";
import { clearCredentials } from "../api";
import { syncGlossary } from "./useGlossarySync";
import { useUserProfile } from "./useUserProfile";
import { updateDockBadge, cancelTaskbarAttention, resetNotificationState } from "../utils/notification";
import { scanOutbox, submitWithRetry, deleteOutbox } from "../utils/outbox";
import { useTeamClientMessageRouter } from "./useTeamClientMessageRouter";
import { useTeamClientNotifications } from "./useTeamClientNotifications";

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

  // ─── Extracted event handlers ───

  const { routeMessage } = useTeamClientMessageRouter({
    myId: conn.myId,
    onMemberUpdate: (members, onlineIds) => {
      conn.onlineIds.value = onlineIds;
      if (conn.configuredMembers.value.length === 0) {
        conn.configuredMembers.value = members.map((m) => ({ ...m, status: "online" as const }));
      }
    },
    onIncomingMessage: msg.handleIncomingMessage,
    onAutoReply: (from, count) => autoReply.trigger(from, count),
    onChannelMentionAutoReply: (from, text, count) => autoReply.triggerFromChannel(from, text, count),
    aiAutoReplyEnabled: () => memberSettings.value.ai_auto_reply,
    aiHistoryCount: () => memberSettings.value.ai_suggestion_history_count,
  });

  const brainsSync = getBrainsSync();
  const { handleTaskNotification } = useTeamClientNotifications({
    myId: conn.myId,
    memberSettings,
    onBrainsSyncTask: (task) => brainsSync.getTaskListener()?.(task),
  });

  // ─── Glue: bridge connection events ───

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
    flushOutbox();

    brainsSync.setTeamName(conn.teamName);
    brainsSync.setupTriggers(conn.myId);
    brainsSync.registerTaskListener();

    syncGlossary(conn.teamName, conn.myId);

    conn.loadConfiguredMembers().then(() => {
      userProfile.syncFromMembers(conn.configuredMembers.value);
    });
  });

  conn.client.on("message", routeMessage);
  conn.client.on("task", msg.handleTaskUpdate);
  conn.client.on("task", handleTaskNotification);

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

  // Sync unread counts to dock/taskbar badge
  watch(msg.unreadCounts, (counts) => {
    let total = 0;
    for (const count of counts.values()) total += count;
    updateDockBadge(total);
  });

  // ─── Public interface ───

  function dispatchTask(targetIds: string[], content: string, mode?: "serial" | "parallel") {
    void getTaskService().dispatch(targetIds, content, mode);
  }

  function logout() {
    conn.disconnect();
    autoReply.dispose();
    brainsSync.cleanupTriggers();
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

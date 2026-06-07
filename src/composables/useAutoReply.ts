import type { ChatMessage, TimelineItem } from "../types";
import { autoReplyLoop, type AutoReplyMessage } from "../agent/autoReplyLoop";
import { autoReplyService } from "../agent/services/autoReplyService";
import { cloudService } from "../agent/services/cloudService";
import { toTools } from "../agent/core/toTools";
import { getErrorMessage } from "../utils/error";

const DEBOUNCE_MS = 5000;

export interface AutoReplyOptions {
  myId: string;
  teamName: string;
  role: string;
  getConversation: (peerId: string) => TimelineItem[];
  sendChat: (targetId: string, text: string, options?: { source?: "human" | "ai-auto" }) => void;
}

function buildSystemPrompt(context: { username: string; role: string; team: string }): string {
  return `你正在代替用户 ${context.username}（角色：${context.role}，团队：${context.team}）自动回复。

除了回复消息，你还可以使用以下工具来帮助管理：

设置管理：
- get_settings: 查看当前 AI 自动回复相关设置
- toggle_auto_reply: 关闭自动回复（只能关闭，不能重新开启）
- set_execution_mode: 设置任务执行模式（mode: auto/manual）

知识库管理：
- knowledge_list: 列出知识库文件
- knowledge_read: 读取知识条目内容
- knowledge_write: 新增或更新知识条目（path + content）
- knowledge_delete: 删除知识条目

云资源管理：
- cloud_list: 列出团队云资源目录（可选 parentId 指定目录）
- cloud_upload: 上传文件内容到团队云资源（filename + content）
- cloud_upload_file: 将本地文件上传到云资源（path，需要本地文件路径）
- smart_upload: 智能上传文件到云资源（自动归类目录，需 filename + content + description）

规则：
- 以 ${context.username} 的口吻自然回复，保持简洁专业
- 不要暴露你是 AI，不要使用"作为一个..."、"作为AI..."这类措辞
- 先判断对方意图：普通聊天直接回复，管理指令则调用工具后回复
- 工具调用后必须给出确认回复（如"已帮你开启 ✅"）
- 用与对方消息相同的语言回复
- 不要添加多余的解释或寒暄
- 如果涉及你不了解的具体工作细节，诚实地表示需要稍后查看或确认
- 删除知识文件时请在回复中确认`;
}

export function useAutoReply(opts: AutoReplyOptions) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  // Guard against concurrent generateReply for the same peer
  const inflight = new Map<string, Promise<void>>();

  function trigger(peerId: string, historyCount: number, channelMessage?: string) {
    // Reset existing timer for this peer
    const existing = timers.get(peerId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timers.delete(peerId);
      void generateReply(peerId, historyCount, channelMessage);
    }, DEBOUNCE_MS);

    timers.set(peerId, timer);
  }

  function triggerFromChannel(from: string, text: string, historyCount: number) {
    trigger(from, historyCount, text);
  }

  async function generateReply(peerId: string, historyCount: number, channelMessage?: string) {
    // Skip if a generation is already running for this peer
    if (inflight.has(peerId)) return;

    const promise = (async () => {
      try {
        const conversation = opts.getConversation(peerId);
        const chatMsgs = conversation.filter((m): m is ChatMessage => m.type === "chat");
        const recent = chatMsgs.slice(-historyCount);

        if (recent.length === 0 && !channelMessage) return;

        // Build system prompt
        const systemPrompt = buildSystemPrompt({
          username: opts.myId,
          role: opts.role,
          team: opts.teamName,
        });

        // Build messages array
        const messages: AutoReplyMessage[] = [
          { role: "user", content: systemPrompt },
          ...recent.map((m) => ({
            role: (m.mine ? "assistant" : "user") as "user" | "assistant",
            content: m.text,
          })),
        ];

        // If triggered by channel @mention, append the triggering message
        if (channelMessage) {
          messages.push({ role: "user", content: `[在频道中被提及] ${channelMessage}` });
        }

        // Build tools
        const tools = toTools([autoReplyService, cloudService], {
          teamName: opts.teamName,
          myId: opts.myId,
        });

        // Run the ReAct loop
        const { text } = await autoReplyLoop(messages, tools);

        if (text?.trim()) {
          opts.sendChat(peerId, text.trim(), { source: "ai-auto" });
        }
      } catch (e: unknown) {
        console.warn("[autoReply] generate error:", getErrorMessage(e));
      } finally {
        inflight.delete(peerId);
      }
    })();

    inflight.set(peerId, promise);
    await promise;
  }

  function dispose() {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  }

  return {
    trigger,
    triggerFromChannel,
    dispose,
  };
}

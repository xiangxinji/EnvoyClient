import { ref } from "vue";
import type { Router } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTeamClient } from "./useTeamClient";
import { setTeamClientInstance } from "./teamClientContext";
import { setManagerUrl, setClientToken, setCredentials } from "../api";
import { rsaEncrypt } from "../utils/rsa";
import { isTauri } from "../utils/platform";
import { getErrorMessage } from "../utils/error";

export function useAuth(deps: { router: Router }) {
  const { router } = deps;
  const { t } = useI18n();

  const managerUrl = ref("http://localhost:8080");
  const username = ref("");
  const password = ref("");
  const loading = ref(false);
  const error = ref("");
  const role = ref<"leader" | "member">("member");
  const teams = ref<{ name: string; port: number }[]>([]);
  const selectedTeam = ref("");
  const authenticated = ref(false);

  async function loadSettings(
    sysSettings: { loadLocaleFromSettings: () => Promise<void>; locale: string },
    currentLocale: { value: string },
  ) {
    await sysSettings.loadLocaleFromSettings();
    currentLocale.value = sysSettings.locale;
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const settings = (await invoke("get_settings")) as any;
      if (settings?.env?.manager_url) managerUrl.value = settings.env.manager_url.trim();
      if (settings?.last_login) {
        const { username: savedUser, team: savedTeam, password: savedPass } = settings.last_login;
        if (savedUser) username.value = savedUser;
        if (savedTeam) selectedTeam.value = savedTeam;
        if (savedPass) password.value = savedPass;
      }
    } catch {}
  }

  async function handleLogin() {
    const user = username.value.trim();
    const pass = password.value;
    if (!user || !pass) {
      error.value = t("role.enterUserAndPass");
      return;
    }

    loading.value = true;
    error.value = "";

    try {
      const base = managerUrl.value.trim();

      // Determine if password is already encrypted (from settings) or plaintext
      let encrypted: string;
      if (pass.startsWith("ENC:")) {
        encrypted = pass.slice(4);
      } else {
        const keyRes = await fetch(`${base}/api/public-key`);
        if (!keyRes.ok) throw new Error(t("role.fetchKeyFailed"));
        const { key: pubKey } = await keyRes.json();
        encrypted = await rsaEncrypt(pubKey, pass);
      }

      const res = await fetch(`${base}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: encrypted }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("role.authFailed") }));
        throw new Error(err.error || t("role.authFailed"));
      }

      const data = await res.json();
      role.value = data.role;

      if (data.token) setClientToken(data.token);
      setCredentials(user, encrypted);

      // Save credentials + initialize workspace
      if (isTauri) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const settings = (await invoke("get_settings")) as any;
          settings.last_login = { username: user, team: selectedTeam.value || null, password: "ENC:" + encrypted };
          await invoke("save_settings", { settings });
          await invoke("init_brains", { username: user });
          await invoke("init_workspace", { username: user });
        } catch (e) {
          console.warn("save settings / init workspace failed:", e);
        }
      }

      const teamsRes = await fetch(`${base}/api/teams?username=${encodeURIComponent(user)}`);
      const teamsData = await teamsRes.json();
      teams.value = teamsData.map((t: { name: string; port: number }) => ({ name: t.name, port: t.port }));

      if (teams.value.length === 0) {
        error.value = t("role.noTeams");
        loading.value = false;
        return;
      }

      if (!teams.value.find((t) => t.name === selectedTeam.value)) {
        selectedTeam.value = teams.value[0].name;
      }
      authenticated.value = true;
    } catch (e: unknown) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function handleConnect() {
    const team = teams.value.find((t) => t.name === selectedTeam.value);
    if (!team) return;

    loading.value = true;
    error.value = "";

    try {
      setManagerUrl(managerUrl.value.trim());
      const url = new URL(managerUrl.value.trim());
      const wsUrl = `ws://${url.hostname}:${team.port}`;

      const teamClient = useTeamClient(role.value, {
        id: username.value.trim(),
        servers: [wsUrl],
        teamName: team.name,
      });

      await teamClient.connect();
      setTeamClientInstance(teamClient);

      // Update last selected team
      if (isTauri) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const settings = (await invoke("get_settings")) as any;
          if (settings.last_login) {
            settings.last_login.team = team.name;
            await invoke("save_settings", { settings });
          }
        } catch {}
      }

      router.push("/chat");
    } catch (e) {
      const msg = getErrorMessage(e);
      if (msg === "DUPLICATE_LOGIN") {
        error.value = t("role.alreadyOnline");
      } else {
        error.value = msg || t("role.connectFailed");
      }
      loading.value = false;
    }
  }

  function handleLogout() {
    authenticated.value = false;
    teams.value = [];
    selectedTeam.value = "";
    error.value = "";
  }

  return {
    managerUrl, username, password, loading, error,
    role, teams, selectedTeam, authenticated,
    loadSettings, handleLogin, handleConnect, handleLogout,
  };
}

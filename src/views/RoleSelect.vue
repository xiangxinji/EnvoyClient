<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useTeamClient } from "../composables/useTeamClient";
import { setTeamClientInstance } from "../composables/teamClientContext";

const router = useRouter();

const role = ref<"leader" | "member">("member");
const clientId = ref("");
const serverUrl = ref("ws://localhost:3000");
const loading = ref(false);
const error = ref("");
const idError = ref("");
const urlError = ref("");

function validate(): boolean {
  idError.value = "";
  urlError.value = "";
  let valid = true;

  if (!clientId.value.trim()) {
    idError.value = "Client ID cannot be empty";
    valid = false;
  }

  const url = serverUrl.value.trim();
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    urlError.value = "URL must start with ws:// or wss://";
    valid = false;
  }

  return valid;
}

async function handleConnect() {
  if (!validate()) return;

  loading.value = true;
  error.value = "";

  try {
    const teamClient = useTeamClient(role.value, {
      id: clientId.value.trim(),
      servers: [serverUrl.value.trim()],
    });

    await teamClient.connect();
    setTeamClientInstance(teamClient);
    router.push("/chat");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Connection failed";
    loading.value = false;
  }
}
</script>

<template>
  <div class="role-select">
    <h1>Envoy Client</h1>

    <div class="form">
      <div class="role-group">
        <label>
          <input type="radio" v-model="role" value="leader" />
          Leader
        </label>
        <label>
          <input type="radio" v-model="role" value="member" />
          Member
        </label>
      </div>

      <div class="field">
        <label for="client-id">Client ID</label>
        <input id="client-id" v-model="clientId" placeholder="e.g. alice" :disabled="loading" />
        <span v-if="idError" class="error">{{ idError }}</span>
      </div>

      <div class="field">
        <label for="server-url">Server URL</label>
        <input id="server-url" v-model="serverUrl" placeholder="ws://localhost:3000" :disabled="loading" />
        <span v-if="urlError" class="error">{{ urlError }}</span>
      </div>

      <button @click="handleConnect" :disabled="loading">
        {{ loading ? "Connecting..." : "Connect" }}
      </button>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.role-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 1.5rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 320px;
}

.role-group {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
}

.role-group label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

input[type="text"],
input:not([type]) {
  padding: 0.5em 0.8em;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 1em;
}

button {
  padding: 0.6em;
  border-radius: 6px;
  border: none;
  background: #396cd8;
  color: white;
  font-size: 1em;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #e53e3e;
  font-size: 0.85em;
}
</style>

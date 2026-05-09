import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { Team } from "../../envoy/packages/teams/team.js";
import { loadRegistry, ensureRegistryDir } from "./team-registry.js";
import teamRoutes from "./routes/teams.js";
import userRoutes from "./routes/users.js";
import dashboardRoutes from "./routes/dashboard.js";

const app = new Hono();
app.use("*", cors());

const teamInstances = new Map<string, Team>();

async function restoreTeams(): Promise<void> {
  const records = await loadRegistry();
  for (const rec of records) {
    const team = new Team({ port: rec.port, host: "0.0.0.0" });
    await team.start();
    teamInstances.set(rec.name, team);
    console.log(`[restored] team "${rec.name}" on port ${rec.port}`);
  }
}

// Register route groups
teamRoutes(app, teamInstances);
userRoutes(app);
dashboardRoutes(app, teamInstances);

// Start
const PORT = Number(process.env.MANAGER_PORT) || 8080;

await ensureRegistryDir();
await restoreTeams();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Manager API running on http://localhost:${info.port}`);
});

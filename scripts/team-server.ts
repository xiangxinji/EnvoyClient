// Team 服务器启动脚本
// 用法: npx tsx scripts/team-server.ts

import { Team } from "../Envoy/packages/teams/team.js";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "localhost";

const team = new Team({ port, host });

team.on("leader:joined", (id) => console.log(`[Leader joined] ${id}`));
team.on("member:joined", (id) => console.log(`[Member joined] ${id}`));

await team.start();
console.log(`Team server running on ws://${host}:${port}`);

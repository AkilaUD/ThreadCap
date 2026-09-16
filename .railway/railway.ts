import { defineRailway, github, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const apiSource = github("AkilaUD/ThreadCap", { branch: "master", checkSuites: true });
  const webSource = github("AkilaUD/ThreadCap", { branch: "master", checkSuites: true });

  const uploads = volume("uploads", {
    region: "us-west2",
    sizeMB: 500,
  });

  const api = service("api", {
    source: apiSource,
    build: "pnpm --filter @threadcap/shared-types build && pnpm --filter @threadcap/capsule-core build && pnpm --filter @threadcap/api build",
    start: "pnpm --filter @threadcap/api start",
    healthcheck: "/healthz",
    healthcheckTimeout: 120,
    replicas: { iad: 1 },
    volumeMounts: {
      "/data/uploads": uploads,
    },
    env: {
      NODE_ENV: "production",
      PORT: "8080",
    },
  });

  const web = service("web", {
    source: webSource,
    build: "pnpm --filter @threadcap/shared-types build && pnpm --filter @threadcap/ui build && pnpm --filter @threadcap/web build",
    start: "pnpm --filter @threadcap/web start",
    healthcheck: "/",
    replicas: { iad: 1 },
    env: {
      NODE_ENV: "production",
      PORT: "3000",
    },
  });

  return project("threadcap", {
    resources: [web, api, uploads],
  });
});
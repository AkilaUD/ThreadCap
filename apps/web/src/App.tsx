import { cn } from '@threadcap/ui';

const stack: Array<{ name: string; role: string }> = [
  { name: 'apps/api', role: 'REST /v1 + MCP (/mcp) — merged on free tier (D-021)' },
  { name: 'apps/web', role: 'React 19 + Vite + Tailwind v4 app' },
  { name: 'apps/mcp', role: 'stdio JSON-RPC MCP server' },
  { name: 'packages/capsule-core', role: 'versioning, diff, fingerprint, token math' },
  { name: 'packages/shared-types', role: 'zod schemas — single source of truth' },
  { name: 'Neon', role: 'Postgres 16 + pgvector (free, scale-to-zero)' },
  { name: 'Upstash', role: 'Redis (rate limits, queues, sessions) — free' },
  { name: 'Railway Free', role: 'hosts web + api/mcp + skills ($0 stack, D-020)' },
];

export default function App() {
  return (
    <main className={cn('min-h-screen bg-zinc-950 text-zinc-100')}>
      <section className="mx-auto max-w-3xl px-6 py-24">
        <p className="text-sm uppercase tracking-widest text-indigo-400">Context OS for AI</p>
        <h1 className="mt-4 text-4xl font-bold">Never start from zero again.</h1>
        <p className="mt-4 text-zinc-400">
          ThreadCap ships every useful chat/email thread as a versioned capsule you can inject
          into any AI — with purpose-driven briefs, zero ingest risk, and one-command setup.
        </p>
        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stack.map((s) => (
            <li key={s.name} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="font-mono text-sm text-indigo-300">{s.name}</div>
              <div className="mt-1 text-sm text-zinc-400">{s.role}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
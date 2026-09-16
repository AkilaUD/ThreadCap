import { z } from 'zod';

export const WidgetOptions = z.object({
  apiBaseUrl: z.string().url(),
  workspaceId: z.string().startsWith('ws_'),
  ref: z.string().max(120).default('threadcap-widget'),
});
export type WidgetOptions = z.infer<typeof WidgetOptions>;

export function installSnippet(opts: WidgetOptions): string {
  const url = `${opts.apiBaseUrl}/sdk/widget.js`;
  return `<script src="${url}" data-threadcap-workspace="${opts.workspaceId}" data-threadcap-ref="${opts.ref}" defer></script>`;
}
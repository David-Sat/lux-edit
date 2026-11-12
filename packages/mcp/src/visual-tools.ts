import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VisualCaptureResponse, ElementVariantSet, API_ROUTES } from '@visual-edit/core';
import { LuxServerBridge, READ_ONLY_ANNOTATIONS, WRITE_IDEMPOTENT_ANNOTATIONS } from './server-bridge.js';

/** Formats visual capture layout and computed style diagnostics into markdown lines. */
function formatCaptureDiagnostics(
  data: VisualCaptureResponse,
  selector: string | undefined,
  resolution: 'draft' | 'full'
): string[] {
  const diag = data.diagnostics;
  const diagLines: string[] = [
    `### Visual Capture (${selector ? `Selector: \`${selector}\`` : 'Full Viewport'})`,
    `- **Dimensions**: ${data.width || diag?.bounds.width || 0} × ${data.height || diag?.bounds.height || 0}px (${resolution})`,
  ];
  if (data.url) diagLines.push(`- **URL**: \`${data.url}\``);
  if (diag?.domHash) diagLines.push(`- **DOM Hash**: \`${diag.domHash}\``);

  if (diag?.overflowIssues && diag.overflowIssues.length > 0) {
    diagLines.push(`- **[Warning] Layout Overflow Warnings (${diag.overflowIssues.length})**:`);
    for (const issue of diag.overflowIssues.slice(0, 5)) {
      diagLines.push(
        `  - \`${issue.selector}\`: ${issue.reason} (scroll: ${issue.scrollWidth}×${issue.scrollHeight}, client: ${issue.clientWidth}×${issue.clientHeight})`
      );
    }
  } else {
    diagLines.push(`- **Layout Check**: No unintended overflow or broken images detected.`);
  }

  if (diag?.brokenImages && diag.brokenImages.length > 0) {
    diagLines.push(`- **[Warning] Broken Images**: ${diag.brokenImages.map((src) => `\`${src}\``).join(', ')}`);
  }
  if (diag?.computedStyles && Object.keys(diag.computedStyles).length > 0) {
    diagLines.push(`- **Computed Styles**: \`${JSON.stringify(diag.computedStyles)}\``);
  }
  return diagLines;
}

/** Registers `lux_capture_visual` and `lux_propose_variants` MCP tools. */
export function registerVisualTools(server: McpServer, bridge: LuxServerBridge): void {
  server.tool(
    'lux_capture_visual',
    'Capture a real-time PNG screenshot and layout/overflow diagnostics of the full viewport or a specific CSS selector from the active browser tab.',
    {
      selector: z
        .string()
        .optional()
        .describe('Optional CSS selector to capture a cropped screenshot and computed styles of a specific element. Omit to capture the full viewport.'),
      viewport: z
        .enum(['desktop', 'tablet', 'mobile'])
        .optional()
        .describe('Optional responsive viewport preset to test (desktop: 1440x900, tablet: 768x1024, mobile: 375x812).'),
      resolution: z
        .enum(['draft', 'full'])
        .default('draft')
        .describe('Capture resolution: "draft" (fast, max 800px wide, token-efficient) or "full" (high-DPI 1x/2x for reading small text).'),
      includeOverlay: z
        .boolean()
        .default(false)
        .describe('Whether to include the lux-edit overlay pins/dock in the screenshot. Defaults to false for clean UI inspection.'),
      workspaceDir: z.string().optional().describe('Absolute path to project workspace directory'),
      serverUrl: z.string().optional().describe('URL of running lux server'),
    },
    READ_ONLY_ANNOTATIONS,
    async ({ selector, viewport, resolution = 'draft', includeOverlay = false, workspaceDir, serverUrl }) => {
      const targetUrl = bridge.resolveTargetServerUrl({ workspaceDir, serverUrl });
      try {
        const res = await fetch(`${targetUrl}${API_ROUTES.CAPTURE}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selector,
            viewport,
            resolution,
            includeOverlay,
          }),
          signal: AbortSignal.timeout(14000),
        });

        const data = (await res.json()) as VisualCaptureResponse;
        if (!data.success || !data.imageBase64) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: `Visual capture failed: ${data.error || 'Could not capture screenshot from browser.'}`,
              },
            ],
          };
        }

        const diagLines = formatCaptureDiagnostics(data, selector, resolution);
        const cleanBase64 = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');

        return {
          content: [
            {
              type: 'image' as const,
              data: cleanBase64,
              mimeType: 'image/png',
            },
            {
              type: 'text' as const,
              text: diagLines.join('\n'),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Could not connect to running lux server at ${targetUrl} for visual capture (${err?.message || 'connection refused'}). Make sure \`lux\` is running and open in a browser tab.`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    'lux_propose_variants',
    'Propose 2 to 4 visual/structural component variants for a target CSS selector so the user can interactively toggle, preview, and approve their favorite option live in the browser.',
    {
      targetSelector: z
        .string()
        .describe('CSS selector of the target DOM element to attach the interactive Variant Switcher pill to (e.g. "button.hero-cta" or "#pricing-card").'),
      label: z
        .string()
        .optional()
        .describe('Short human-readable title for this variant exploration (e.g. "Hero Button Treatments").'),
      expectedHash: z
        .string()
        .optional()
        .describe('Optional targetHash from lux_get_pending_review to ensure the target element has not changed incompatibly.'),
      variants: z
        .array(
          z.object({
            id: z.string().optional().describe('Optional short identifier (e.g. "var_glass")'),
            name: z.string().describe('Concise display name shown on the switcher pill (e.g. "Option A: Glassmorphic")'),
            rationale: z.string().describe('One-sentence design rationale shown when the user previews this variant'),
            styles: z
              .record(z.string(), z.string())
              .optional()
              .describe('Optional CSS property map to preview on the element (e.g. {"border-radius": "9999px", "backdrop-filter": "blur(12px)"})'),
            classes: z
              .object({
                add: z.array(z.string()).optional().describe('CSS/Tailwind classes to add when previewing'),
                remove: z.array(z.string()).optional().describe('CSS/Tailwind classes to remove when previewing'),
              })
              .optional()
              .describe('Optional class modifications to preview'),
            html: z
              .string()
              .optional()
              .describe('Optional replacement innerHTML or outerHTML snippet for structural variations'),
            text: z
              .string()
              .optional()
              .describe('Optional replacement textContent for copy variations'),
          })
        )
        .min(1)
        .max(6)
        .describe('List of variants for the user to toggle between in the browser'),
      workspaceDir: z.string().optional().describe('Absolute path to project workspace directory'),
      serverUrl: z.string().optional().describe('URL of running lux server'),
    },
    WRITE_IDEMPOTENT_ANNOTATIONS,
    async ({ targetSelector, label, expectedHash, variants, workspaceDir, serverUrl }) => {
      const store = bridge.resolveEventStore(workspaceDir);
      const targetUrl = bridge.resolveTargetServerUrl({ workspaceDir, serverUrl });

      let variantSet: ElementVariantSet | null = null;
      if (targetUrl) {
        try {
          const res = await fetch(`${targetUrl}${API_ROUTES.VARIANTS}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetSelector,
              label,
              expectedHash,
              variants,
            }),
            signal: AbortSignal.timeout(1500),
          });
          if (res.ok) {
            const data = (await res.json()) as { variantSet: ElementVariantSet };
            variantSet = data.variantSet;
          }
        } catch {}
      }

      if (!variantSet) {
        variantSet = store.proposeVariants({
          targetSelector,
          label,
          expectedHash,
          variants,
        });
      }

      if (variantSet.status === 'stale') {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Stale revision conflict: ${variantSet.staleReason || 'The target element was modified since your last inspection.'}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Proposed ${variantSet.variants.length} variants for \`${targetSelector}\` (Set ID: \`${variantSet.id}\`).\nThe user can now toggle between Original and [${variantSet.variants.map((v) => `"${v.name}"`).join(', ')}] live in the browser overlay and click "Pick & Apply".\nWhen they approve a variant, you will receive their decision via \`lux_get_pending_review\`.`,
          },
        ],
      };
    }
  );
}

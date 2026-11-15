import { IncomingMessage, ServerResponse } from 'node:http';
import type { ProposeVariantInput } from './variant-store.js';
import { ApiRouteContext, readJsonBody, sendJson } from './routes-context.js';

interface VariantsRequestBody {
  action?: 'dismiss' | 'delete' | 'revert' | 'decide' | 'propose';
  setId?: string;
  sessionId?: string;
  selectedVariantId?: string;
  userNote?: string;
  targetHash?: string;
  targetSelector?: string;
  label?: string;
  expectedHash?: string;
  variants?: ProposeVariantInput[];
}

export async function handleVariantsRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: ApiRouteContext
): Promise<boolean> {
  if (req.method === 'GET') {
    const selector = url.searchParams.get('selector') || undefined;
    sendJson(res, ctx.eventStore.getVariantSets(selector));
    return true;
  }

  if (req.method !== 'POST') {
    return false;
  }

  try {
    const body = await readJsonBody<VariantsRequestBody>(req);
    if (body.action === 'dismiss' || body.action === 'delete') {
      const deleted = body.setId ? ctx.eventStore.deleteVariantSet(body.setId, body.sessionId) : false;
      sendJson(res, { success: deleted });
      return true;
    }

    if (body.action === 'revert') {
      const reverted = body.setId ? ctx.eventStore.revertVariantDecision(body.setId, body.sessionId) : false;
      sendJson(res, { success: reverted });
      return true;
    }

    if (body.action === 'decide') {
      if (!body.setId || !body.selectedVariantId) {
        sendJson(res, { error: 'setId and selectedVariantId are required' }, 400);
        return true;
      }
      const decision = ctx.eventStore.recordVariantDecision({
        setId: body.setId,
        selectedVariantId: body.selectedVariantId,
        userNote: body.userNote,
        targetHash: body.targetHash,
        sessionId: body.sessionId,
      });
      if (!decision) {
        sendJson(res, { error: 'Variant set or variant ID not found' }, 404);
        return true;
      }
      sendJson(res, { success: true, decision });
      return true;
    }

    if (!body.targetSelector || !Array.isArray(body.variants) || body.variants.length === 0) {
      sendJson(res, { error: 'targetSelector and non-empty variants array are required' }, 400);
      return true;
    }

    const variantSet = ctx.eventStore.proposeVariants({
      targetSelector: body.targetSelector,
      label: body.label,
      expectedHash: body.expectedHash,
      variants: body.variants,
    });
    sendJson(res, { success: true, variantSet });
  } catch {
    sendJson(res, { error: 'Invalid variants payload' }, 400);
  }
  return true;
}

import {markBankingRemoval} from '../../Frontend/public/assets/js/modules/core/vault-frame-removal-plan.mjs';
// Legacy regression fixtures model standalone pages: no frame confirmation RPC.
// Explicit per-test mocks take precedence, including rejection/teardown probes.
export function withStandaloneFrame(context) {
  if (!Object.hasOwn(context, 'confirmFrameAction')) context.confirmFrameAction = async () => undefined;
  if (!Object.hasOwn(context, 'confirmFrameRemoval')) context.confirmFrameRemoval = async () => undefined;
  if (!Object.hasOwn(context, 'frameMediaLifetime')) context.frameMediaLifetime = () => ({signal: undefined, valid: () => true, dispose() {}});
  if (!Object.hasOwn(context, 'executeFrameNativeAction')) context.executeFrameNativeAction = (_target, action) => action();
  if (!Object.hasOwn(context, 'TextEncoder')) context.TextEncoder = TextEncoder;
  if (!Object.hasOwn(context, 'vaultFrameClient')) context.vaultFrameClient = {isChild: () => false, onClear() {}};
  if (!Object.hasOwn(context, 'markBankingRemoval')) context.markBankingRemoval = markBankingRemoval;
  if (!Object.hasOwn(context, 'beginFrameLogout')) context.beginFrameLogout = () => null;
  if (!Object.hasOwn(context, 'document')) context.document = context.window?.document || {};
  if (!Object.hasOwn(context, 'navigateDocument')) context.navigateDocument = (target, replace = false) => {
    if (replace) context.window.location.replace(target); else context.window.location.href = target;
  };
  return context;
}

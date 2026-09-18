import { useLastEditCheck } from "../lib/useLastEditCheck";

/**
 * Runs the le_* staleness poll for the lifetime of the signed-in app. Renders
 * nothing.
 *
 * Mounted inside the auth gate — not because the endpoint needs a token (it is
 * public), but because there is no point polling for data freshness on behalf of
 * a signed-out user whose query cache is empty.
 */
export default function StalenessMonitor() {
  useLastEditCheck();
  return null;
}

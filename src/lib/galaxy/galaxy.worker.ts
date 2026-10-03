// src/lib/galaxy/galaxy.worker.ts
// Builds the galaxy off the main thread and hands the buffers back zero-copy.

import { generateGalaxy, transferablesOf } from './generate';
import { LayerCounts } from './tiers';

interface WorkerScope {
	onmessage: ((event: MessageEvent<LayerCounts>) => void) | null;
	postMessage(message: unknown, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
	const data = generateGalaxy(event.data);
	scope.postMessage(data, transferablesOf(data));
};

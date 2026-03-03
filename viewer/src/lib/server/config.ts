import * as path from 'node:path';

export function getLogsDir(): string {
	return path.resolve(process.env.LOGS_DIR ?? path.join(process.cwd(), '..', 'logs'));
}

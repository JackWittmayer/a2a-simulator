import type { PageServerLoad } from './$types';
import { getLogsDir } from '$lib/server/config';
import { scanRuns } from '$lib/parser/parse-run';

export const load: PageServerLoad = () => {
	const logsDir = getLogsDir();
	const runs = scanRuns(logsDir);
	return { runs };
};

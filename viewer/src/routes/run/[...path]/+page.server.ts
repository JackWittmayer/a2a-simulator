import * as path from 'node:path';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLogsDir } from '$lib/server/config';
import { parseRun } from '$lib/parser/parse-run';

export const load: PageServerLoad = ({ params }) => {
	const logsDir = getLogsDir();
	const runDir = path.join(logsDir, params.path);

	try {
		const run = parseRun(runDir);
		return { run };
	} catch {
		error(404, `Run "${params.path}" not found`);
	}
};

import {readdirSync} from 'node:fs';
export const requiredMigrations=readdirSync(new URL('./migrations/',import.meta.url)).filter(name=>/^\d+.*\.sql$/.test(name)).sort();

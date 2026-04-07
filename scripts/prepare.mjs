import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

if (!existsSync(new URL('../.git', import.meta.url))) {
	process.exit(0)
}

try {
	const huskyBin = require.resolve('husky/bin.js')
	const result = spawnSync(process.execPath, [huskyBin], { stdio: 'inherit' })
	process.exit(result.status ?? 0)
} catch {
	process.exit(0)
}

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist', '.venv', 'node_modules', 'scripts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in src/sim/rng.ts' }],
    },
  },
)

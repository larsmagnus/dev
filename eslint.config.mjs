import globals from 'globals'
import pluginJs from '@eslint/js'
import jsDoc from 'eslint-plugin-jsdoc'
import unicorn from 'eslint-plugin-unicorn'
import configPrettier from 'eslint-config-prettier'

export default [
	{ files: ['**/*.js'], languageOptions: { sourceType: 'script' } },
	{ languageOptions: { globals: globals.browser }, plugins: { unicorn } },
	pluginJs.configs.recommended,
	jsDoc.configs['flat/recommended'],
	// eslint-config-prettier must extend last to avoid conflicts
	configPrettier,
]

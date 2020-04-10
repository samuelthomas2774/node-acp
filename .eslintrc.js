module.exports = {
    extends: [
        'google',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 8,
        sourceType: 'module',
    },
    rules: {
        indent: ['error', 4],
        camelcase: 'off',
        'max-len': ['warn', {code: 120}],
        'require-jsdoc': 'warn',
        'arrow-parens': ['warn', 'as-needed'],
        'space-before-function-paren': ['error', {anonymous: 'always', named: 'never'}],
        'comma-dangle': ['error', {
            arrays: 'always-multiline',
            objects: 'always-multiline',
            imports: 'always-multiline',
            exports: 'always-multiline',
            functions: 'never',
        }],
        'prefer-const': ['error', {
            'destructuring': 'all',
            'ignoreReadBeforeAssign': false,
        }],

        // Doesn't work with TypeScript
        'no-unused-vars': 'off',
    },
};

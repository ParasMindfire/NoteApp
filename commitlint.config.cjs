/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'ab-reference-required': ({ type, subject }) => {
          const requiresRef = ['feat', 'fix'].includes(type ?? '')
          if (!requiresRef) return [true]
          const hasRef = /AB#\d+/.test(subject ?? '')
          return [
            hasRef,
            'feat and fix commits must include AB#<ticket-number> in the subject',
          ]
        },
      },
    },
  ],
  rules: {
    'ab-reference-required': [2, 'always'],
  },
}

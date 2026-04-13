// Conventional Commits config. Keep the allowed types in sync with
// .github/workflows/pr-title.yml so local and CI enforcement agree.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'test',
        'chore',
        'refactor',
        'perf',
        'build',
        'ci',
        'style',
        'revert',
      ],
    ],
    // Merge/revert/release commits made by tooling can exceed the default
    // subject length; allow headers up to 100 chars.
    'header-max-length': [2, 'always', 100],
  },
};

import expoConfig from 'eslint-config-expo/flat.js';

export default [
  ...expoConfig,
  {
    ignores: ['dist/**', 'android/**', 'ios/**', 'assets/**', 'node_modules/**', 'supabase/functions/**'],
  },
  {
    rules: {
      // These screens hydrate controlled fields from persisted user state on mount.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

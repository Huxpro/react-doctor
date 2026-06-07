---
"react-doctor": minor
---

Add first-class ReactLynx support.

React Doctor now detects [ReactLynx](https://lynxjs.org) apps (`@lynx-js/react`) as their own framework — reported as `ReactLynx` in CLI output and emitted as the `reactlynx` capability so plugin rules can opt in. Workspace and monorepo discovery picks up ReactLynx sub-projects alongside React, Vite, and React Native ones.

ReactLynx classification is independent of the React Native / Expo gate, so a ReactLynx project that does not declare `react-native` or `expo` will not load the `rn-*` / Expo rules, and `checkReactNativeProject` returns no diagnostics for it. A monorepo that mixes a ReactLynx app with a React Native workspace still loads the RN rules for the RN workspace, gated by the existing file-level package boundary.

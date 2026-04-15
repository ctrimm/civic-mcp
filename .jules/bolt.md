## 2026-04-15 - plugin-loader.js startup performance
**Learning:** The plugin loader was executing all startup requests (fetching the registry, loading user plugins from storage, loading individual plugins) sequentially. This codebase uses a Chrome extension architecture with sandboxing, making initialization asynchronous.
**Action:** Replaced `await` inside the `for...of` loop with an array map returning Promises, then `Promise.all()` to load all enabled plugins in parallel. This significantly decreases the time before plugins are ready for use.

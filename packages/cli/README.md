# jyz

One config file, and a CLI that behaves as whatever package manager a project already uses: `install`, `add`, `remove`, `run`, `exec`, `update`, `outdated`, `lint`, `typecheck`, `check`, `fmt`, `config`, plus `create` and an `oc` bridge to a running opencode server.

The published package is a single bundle with no runtime dependencies, so `bun add -g jyz` (or `npm i -g jyz`) yields one `jyz` binary and nothing else.

```
jyz create my-app --template vite-tauri --feature updater
jyz install / add -D typescript / run dev
jyz config show | path | check --strict
jyz check                 # lint + typecheck in one run
```

Docs and the plan of record live in the repository: <https://github.com/JeffreyJYZ/jyz-tool>.

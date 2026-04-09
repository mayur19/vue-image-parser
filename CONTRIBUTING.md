# Contributing to vue-image-parser

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/mayur19/vue-image-parser.git
cd vue-image-parser

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Build the library
npm run build
```

## Project Structure

```
src/
  codecs/          # HEIC/AVIF WASM codec adapters
  detection/       # Binary signature format detection
  engine/          # Image loader and decode orchestration
  errors/          # Error types and codes
  rendering/       # Canvas/bitmap rendering, EXIF orientation
  types/           # Shared TypeScript types
  utils/           # Fetch, SSR guards, buffer utilities
  vue/             # useImage composable, UniversalImage component
  workers/         # Web Worker pool, decode worker, task queue
test/              # Mirrors src/ structure
```

## Making Changes

1. **Fork and branch** — Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Write tests first** — We follow test-driven development. Add or update tests in `test/` before changing implementation code.

3. **Keep changes focused** — One logical change per PR. Split unrelated fixes into separate PRs.

4. **Follow existing patterns** — Match the code style, naming conventions, and architecture of surrounding code.

## Code Style

- TypeScript strict mode
- ESM-only (`import`/`export`, no `require`)
- Immutable data patterns — return new objects instead of mutating
- Explicit error handling with typed error classes
- No `any` in public APIs

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run a specific test file
npx vitest run test/utils/fetch.test.ts
```

We target 80% code coverage. All PRs must pass the existing test suite and include tests for new functionality.

## Pull Request Process

1. Ensure `npm run build` passes (type check + build)
2. Ensure `npm test` passes with no failures
3. Update documentation if you changed public APIs
4. Write a clear PR description explaining what and why
5. Link any related issues

## Commit Messages

We use conventional commits:

```
feat: add WebP animation support
fix: handle corrupt EXIF data in orientation 6
perf: skip redundant canvas allocation in bitmap renderer
docs: clarify maxDimension behavior in README
test: add edge case tests for 0-byte files
refactor: extract pixel readback into shared utility
chore: update vite-plugin-dts to v4
```

## Reporting Bugs

Open an issue with:
- Browser and version
- Minimal reproduction (code snippet or repo)
- Expected vs. actual behavior
- Image format involved (JPEG, HEIC, AVIF, etc.)

## Requesting Features

Open an issue describing:
- The use case and why existing APIs don't cover it
- Proposed API surface (if you have ideas)
- Whether you'd like to implement it yourself

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

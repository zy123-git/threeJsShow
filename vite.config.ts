import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import glsl from 'vite-plugin-glsl'
import { fileURLToPath, URL } from 'node:url'
import fs from 'fs'
import path from 'path'

// Simple recursive include preprocessor for GLSL files.
function glslIncludePlugin(): Plugin {
  const includeRegex = /^\s*#include\s*(?:["<]?)([^">]+)(?:[">]?)\s*;?\s*$/gm
  const cache = new Map<string, string>()

  function resolveInclude(includePath: string, baseDir: string) {
    // support relative include paths
    let resolved = path.resolve(baseDir, includePath)
    return resolved
  }

  function processIncludes(code: string, id: string, stack = new Set<string>()): string {
    const baseDir = path.dirname(id)
    return code.replace(includeRegex, (match, includeTarget) => {
      let resolved = resolveInclude(includeTarget, baseDir)
      if (stack.has(resolved)) {
        throw new Error(`Circular #include detected: ${includeTarget} -> ${resolved}`)
      }
      if (!fs.existsSync(resolved)) {
        // try with .glsl extension
        if (fs.existsSync(resolved + '.glsl')) {
          resolved = resolved + '.glsl'
        } else {
          throw new Error(`#include target not found: ${includeTarget} (resolved ${resolved})`)
        }
      }
      if (cache.has(resolved)) return cache.get(resolved)!
      stack.add(resolved)
      const includedSource = fs.readFileSync(resolved, 'utf-8')
      const processed = processIncludes(includedSource, resolved, stack)
      stack.delete(resolved)
      cache.set(resolved, processed)
      return processed
    })
  }

  return {
    name: 'vite:glsl-include',
    enforce: 'pre',
    transform(code, id) {
      if (!id.match(/\.glsl(\?|$)/)) return null
      try {
        const out = processIncludes(code, id)
        return {
          code: out,
          map: null
        }
      } catch (e) {
        this.error(e as Error)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    glslIncludePlugin(),
    glsl(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  assetsInclude: ['**/*.glsl'],
})

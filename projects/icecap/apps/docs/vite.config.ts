import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Extract the first # heading from markdown, falling back to a prettified filename
function extractTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  if (match) return match[1].trim()
  return filename.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Custom plugin to scan for markdown files and provide them as a virtual module
function markdownDocsPlugin() {
  const virtualModuleId = 'virtual:docs'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'markdown-docs-plugin',
    resolveId(id: string) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },
    load(id: string) {
      if (id === resolvedVirtualModuleId) {
        const rootDir = path.resolve(__dirname, '../../')
        const docs = []

        // 1. README.md
        const readmePath = path.join(rootDir, 'README.md')
        if (fs.existsSync(readmePath)) {
          const content = fs.readFileSync(readmePath, 'utf-8')
          docs.push({
            id: 'readme',
            title: extractTitle(content, 'README.md'),
            category: 'Root',
            content,
            path: 'README.md'
          })
        }

        // 2. Design docs
        const designDir = path.join(rootDir, 'design')
        if (fs.existsSync(designDir)) {
          fs.readdirSync(designDir).forEach(file => {
            if (file.endsWith('.md')) {
              const content = fs.readFileSync(path.join(designDir, file), 'utf-8')
              docs.push({
                id: `design-${file.replace('.md', '')}`,
                title: extractTitle(content, file),
                category: 'Design',
                content,
                path: `design/${file}`
              })
            }
          })
        }

        // 3. Reports
        const reportsDir = path.join(rootDir, 'reports')
        if (fs.existsSync(reportsDir)) {
          fs.readdirSync(reportsDir).forEach(file => {
            if (file.endsWith('.md')) {
              const content = fs.readFileSync(path.join(reportsDir, file), 'utf-8')
              docs.push({
                id: `reports-${file.replace('.md', '')}`,
                title: extractTitle(content, file),
                category: 'Reports',
                content,
                path: `reports/${file}`
              })
            }
          })
        }

        return `export const docs = ${JSON.stringify(docs)};`
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), markdownDocsPlugin()],
  server: {
    fs: {
      allow: ['..']
    }
  }
})

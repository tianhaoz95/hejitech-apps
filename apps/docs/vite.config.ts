import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

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
          docs.push({
            id: 'readme',
            title: 'Getting Started',
            category: 'Root',
            content: fs.readFileSync(readmePath, 'utf-8'),
            path: 'README.md'
          })
        }

        // 2. Design docs
        const designDir = path.join(rootDir, 'design')
        if (fs.existsSync(designDir)) {
          fs.readdirSync(designDir).forEach(file => {
            if (file.endsWith('.md')) {
              docs.push({
                id: `design-${file.replace('.md', '')}`,
                title: file.replace('.md', '').split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                category: 'Design',
                content: fs.readFileSync(path.join(designDir, file), 'utf-8'),
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
              docs.push({
                id: `reports-${file.replace('.md', '')}`,
                title: file.replace('.md', '').split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                category: 'Reports',
                content: fs.readFileSync(path.join(reportsDir, file), 'utf-8'),
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

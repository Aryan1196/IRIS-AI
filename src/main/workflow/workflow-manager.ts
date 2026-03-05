// src/main/logic/workflow-manager.ts
import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs/promises'

export default function registerWorkflowManager() {
  const WORKFLOWS_FILE = path.join(app.getPath('userData'), 'iris_workflows.json')

  // Load workflows
  ipcMain.handle('load-workflows', async () => {
    try {
      const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8')
      return { success: true, workflows: JSON.parse(data) }
    } catch (e) {
      // File doesn't exist yet, return empty list
      return { success: true, workflows: [] }
    }
  })

  // Save workflow
  ipcMain.handle('save-workflow', async (_, { name, description, nodes, edges }) => {
    try {
      let workflows: Array<any> = []
      try {
        const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8')
        workflows = JSON.parse(data)
      } catch (e) {}

      // Explicit type check to solve the 'Type is not assignable to type never' error from your dump
      const existingIndex = workflows.findIndex((w: any) => w.name === name)
      const newWorkflow = { name, description, nodes, edges, updatedAt: Date.now() }

      if (existingIndex >= 0) {
        workflows[existingIndex] = newWorkflow
      } else {
        workflows.push(newWorkflow)
      }

      await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 🚨 New: Delete Workflow
  ipcMain.handle('delete-workflow', async (_, { name }) => {
    try {
      const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8')
      let workflows = JSON.parse(data)

      workflows = workflows.filter((w: any) => w.name !== name)

      await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}

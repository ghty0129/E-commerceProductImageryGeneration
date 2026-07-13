import { describe, expect, it } from 'vitest'
import { createBatchProjectArchiveFiles } from './batchProjectArchive'

describe('batch project archive', () => {
  it('groups references and generated outputs in one project archive', async () => {
    const files = await createBatchProjectArchiveFiles({
      project: {
        id: 'project-1', name: 'Bottle', sku: 'SKU-1', description: 'Steel bottle', requirements: '',
        imageCount: 1, referenceImages: ['data:image/png;base64,AQ=='], plannedImages: [], taskLinks: [{ imageIndex: 0, taskId: 'task-1' }], status: 'done',
      },
      tasks: [{ id: 'task-1', status: 'done', outputImages: ['output-1'] }],
      resolveImage: async (id) => id === 'output-1' ? 'data:image/webp;base64,Ag==' : '',
    })

    expect(Object.keys(files)).toEqual(expect.arrayContaining([
      'project.json',
      'README.txt',
      'references/reference-01.png',
      'generated/task-01-image-01.webp',
    ]))
    expect([...files['generated/task-01-image-01.webp']]).toEqual([2])
  })
})

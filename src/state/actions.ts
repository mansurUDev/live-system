import { uid } from '../logic/uid'
import type { Action } from './reducer'
import type { Activity, Category, Doc, Sector, TimeEntry } from '../types'

/**
 * Создатели действий — единственное место, где берётся текущее время и
 * генерируются идентификаторы. Благодаря этому редьюсер остаётся чистым и
 * полностью проверяемым в тестах.
 */
export const A = {
  replaceDoc: (doc: Doc): Action => ({ type: 'replaceDoc', doc, now: Date.now() }),

  setSphere: (id: string, value: number): Action => ({
    type: 'setSphere',
    id,
    value,
    now: Date.now(),
  }),
  commitSphere: (id: string): Action => ({ type: 'commitSphere', id, now: Date.now() }),
  stepSphere: (id: string, delta: number): Action => ({
    type: 'stepSphere',
    id,
    delta,
    now: Date.now(),
  }),
  addAmount: (id: string, delta: number): Action => ({
    type: 'addAmount',
    id,
    delta,
    now: Date.now(),
  }),
  toggleStep: (id: string, stepId: string): Action => ({
    type: 'toggleStep',
    id,
    stepId,
    now: Date.now(),
  }),
  setSectorCat: (id: string, cat: Category | null): Action => ({
    type: 'setSectorCat',
    id,
    cat,
    now: Date.now(),
  }),
  addSector: (sector: Sector): Action => ({ type: 'addSector', sector, now: Date.now() }),
  removeSector: (id: string): Action => ({ type: 'removeSector', id, now: Date.now() }),
  archiveSector: (id: string): Action => ({
    type: 'archiveSector',
    id,
    archiveId: uid('ar'),
    now: Date.now(),
  }),
  dismissCelebration: (): Action => ({ type: 'dismissCelebration' }),

  pressAct: (actId: string): Action => ({
    type: 'pressAct',
    actId,
    entryId: uid('e'),
    now: Date.now(),
  }),
  stopTrack: (): Action => ({ type: 'stopTrack', now: Date.now() }),
  saveAct: (act: Activity): Action => ({ type: 'saveAct', act, now: Date.now() }),
  deleteAct: (id: string): Action => ({ type: 'deleteAct', id, now: Date.now() }),
  saveEntry: (entry: TimeEntry): Action => ({ type: 'saveEntry', entry, now: Date.now() }),
  deleteEntry: (id: string): Action => ({ type: 'deleteEntry', id, now: Date.now() }),
}

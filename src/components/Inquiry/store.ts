import create from 'zustand'
import produce from 'immer'
import noop from 'lodash/noop'
import yaml from 'js-yaml'
import FileSaver from 'file-saver'
import cloneDeep from 'lodash/cloneDeep'
import createContext from 'zustand/context'
import { createSelector } from 'reselect'
import { assert } from 'ts-essentials'
import { InquiryProps } from './Inquiry'
import { IInquiry, ISchema } from '../../interfaces'
import * as settings from '../../settings'

// TODO: refactor - use slices?

interface InquiryState {
  // General

  descriptor: IInquiry
  checkpoint: IInquiry
  schema: ISchema
  onCommit: (descriptor: IInquiry) => void
  onRevert: (descriptor: IInquiry) => void
  isPreview?: boolean
  isUpdated?: boolean
  exportFormat: string

  // Elements

  elementType: 'check'
  elementIndex?: number
  elementQuery?: string
  isElementGrid?: boolean
  isElementExtra?: boolean
}

interface InquiryLogic {
  // General

  setExportFormat: (format: string) => void
  togglePreview: () => void
  exporter: () => void
  importer: (file: File) => void
  // TODO: type the patch
  update: (patch: object) => void
  commit: () => void
  revert: () => void

  // Elements

  setElementType: (elementType: InquiryState['elementType']) => void
  setElementIndex: (index?: number) => void
  setElementQuery: (elementQuery?: string) => void
  toggleIsElementGrid: () => void
  toggleIsElementExtra: () => void
  addElement: () => void
  removeElement: () => void
  // TODO: type the patch
  updateElement: (patch: object) => void
}

export function makeStore(props: InquiryProps) {
  const initialState = {
    // General

    descriptor: cloneDeep(props.descriptor),
    checkpoint: cloneDeep(props.descriptor),
    schema: props.schema,
    onCommit: props.onCommit || noop,
    onRevert: props.onRevert || noop,
    exportFormat: settings.DEFAULT_EXPORT_FORMAT,

    // Elements

    elementType: 'check' as InquiryState['elementType'],
  }
  return create<InquiryState & InquiryLogic>((set, get) => ({
    ...initialState,

    // General

    setExportFormat: (exportFormat) => set({ exportFormat }),
    togglePreview: () => set({ isPreview: !get().isPreview }),
    exporter: () => {
      const { descriptor, exportFormat } = get()
      const isYaml = exportFormat === 'yaml'
      const text = isYaml ? yaml.dump(descriptor) : JSON.stringify(descriptor, null, 2)
      const blob = new Blob([text], { type: `text/${exportFormat};charset=utf-8` })
      FileSaver.saveAs(blob, `schema.${exportFormat}`)
      set({ exportFormat: settings.DEFAULT_EXPORT_FORMAT, isPreview: false })
    },
    importer: async (file) => {
      const text = (await file.text()).trim()
      const isYaml = !text.startsWith('{')
      // TODO: handle errors and validate descriptor
      const descriptor = isYaml ? yaml.load(text) : JSON.parse(text)
      set({ descriptor, isUpdated: true })
    },
    update: (patch) => {
      const { descriptor } = get()
      set({ descriptor: { ...descriptor, ...patch }, isUpdated: true })
    },
    revert: () => {
      const { onRevert, descriptor, checkpoint } = get()
      set({ descriptor: cloneDeep(checkpoint), isUpdated: false })
      onRevert(descriptor)
    },
    commit: () => {
      const { onCommit, descriptor } = get()
      set({ checkpoint: cloneDeep(descriptor), isUpdated: false })
      onCommit(descriptor)
    },

    // Elements

    setElementType: (elementType) => set({ elementType }),
    setElementIndex: (elementIndex) => set({ elementIndex }),
    setElementQuery: (elementQuery) => set({ elementQuery }),
    toggleIsElementGrid: () => set({ isElementGrid: !get().isElementGrid }),
    toggleIsElementExtra: () => set({ isElementExtra: !get().isElementExtra }),
    // TODO: finish
    addElement: () => {
      let { elementIndex } = get()
      const { descriptor, elementType } = get()
      const newDescriptor = produce(descriptor, (descriptor) => {
        if (elementType === 'check') {
          descriptor.checks = descriptor.checks || []
          descriptor.checks.push({ code: 'duplicate-row' })
          elementIndex = descriptor.checks.length - 1
        }
      })
      set({ descriptor: newDescriptor, elementIndex, isUpdated: true })
    },
    removeElement: () => {
      const { descriptor, elementType, elementIndex } = get()
      if (elementIndex === undefined) return
      const newDescriptor = produce(descriptor, (descriptor) => {
        if (elementType === 'check') {
          descriptor.checks!.splice(elementIndex, 1)
        }
      })
      set({ descriptor: newDescriptor, elementIndex: undefined, isUpdated: true })
    },
    updateElement: (patch) => {
      const { descriptor, elementType, elementIndex } = get()
      assert(elementIndex !== undefined)
      const newDescriptor = produce(descriptor, (descriptor) => {
        if (elementType === 'check') {
          descriptor.checks![elementIndex] = {
            ...descriptor.checks![elementIndex],
            ...patch,
          }
        }
      })
      set({ descriptor: newDescriptor, isUpdated: true })
    },
  }))
}

export const select = createSelector
export const selectors = {
  check: (state: InquiryState) => {
    const elementIndex = state.elementIndex
    assert(elementIndex !== undefined)
    assert(state.descriptor.checks !== undefined)
    const check = state.descriptor.checks[elementIndex]
    assert(check !== undefined)
    return check
  },
  checkNames: (state: InquiryState) => {
    return (state.descriptor.checks || []).map((check) => check.code)
  },
  foundCheckItems: (state: InquiryState) => {
    const items = []
    for (const [index, check] of (state.descriptor.checks || []).entries()) {
      if (state.elementQuery && !check.code.includes(state.elementQuery)) continue
      items.push({ index, check })
    }
    return items
  },
}
export const { Provider, useStore } = createContext<InquiryState & InquiryLogic>()

import create from 'zustand'
import { assert } from 'ts-essentials'
import { client } from '../../client'
import { IReport, IStatus, IRow } from '../../interfaces'
import { IQuery, IInquiry, IDetector, IResource, IPipeline } from '../../interfaces'

export interface IState {
  contentType: string
  file?: File
  detector: IDetector
  resource?: IResource
  query?: IQuery
  inquiry?: IInquiry
  report?: IReport
  pipeline?: IPipeline
  status?: IStatus
  text?: string
  rows?: IRow[]
  targetRows?: IRow[]
  isMetadataOpen?: boolean
  isSourceView?: boolean
  isReportView?: boolean
  isErrorsView?: boolean
}

export interface ILogic {
  setContentType: (contentType: string) => void
  toggleMetadataOpen: () => void
  toggleSourceView: () => void
  toggleReportView: () => void
  toggleErrorsView: () => void
  uploadFile: (file: File) => void
  updateDetector: (patch: Partial<IDetector>) => void
  updateResource: (patch: Partial<IResource>) => void
  updateQuery: (patch: Partial<IQuery>) => void
  updateInquiry: (patch: Partial<IInquiry>) => void
  updatePipeline: (patch: Partial<IPipeline>) => void
}

export const initialState = {
  isHelpView: true,
  contentType: 'help',
  // TODO: move to settings or server-side
  detector: { bufferSize: 10000, sampleSize: 100 },
}

export const useStore = create<IState & ILogic>((set, get) => ({
  ...initialState,

  // Page

  setContentType: (contentType) => set({ contentType }),
  toggleMetadataOpen: () => set({ isMetadataOpen: !get().isMetadataOpen }),
  toggleSourceView: () => set({ isSourceView: !get().isSourceView, isReportView: false }),
  toggleReportView: () => set({ isReportView: !get().isReportView, isSourceView: false }),
  toggleErrorsView: () =>
    set({ isErrorsView: !get().isErrorsView, isSourceView: false, isReportView: false }),

  // File

  uploadFile: async (file) => {
    // TODO: implement properly
    if (file.type !== 'text/csv' || file.size > 10000000) {
      // TODO: clean file input
      alert('Currently only CSV files under 10Mb are supported')
      return
    }
    // TODO: find a proper place for it
    const text = await file.text()
    const { detector } = get()
    // TODO: make unblocking
    const { resource } = await client.describe(file, detector)
    const query = {}
    // TODO: make unblocking
    const { rows } = await client.extract(file, resource, query)
    const inquiry = {}
    const { report } = await client.validate(file, resource, inquiry)
    const pipeline = {}
    set({
      contentType: 'data',
      file,
      resource,
      rows,
      inquiry,
      report,
      pipeline,
      text,
      query,
    })
  },

  // Metadata

  updateDetector: (patch) => {
    const { detector } = get()
    if (detector) set({ detector: { ...detector, ...patch } })
  },
  updateResource: async (patch) => {
    const { file, resource, query, inquiry } = get()
    assert(file)
    assert(resource)
    assert(query)
    assert(inquiry)
    const newResource = { ...resource, ...patch }
    const { rows } = await client.extract(file, newResource, query)
    const { report } = await client.validate(file, resource, inquiry)
    set({ resource: newResource, rows, report })
  },
  updateQuery: async (patch) => {
    const { file, resource, query } = get()
    assert(file)
    assert(resource)
    assert(query)
    const newQuery = { ...query, ...patch }
    const { rows } = await client.extract(file, resource, newQuery)
    set({ query: newQuery, rows })
  },
  updateInquiry: async (patch) => {
    const { file, resource, inquiry } = get()
    assert(file)
    assert(resource)
    assert(inquiry)
    const newInquiry = { ...inquiry, ...patch }
    const { report } = await client.validate(file, resource, newInquiry)
    set({ inquiry: newInquiry, report })
  },
  updatePipeline: async (patch) => {
    const { file, resource, pipeline } = get()
    assert(file)
    assert(resource)
    assert(pipeline)
    const newPipeline = { ...pipeline, ...patch }
    const { status, targetRows } = await client.transform(file, resource, newPipeline)
    set({ pipeline: newPipeline, status, targetRows })
  },
}))

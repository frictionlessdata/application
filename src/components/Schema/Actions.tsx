import * as React from 'react'
import Box from '@mui/material/Box'
import ExportButton from '../Library/Buttons/ExportButton'
import ImportButton from '../Library/Buttons/ImportButton'
import CommitButton from '../Library/Buttons/CommitButton'
import RevertButton from '../Library/Buttons/RevertButton'
import Columns from '../Library/Columns'
import { useStore } from './store'

export default function Actions() {
  const isPreview = useStore((state) => state.isPreview)
  const isUpdated = useStore((state) => state.isUpdated)
  const exportFormat = useStore((state) => state.exportFormat)
  const exporter = useStore((state) => state.exporter)
  const importer = useStore((state) => state.importer)
  const preview = useStore((state) => state.preview)
  const commit = useStore((state) => state.commit)
  const revert = useStore((state) => state.revert)
  return (
    <Box sx={{ borderTop: 'solid 1px #ddd', lineHeight: '63px' }}>
      <Columns spacing={3}>
        <ExportButton
          format={exportFormat}
          isPreview={isPreview}
          handleExport={exporter}
          handlePreview={preview}
        />
        <ImportButton handleImport={importer} />
        <CommitButton disabled={!isUpdated} handleClick={commit} />
        <RevertButton disabled={!isUpdated} handleClick={revert} />
      </Columns>
    </Box>
  )
}

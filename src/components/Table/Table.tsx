import * as React from 'react'
import ReactDataGrid from '@inovua/reactdatagrid-community'
import '@inovua/reactdatagrid-community/index.css'
import { ITable, IReport, IError, IDict, IRow } from '../../interfaces'

// NOTE:
// The code here is very prototypy!
// ---
// Currently, we use a simplified connection between report and table
// We rely on row/columnIndex provided by the ReactDataGrid API although
// in general it will not match row/fieldPosition we use in Frictionless
// because a header can be not on the first row etc. Also, we don't show
// extra cells ATM because `frictionless extract` doesn't return this data
// ---
// A proper implementation should be based on `frictionless extract` returning
// a Table object where rows has their context (rowPosition, errors, blank etc)
// provided as a `_row` property. We need to implement it in frictionless@5
// When it's implemented we don't need to take `report` as a prop

// TODO: move to state
// https://reactdatagrid.io/docs/miscellaneous#excel-like-cell-navigation-and-edit
let inEdit: boolean
const DEFAULT_ACTIVE_CELL: [number, number] = [0, 1]
interface TableProps {
  table: ITable
  report?: IReport
  height?: string
  updateTable?: (rowPosition: number, fieldName: string, value: any) => void
  isErrorsView?: boolean
}

export default function Table(props: TableProps) {
  const [gridRef, setGridRef] = React.useState(null)
  const { report, isErrorsView } = props
  const { fields } = props.table.schema
  const height = props.height || '600px'

  // Errors

  const errorIndex = React.useMemo(() => {
    return createErrorIndex(report)
  }, [report])
  const errorRowPositions = React.useMemo(() => {
    return createErrorRowPositions(report)
  }, [report])
  console.log(errorRowPositions)
  const errorFieldNames = React.useMemo(() => {
    return createErrorFieldNames(report)
  }, [report])
  console.log(errorFieldNames)

  // Data

  const dataSource = React.useMemo(() => {
    const dataSource: IRow[] = []
    for (const [index, row] of props.table.rows.entries()) {
      const _rowPosition = index + 2
      if (isErrorsView && !errorRowPositions.has(_rowPosition)) continue
      dataSource.push({ ...row, _rowPosition })
    }
    return dataSource
  }, [props.table.rows, isErrorsView])

  // Columns

  const columns = React.useMemo(() => {
    const rowPositionColumn = {
      name: '_rowPosition',
      header: '',
      type: 'number',
      width: 60,
      editable: false,
      textAlign: 'center' as any,
      headerAlign: 'center' as any,
      headerProps: { style: { backgroundColor: '#c5cae0' } },
      onRender: (cellProps: any) => {
        cellProps.style.background = '#EBEDF7'
        // cellProps.style.fontWeight = 'bold'
        cellProps.style.color = '#aaa'
      },
    }

    const columns = []
    for (const field of fields) {
      // TODO: support showing blank-row etc type of errors
      if (isErrorsView && errorFieldNames.size) {
        if (!errorFieldNames.has(field.name)) continue
      }

      columns.push({
        name: field.name,
        header: field.title || field.name,
        type: ['integer', 'number'].includes(field.type) ? 'number' : 'string',
        headerProps:
          field.name in errorIndex.label ? { style: { backgroundColor: 'red' } } : {},
        render: (context: any) => {
          let { value } = context
          const { cellProps, data } = context
          const rowKey = `${data._rowPosition}`
          const cellKey = `${data._rowPosition},${cellProps.name}`
          if (rowKey in errorIndex.row) cellProps.style.background = 'red'
          if (cellKey in errorIndex.cell) cellProps.style.background = 'red'
          if (cellKey in errorIndex.cell) value = errorIndex.cell[cellKey][0].cell || ''
          return value
        },
        // TODO: support the same for header/label errors
        // TODO: rebase alert to dialoge window or right panel
        cellDOMProps: (context: any) => {
          const { data, name } = context
          let error: IError | null = null
          const rowKey = `${data._rowPosition}`
          const cellKey = `${data._rowPosition},${name}`
          if (rowKey in errorIndex.row) error = errorIndex.row[rowKey][0]
          if (cellKey in errorIndex.cell) error = errorIndex.cell[cellKey][0]
          if (error) {
            return {
              onClick: () => {
                alert(error!.message)
              },
            }
          }
          return {}
        },
      })
    }

    return [rowPositionColumn, ...columns]
  }, [fields, errorIndex, isErrorsView])

  // Actions

  const onEditStart = () => {
    inEdit = true
  }

  const onEditStop = () => {
    requestAnimationFrame(() => {
      inEdit = false
      // @ts-ignore
      gridRef.current.focus()
    })
  }

  const onKeyDown = (event: any) => {
    if (inEdit) {
      return
    }
    // @ts-ignore
    const grid = gridRef.current
    let [rowIndex, colIndex] = grid.computedActiveCell

    if (event.key === ' ' || event.key === 'Enter') {
      const column = grid.getColumnBy(colIndex)
      grid.startEdit({ columnId: column.name, rowIndex })
      event.preventDefault()
      return
    }
    if (event.key !== 'Tab') {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    const direction = event.shiftKey ? -1 : 1

    const columns = grid.visibleColumns
    const rowCount = grid.count

    colIndex += direction
    if (colIndex === -1) {
      colIndex = columns.length - 1
      rowIndex -= 1
    }
    if (colIndex === columns.length) {
      rowIndex += 1
      colIndex = 0
    }
    if (rowIndex < 0 || rowIndex === rowCount) {
      return
    }

    grid.setActiveCell([rowIndex, colIndex])
  }

  const onEditComplete = (context: any) => {
    const rowPosition = context.rowId
    const fieldName = context.columnId
    // TODO: improve this logic
    const value = ['number'].includes(context.cellProps.type)
      ? parseInt(context.value)
      : context.value
    if (props.updateTable) props.updateTable(rowPosition, fieldName, value)
  }

  // TODO: support copy/paste?
  // TODO: disable selecting row number?
  const onActiveCellChange = (context: any) => {
    console.log(context)
  }

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <ReactDataGrid
        defaultActiveCell={DEFAULT_ACTIVE_CELL}
        idProperty="_rowPosition"
        handle={setGridRef as any}
        columns={columns}
        dataSource={dataSource}
        editable={true}
        onKeyDown={onKeyDown}
        onEditStart={onEditStart}
        onEditStop={onEditStop}
        onEditComplete={onEditComplete}
        onActiveCellChange={onActiveCellChange}
        style={{ height, minHeight: height, borderBottom: 'none' }}
      />
    </div>
  )
}

interface IErrorIndex {
  header: IDict<IError[]>
  label: IDict<IError[]>
  row: IDict<IError[]>
  cell: IDict<IError[]>
}

function createErrorIndex(report?: IReport) {
  const errorIndex: IErrorIndex = { header: {}, label: {}, row: {}, cell: {} }
  if (!report) return errorIndex
  const errorTask = report.tasks[0]
  if (!errorTask) return errorIndex
  for (const error of errorTask.errors) {
    if (!error.rowPosition && !error.fieldPosition) {
      const headerKey = '1'
      errorIndex.header[headerKey] = errorIndex.header[headerKey] || []
      errorIndex.header[headerKey].push(error)
    } else if (!error.rowPosition) {
      const labelKey = `${error.fieldName}`
      errorIndex.label[labelKey] = errorIndex.label[labelKey] || []
      errorIndex.label[labelKey].push(error)
    } else if (!error.fieldPosition) {
      const rowKey = `${error.rowPosition}`
      errorIndex.row[rowKey] = errorIndex.row[rowKey] || []
      errorIndex.row[rowKey].push(error)
    } else {
      const cellKey = `${error.rowPosition},${error.fieldName}`
      errorIndex.cell[cellKey] = errorIndex.cell[cellKey] || []
      errorIndex.cell[cellKey].push(error)
    }
  }
  return errorIndex
}

function createErrorRowPositions(report?: IReport) {
  const errorRowPositions = new Set()
  if (!report) return errorRowPositions
  const errorTask = report.tasks[0]
  if (!errorTask) return errorRowPositions
  for (const error of errorTask.errors) {
    if (error.rowPosition) errorRowPositions.add(error.rowPosition)
  }
  return errorRowPositions
}

function createErrorFieldNames(report?: IReport) {
  const errorFieldNames = new Set()
  if (!report) return errorFieldNames
  const errorTask = report.tasks[0]
  if (!errorTask) return errorFieldNames
  for (const error of errorTask.errors) {
    if (error.fieldName) errorFieldNames.add(error.fieldName)
  }
  return errorFieldNames
}

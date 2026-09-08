import { ColumnKey, columns, Component, units } from './types'

const normalize = (text: string) => text.toLocaleLowerCase('ru').trim()
const numberPattern = '[+-]?(?:\\d+(?:[.,]\\d*)?|[.,]\\d+)'
const numericToken = new RegExp(`^${numberPattern}$`)
const compactValue = new RegExp(`^(${numberPattern})([^\\d\\s.,+-].*)$`)

function parseNumber(text: string): number | null {
  const value = normalize(text)
  if (!numericToken.test(value)) return null
  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

// Compile once per query; numbers followed by a known unit refer to the nominal
// value, so a digit in an ID, date or quantity cannot satisfy that part of a query.
function parseSearch(query: string, additionalUnits: string[]) {
  const knownUnits = new Set([...Object.values(units).flat(), ...additionalUnits].map(normalize).filter(Boolean))
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  const words: string[] = []
  const values: { value: number; unit: string }[] = []

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    const number = parseNumber(token)
    if (number !== null && knownUnits.has(tokens[index + 1])) {
      values.push({ value: number, unit: tokens[++index] })
      continue
    }

    const compact = token.match(compactValue)
    const compactNumber = compact ? parseNumber(compact[1]) : null
    if (compact && compactNumber !== null && knownUnits.has(compact[2])) {
      values.push({ value: compactNumber, unit: compact[2] })
      continue
    }
    words.push(token)
  }

  return { words, values }
}

export function createComponentSearch(query: string, additionalUnits: string[] = []) {
  const { words, values } = parseSearch(query, additionalUnits)
  return (item: Component): boolean => {
    if (values.length && !values.every(({ value, unit }) => parseNumber(item.value) === value && normalize(item.unit) === unit)) return false
    const text = normalize(columns.map(column => item[column.key]).join(' '))
    return words.every(word => text.includes(word))
  }
}

export interface SearchFragment {
  text: string
  highlighted: boolean
}

export function createSearchHighlighter(query: string, additionalUnits: string[] = []) {
  const { words, values } = parseSearch(query, additionalUnits)

  return (item: Component, key: ColumnKey, columnFilter = ''): SearchFragment[] => {
    const text = item[key]
    const lower = text.toLocaleLowerCase('ru')
    const ranges: { start: number; end: number }[] = []
    const nominalMatch = (key === 'value' || key === 'unit') && values.some(({ value, unit }) =>
      parseNumber(item.value) === value && normalize(item.unit) === unit)
    if (nominalMatch) {
      ranges.push({ start: text.length - text.trimStart().length, end: text.trimEnd().length })
    }

    // Column filters match a whole substring; only the global query splits words.
    for (const word of new Set([...words, normalize(columnFilter)].filter(Boolean))) {
      let start = lower.indexOf(word)
      while (start !== -1) {
        ranges.push({ start, end: start + word.length })
        start = lower.indexOf(word, start + 1)
      }
    }

    ranges.sort((a, b) => a.start - b.start || a.end - b.end)
    const merged: typeof ranges = []
    for (const range of ranges) {
      const previous = merged[merged.length - 1]
      if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
      else merged.push({ ...range })
    }

    const fragments: SearchFragment[] = []
    let cursor = 0
    for (const { start, end } of merged) {
      if (start > cursor) fragments.push({ text: text.slice(cursor, start), highlighted: false })
      fragments.push({ text: text.slice(start, end), highlighted: true })
      cursor = end
    }
    if (cursor < text.length) fragments.push({ text: text.slice(cursor), highlighted: false })
    return fragments
  }
}

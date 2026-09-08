const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createComponentSearch, createSearchHighlighter } = require('../../.test-artifacts/search/search.js')

const component = (overrides = {}) => ({
  id: '11', group: 'Резистор', name: 'RC0603', value: '1', unit: 'кОм',
  tol: '1%', description: 'Тестовый компонент', case: '0603',
  manufacturer: 'Yageo', cnt: '100', cellnum: 'A-01', changed: '2026-09-01 12:00:00',
  ...overrides,
})

test('1 кОм matches the nominal value, not digits elsewhere in the row', () => {
  const rows = ['1', '10', '11', '100', '1.1', '0.1', '4.7'].map(value => component({ value }))
  assert.deepEqual(rows.filter(createComponentSearch('1 кОм')).map(row => row.value), ['1'])
  assert.equal(createComponentSearch('1 кОм')(component({ value: '10', description: 'Аналог 1 кОм' })), false)
  assert.equal(createComponentSearch('1 кОм')(component({ unit: 'МОм' })), false)
})

test('spaces, case and decimal separators do not change the nominal value', () => {
  for (const query of ['1кОм', '  1   КОМ  ', '1\u00a0кОм', '1,0 кОм', '1.00ком', '01 кОм']) {
    for (const value of ['1', '1.0', '1,00', ' 1 ']) {
      assert.equal(createComponentSearch(query)(component({ value })), true, `${query} / ${value}`)
    }
  }
  for (const query of ['4,7 кОм', '4.7кОм']) {
    assert.equal(createComponentSearch(query)(component({ value: '4.7' })), true)
    assert.equal(createComponentSearch(query)(component({ value: '4,7' })), true)
    assert.equal(createComponentSearch(query)(component({ value: '14.7' })), false)
    assert.equal(createComponentSearch(query)(component({ value: '4.75' })), false)
  }
})

test('nominal search combines with words from other fields in either order', () => {
  const row = component()
  for (const query of ['резистор 1 кОм 0603 yageo', 'YAGEO 1кОм a-01', '1 кОм резистор']) {
    assert.equal(createComponentSearch(query)(row), true, query)
  }
  assert.equal(createComponentSearch('1 кОм murata')(row), false)
  assert.equal(createComponentSearch('1 кОм 10 кОм')(row), false)
})

test('nominal search covers all configured units and units already in the inventory', () => {
  for (const unit of ['Ом', 'кОм', 'МОм', 'пФ', 'мкФ', 'мкГн', 'Гн']) {
    assert.equal(createComponentSearch(`0,1${unit}`)(component({ value: '0.1', unit })), true)
    assert.equal(createComponentSearch(`0,1 ${unit}`)(component({ value: '10.1', unit })), false)
  }
  assert.equal(createComponentSearch('100 нФ', ['нФ'])(component({ value: '100', unit: 'нФ' })), true)
  assert.equal(createComponentSearch('100нФ', ['нФ'])(component({ value: '1000', unit: 'нФ' })), false)
})

test('missing and nonnumeric values cannot match a numeric nominal', () => {
  for (const value of ['', ' ', '1 кОм', '1/4', 'NaN', 'Infinity', '1abc']) {
    assert.equal(createComponentSearch('1 кОм')(component({ value })), false, value)
    assert.equal(createComponentSearch('0 кОм')(component({ value })), false, value)
  }
  assert.equal(createComponentSearch('0 Ом')(component({ value: '0', unit: 'Ом' })), true)
})

test('ordinary searches keep matching across fields, including names with digits', () => {
  const row = component({ name: '1N4148', description: 'Партия 1 шт.' })
  for (const query of ['', '  ', 'кОм', 'резистор yageo', '0603 A-01', '1n414', '1 шт.', '2026-09']) {
    assert.equal(createComponentSearch(query)(row), true, query)
  }
  assert.equal(createComponentSearch('несуществующий')(row), false)
})

test('nominal highlights use the stored value and unit, without highlighting unrelated digits', () => {
  const row = component({ value: '1,00' })
  const highlight = createSearchHighlighter('1кОм 0603')
  assert.deepEqual(highlight(row, 'value'), [{ text: '1,00', highlighted: true }])
  assert.deepEqual(highlight(row, 'unit'), [{ text: 'кОм', highlighted: true }])
  assert.deepEqual(highlight(row, 'id'), [{ text: '11', highlighted: false }])
  assert.deepEqual(highlight(row, 'name'), [{ text: 'RC', highlighted: false }, { text: '0603', highlighted: true }])
  assert.deepEqual(highlight(component({ value: '10' }), 'value'), [{ text: '10', highlighted: false }])
})

test('highlights merge overlaps, preserve original text and combine with literal column filters', () => {
  const row = component({ description: '  RC0603 / rc0603 [1%]  ', manufacturer: 'RC0603' })
  const highlight = createSearchHighlighter('060 603')
  assert.deepEqual(highlight(row, 'description', 'RC0603 /'), [
    { text: '  ', highlighted: false }, { text: 'RC0603 /', highlighted: true },
    { text: ' rc', highlighted: false }, { text: '0603', highlighted: true },
    { text: ' [1%]  ', highlighted: false },
  ])
  assert.deepEqual(createSearchHighlighter('[1%]')(row, 'description'), [
    { text: '  RC0603 / rc0603 ', highlighted: false },
    { text: '[1%]', highlighted: true }, { text: '  ', highlighted: false },
  ])
  assert.deepEqual(createSearchHighlighter('')(row, 'description'), [{ text: row.description, highlighted: false }])
  assert.deepEqual(createSearchHighlighter('')(row, 'description', 'rc0603 /'), [
    { text: '  ', highlighted: false }, { text: 'RC0603 /', highlighted: true },
    { text: ' rc0603 [1%]  ', highlighted: false },
  ])
  assert.deepEqual(createSearchHighlighter('')(row, 'manufacturer'), [{ text: 'RC0603', highlighted: false }])
})

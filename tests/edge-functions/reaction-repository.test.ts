import assert from 'node:assert/strict'
// This standalone edge-function test deliberately uses Node's built-in runner.
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  applyReaction,
  getReactionStorageKey,
  isValidReaction,
  isValidRefKey,
  parseReactions,
} from '../../edge-functions/api/reactions/repository'

test('parseReactions accepts stored JSON', () => {
  assert.deepEqual({ ...parseReactions('{"reactions":{"👍":2,"🔥":0}}') }, { '👍': 2 })
  assert.deepEqual({ ...parseReactions({ '😍': 3 }) }, { '😍': 3 })
})

test('parseReactions rejects malformed and unsafe values', () => {
  assert.deepEqual({ ...parseReactions('{') }, {})
  assert.deepEqual({ ...parseReactions({ reactions: { constructor: 9, safe: -1 } }) }, {})
})

test('applyReaction adds, removes, and deletes zero counts without mutating input', () => {
  const original = { '👍': 1 }
  const added = applyReaction(original, '👍', 'add')
  const removed = applyReaction(original, '👍', 'remove')

  assert.deepEqual(original, { '👍': 1 })
  assert.deepEqual({ ...added }, { '👍': 2 })
  assert.deepEqual({ ...removed }, {})
})

test('storage keys use an isolated Blob namespace', () => {
  assert.equal(getReactionStorageKey('photo/id'), 'reactions/photo%2Fid.json')
})

test('request values are bounded before reaching Blob storage', () => {
  assert.equal(isValidRefKey('photo-id'), true)
  assert.equal(isValidRefKey(''), false)
  assert.equal(isValidRefKey('x'.repeat(257)), false)
  assert.equal(isValidReaction('🔥'), true)
  assert.equal(isValidReaction('__proto__'), false)
})

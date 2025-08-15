// 匹配结尾为 0 的数字
export let tailZeroRep = /(?<=[1-9])0+(?![0-9])/

// @example 行分割
// let breakLinks = /(.{0,18})(?:\s|$)/g
// const text = 'A quick brown fox jumps over the lazy dog.'
// let lines = text.split(breakLinks).filter(Boolean)
// ['A quick brown', 'fox jumps over', 'the lazy dog.']
export let breakLinks = /(.{0,25})(?:\s|$)/g
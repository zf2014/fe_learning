export function trimTailZero (str: string) {
  return str ? str.replace(/(?<=[1-9])?0+(?![0-9])/, '') : ''
}
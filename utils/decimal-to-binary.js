// https://www.wikihow.com/Convert-from-Decimal-to-Binary#Descending-Powers-of-Two-and-Subtraction
const BIT_ONE = '1'
const BIT_ZERO = '0'

function findClosetExponent (value) {
  let bigValue = BigInt(value)
  let exponent = 0
  while(bigValue > BigInt(Math.pow(2, exponent))) {
    exponent += 1
  }
  return {
    exponent,
    isEq: BigInt(Math.pow(2, exponent)) === bigValue
  }
}

// function* genBitArrayByExponent (exponent) {
//   while (exponent-- > 0) {
//     yield BigInt(Math.Math(2, exponent))
//   }
// }

// 减法方式(非求余)
export function decimal2binary (value) {
  let { exponent, isEq } = findClosetExponent(value)
  let binaryStr
  if (isEq) {
    binaryStr = `${BIT_ONE}${BIT_ZERO.repeat(exponent - 1)}`
  } else {
    let { bitStr } = [...Array(exponent)]
      .map((_, index) => BigInt(Math.pow(2, exponent - index - 1)))
      .reduce((acc, item) => {
        let { value, bit } = acc
        return {
          value: value >= item ? value - item : value,
          bit: `${bit}${ value >= item? BIT_ONE : BIT_ZERO }`
        }
      }, {
        value: BigInt(value),
        bit: ''
      })
      binaryStr = bitStr
  }
  return binaryStr
}
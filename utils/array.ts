// 根据拼音排序
console.log(['我', '你', '他', '她'].sort(new Intl.Collator('pinyin').compare));
// Expected output: Array ["支持", "知道", "自己", "自我"]
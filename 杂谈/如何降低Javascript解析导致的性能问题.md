## 如何降低Javascript解析导致的性能问题

1.尽量减少代码量
2.将代码碎片化(模块化),并且采用按需加载的模式
3.利用Script streaming: prefetch/preload
4.尽量使用精确模块,减少依赖消耗
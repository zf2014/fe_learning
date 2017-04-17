### CommonsChunkPlugin
```javascript
var webpack = require('webpack');
var path = require('path');

module.exports = function() {
    return {
        entry: {
            main: './index.js'
        },
        output: {
            filename: '[name].[chunkhash].js',
            path: path.resolve(__dirname, 'dist')
        },
        plugins: [
            new webpack.optimize.CommonsChunkPlugin({
                name: 'vendor',
                minChunks: function (module) {
                   // this assumes your vendor imports exist in the node_modules directory
                   return module.context && module.context.indexOf('node_modules') !== -1;
                }
            })
        ]
    };
}​
```

webpack代码生产机制: chunk code = runtime code + raw code;

CommonsChunkPlugin => 根据提供的name/names属性来查找已有的chunk.
如果没有发现, 则可以理解为生产一个只包含runtime code的同名chunk. 然后再从所有的chunks中找到合适的共用chunk.
如果发现, 则依次逐渐深入提取共用chunk.


```javascript
getExtractableModules(minChunks, usedChunks, targetChunk) {
	if(minChunks === Infinity) {
		return [];
	}

	// count how many chunks contain a module
	const commonModulesToCountMap = usedChunks.reduce((map, chunk) => {
		for(let module of chunk.modules) {
			const count = map.has(module) ? map.get(module) : 0;
			map.set(module, count + 1);
		}
		return map;
	}, new Map());

	// filter by minChunks
	const moduleFilterCount = this.getModuleFilter(minChunks, targetChunk, usedChunks.length);
	// filter by condition
	const moduleFilterCondition = (module, chunk) => {
		if(!module.chunkCondition) {
			return true;
		}
		return module.chunkCondition(chunk);
	};

	return Array.from(commonModulesToCountMap).filter(entry => {
		const module = entry[0];
		const count = entry[1];
		// if the module passes both filters, keep it.
		return moduleFilterCount(module, count) && moduleFilterCondition(module, targetChunk);
	}).map(entry => entry[0]);
}
```

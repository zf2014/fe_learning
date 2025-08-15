// 自动切换收藏图标
export function autoHiddenFavicon () {
  let el: Element = document.querySelector('link[rel="icon"]')!
  document.addEventListener("visibilitychange", () => {
    const hidden = document.hidden
    el?.setAttribute(
      "href",
      `/favicon${hidden ? "-hidden" : ""}.ico`
    )
  })
}

// 文本另存为
export function saveTextAsFile (text: string, fileName, fileType) {
  let textFileAsBlob = new Blob([text], { type: fileType });
    let downloadLink = document.createElement('a');
    downloadLink.download = fileName;
    downloadLink.innerHTML = '下载链接';
    if (window.webkitURL != null) {
        downloadLink.href = window.webkitURL.createObjectURL(
            textFileAsBlob
        );
    } else {
        downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
    }
    downloadLink.click();
}
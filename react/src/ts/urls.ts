const meta = document.querySelector<HTMLMetaElement>('meta[name="componentdb-base-path"]')
const basePath = (meta?.content || '').replace(/\/+$/, '')

/** Build a URL inside the application's reverse-proxy mount point. */
export function appPath(path = '/') {
  return `${basePath}/${path.replace(/^\/+/, '')}`
}

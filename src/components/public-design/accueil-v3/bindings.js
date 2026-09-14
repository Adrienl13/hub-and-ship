// Small DOM binder: native templates, stable nodes, property paths only, no eval.
const token = /{{\s*([\w.]+)\s*}}/g
const valueAt = (scope, path) =>
  path === 'true'
    ? true
    : path === 'false'
      ? false
      : path.split('.').reduce((v, key) => v?.[key], scope)
const fill = (text, scope) =>
  text.replace(token, (_, path) => String(valueAt(scope, path) ?? ''))

export function bind(root) {
  const updates = []
  const visit = (node) => {
    if (node.nodeType === 3) {
      const text = node.textContent
      if (text.includes('{{'))
        updates.push((scope) => {
          const next = fill(text, scope)
          if (node.textContent !== next) node.textContent = next
        })
      return
    }
    if (node.nodeType !== 1) return
    if (node.hasAttribute('data-bound-text')) {
      const template = node.getAttribute('data-bound-text')
      updates.push((scope) => {
        node.textContent = fill(template, scope)
      })
      return
    }
    if (node.tagName === 'TEMPLATE') {
      const rows = []
      updates.push((scope) => {
        const items = node.dataset.list
          ? valueAt(scope, node.dataset.list) || []
          : valueAt(scope, node.dataset.if)
            ? [scope]
            : []
        while (rows.length > items.length)
          rows.pop().nodes.forEach((n) => n.remove())
        items.forEach((item, i) => {
          if (!rows[i]) {
            const fragment = node.content.cloneNode(true)
            const nodes = [...fragment.childNodes]
            const update = bind(fragment)
            node.parentNode.insertBefore(fragment, node)
            rows.push({ nodes, update })
          }
          rows[i].update(
            node.dataset.as ? { ...scope, [node.dataset.as]: item } : scope,
          )
        })
      })
      return
    }
    for (const attr of [...node.attributes]) {
      if (attr.name === 'data-bound-src' || attr.name === 'data-bound-href') {
        const name = attr.name.slice(11)
        updates.push((scope) => {
          const next = fill(attr.value, scope)
          if (next && node.getAttribute(name) !== next)
            node.setAttribute(name, next)
          else if (!next) node.removeAttribute(name)
        })
      } else if (attr.name.startsWith('data-on')) {
        let scope
        node.addEventListener(attr.name.slice(7), (event) =>
          valueAt(scope, attr.value)?.(event),
        )
        updates.push((next) => {
          scope = next
        })
      } else if (attr.value.includes('{{')) {
        const template = attr.value
        updates.push((scope) => {
          const next = fill(template, scope)
          if (attr.name === 'src' && node.tagName === 'IMG' && !next) {
            node.removeAttribute('src')
            node.dataset.unavailable = ''
            return
          }
          if (node.getAttribute(attr.name) !== next) {
            node.setAttribute(attr.name, next)
            if (attr.name === 'src') delete node.dataset.unavailable
          }
          if (attr.name === 'value' && node.value !== next) node.value = next
        })
      }
    }
    if (node.tagName === 'IMG')
      node.addEventListener('error', () => {
        node.dataset.unavailable = ''
      })
    ;[...node.childNodes].forEach(visit)
  }
  ;[...root.childNodes].forEach(visit)
  return (scope) => updates.forEach((update) => update(scope))
}

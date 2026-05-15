/**
 * @template {keyof HTMLElementTagNameMap} K
 * @typedef {Object} HOptions
 * @property {Partial<Omit<HTMLElementTagNameMap[K], "style" | "dataset" | "classList">>} [props]
 *   Direct properties on the element: textContent, value, checked, href, disabled, etc.
 * @property {Partial<CSSStyleDeclaration>} [style]
 *   Inline styles.
 * @property {Record<string, string>} [attrs]
 *   Attributes that aren't properties: aria-*, role, custom attrs.
 * @property {Record<string, string>} [data]
 *   Dataset entries (becomes data-* attributes).
 * @property {string | string[]} [class]
 *   Class name(s). String or array, joined with spaces.
 * @property {Partial<GlobalEventHandlersEventMap>} [on]
 *   Event listeners, keyed by event name without the "on" prefix: { click, input, keydown }.
 */

/**
 * @typedef {Node | string} HChild
 */

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {HOptions<K>} [options]
 * @param {HChild | HChild[]} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, options = {}, children) {
  const el = document.createElement(tag);
  const { props, style, attrs, data, class: klass, on } = options;

  if (props) Object.assign(el, props);
  if (style) Object.assign(el.style, style);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) Object.assign(el.dataset, data);
  if (klass) el.className = Array.isArray(klass) ? klass.join(" ") : klass;
  if (on) {
    for (const [event, handler] of Object.entries(on)) {
      el.addEventListener(event, handler);
    }
  }

  if (children != null) {
    el.append(...(Array.isArray(children) ? children : [children]));
  }

  return el;
}
/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Partial<HTMLElementTagNameMap[K]> & { style?: Partial<CSSStyleDeclaration>, dataset?: Record<string, string> }} [props]
 * @param {(Node | string)[]} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === "style" && typeof v === "object") {
            Object.assign(el.style, v);
        } else if (k === "dataset" && typeof v === "object") {
            Object.assign(el.dataset, v);
        } else if (k in el) {
            // covers className, textContent, onclick, value, checked, etc.
            el[k] = v;
        } else {
            el.setAttribute(k, String(v));
        }
    }
    for (const c of children) {
        el.append(c); // append handles strings and Nodes
    }
    return el;
}
import { h } from "../util/hyperscript.js";


export class Component{
    /** @type {HTMLElement} */
    host;

    /**
     * 
     * @param {HTMLElement} host 
     */
    constructor(host){
        this.host = host;
    }

    /**
     * 
     * @param {HTMLElement} parent 
     */
    append_to(parent){
        if (this.host){
            parent.appendChild(this.host);
        }
    }
}

export class EntryManager extends Component {
    /** @type {HTMLElement} */
    body;

    /**
     * 
     * @param {string} label 
     * @param {Parameters<typeof h>[2]} content 
     */
    constructor(label, content){
        let body;
        super(h("div",{class:"entry"},[
            h("div", { class: "label" }, label),
            body=h("div",{class:"body"}, content)
        ]))
        this.body = body;
    }
}
import { h } from "../util/hyperscript.js";
import { Component } from "./Component.js";


export class Entry extends Component {
    body:HTMLElement;
    constructor(label:string, content:Parameters<typeof h>[2]){
        let body;
        super(h("div",{class:"entry"},[
            h("div", { class: "label" }, label),
            body=h("div",{class:"body"}, content)
        ]))
        this.body = body;
    }
}

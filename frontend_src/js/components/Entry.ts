import { h } from "../util/hyperscript.js";
import { Component } from "./Component.js";

export type EntryType = "user"|"assistant"|"tool_call"|"done"|"error";

const LOOKUP:Record<EntryType, [string,string]> = {
    "user":["User","user"],
    "assistant":["Assistant","assistant"],
    "tool_call":["Tool Call","tool_call"],
    "done":["Done","done"],
    "error":["Error","error"],
}

export class Entry extends Component {
    body:HTMLElement;
    constructor(entry_type:EntryType, content:Parameters<typeof h>[2]){
        
        const [label, klass] = LOOKUP[entry_type];

        let body;
        super(h("div",{class:[klass,"entry"]},[
            h("div", { class: "label" }, label),
            body=h("div",{class:"body"}, content)
        ]))
        this.body = body;
    }
}

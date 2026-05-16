import { h } from "../util/hyperscript";
import { Component } from "./Component";
import logoman from "../../img/logoman.svg";

export class MainLayout extends Component {
    log:HTMLDivElement
    form:HTMLFormElement
    input:HTMLInputElement
    send:HTMLButtonElement
    constructor(host:HTMLElement){
        
        super(host);
        
        this.host.appendChild(h("div",{style:{position:"relative",height:"10em"}},[
            h("h2",{},"NAgent"),
            h("img",{attrs:{src:logoman}, style:{
                position:"absolute",
                right:"1em",
                top:"-1em",
                height:"13em",
                zIndex:"-20",
            }})
        ]));

        this.log = h("div",{attrs:{id:"log"}});
        this.input = h("input",{attrs:{id:"input", type:"text", placeholder:"Say something...", autocomplete:"off", required:"true"}})
        this.send = h("button", {attrs:{id:"send", type:"submit"}},"Send")
        this.form = h("form", {attrs:{id:"form"}},[
            this.input,this.send
        ]);
        
        this.host.appendChild(this.log)
        this.host.appendChild(this.form)

    }
}
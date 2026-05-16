import { h } from "../util/hyperscript";

export function add_suggested_questions(
    host:HTMLElement,
    set_value:(value:string)=>void,
    pad_top:boolean,
){
    
    const suggestion = (value:string) => {
        return h("button",{
            on:{
                click(){
                    this.parentElement?.remove()
                    set_value(value);
                }
            }
        },[value])
    }

    const sb = h("div",{
        style:{
            "minHeight":pad_top?"100%":undefined,
            "display":"grid",
            "gridTemplateRows":"1fr",
            "gridAutoRows":"auto",
            "gap":"0.5em",
            "marginBottom":"1em"
        }
    },[
        h("div"),
        suggestion("What can you do?"),
        suggestion("Who works here?"),
        suggestion("Who is Bob?"),
        suggestion("Does Bob or Dana have access to a larger budget?"),
        suggestion("Please transfer bob's unspent budget to dana."),
        suggestion("Please add 10k to budget B-2026-01"),
        suggestion("please increment the dummy counter as two tool calls in the same turn"),
    ])
    
    host.appendChild(sb);

    return sb
}

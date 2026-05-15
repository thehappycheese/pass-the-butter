
export function add_suggested_questions(
    host:HTMLElement,
    set_value:(value:string)=>void
){
    const controller = new AbortController();
    const { signal } = controller;

    const sb = document.createElement("div");
    sb.setAttribute("style","min-height:100%; display:grid; grid-template-rows: 1fr; grid-auto-rows:auto; gap:0.5em; margin-bottom: 1em;")
    const padder = document.createElement("div");
    sb.appendChild(padder);
    host.appendChild(sb);

    /** @type {(value:string)=>void} */
    const add_suggestion = (value)=> {
        const button = document.createElement("button");
        button.textContent = value;
        sb.appendChild(button);
        button.addEventListener("click",()=>{
            controller.abort()
            sb.remove()
            set_value(value)
        }, {signal});
    }
    add_suggestion("What can you do?")
    add_suggestion("Who works here?")
    add_suggestion("Who is Bob?")
    add_suggestion("Does Bob or Dana have access to a larger budget?")
    add_suggestion("Please transfer bob's unspent budget to dana.")
    add_suggestion("Please add 10k to budget B-2026-01")
    add_suggestion("please increment the dummy counter as two tool calls in the same turn")
    return sb

}
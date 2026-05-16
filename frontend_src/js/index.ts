import { LogView } from "./core/log_view.js";
import { endpoint_resume, endpoint_stream } from "./core/api.js";
import { add_suggested_questions } from "./core/add_suggested_questions.js";
import { flow_text_into_input } from "./util/flow_text_into_input.js";
import { delay } from "./util/delay.js";
import { h } from "./util/hyperscript.js";
import { Entry } from "./components/Entry.js";
import { FunctionCall } from "./components/FunctionCall.js";
import "./index.css"
import { MainLayout } from "./components/MainLayout.js";


// const SESSION_ID = crypto.randomUUID();

const SESSION_ID = "7"; // guaranteed random, chosen by fair dice


const main_layout = new MainLayout(document.body);

const logview = new LogView(
    main_layout.log,
    (approvals) => {
        logview.train_of_thunk.enqueue(async () => 
            await  endpoint_resume(approvals, SESSION_ID)
        )
    }
);


main_layout.form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = main_layout.input.value.trim();
    if (!message) return;
    main_layout.input.value = "";
    main_layout.send.disabled = true;
    logview.add_entry("user", "user", message);
    logview.train_of_thunk.enqueue(async () => await endpoint_stream(message, SESSION_ID));
    try {
        await logview.think();
    } finally {
        main_layout.send.disabled = false;
        main_layout.input.focus();
    }
});

main_layout.input.focus();


export async function thread_history(session_id:string){
    const response = await fetch("/thread_history",{
        method:"POST",
        headers: { "Content-Type": "application/json" },
        body:JSON.stringify({session_id})
    })
    return await response.json();
}
async function startup(){
    const history = await thread_history(SESSION_ID);
    const entries:Entry[] = [];
    const tool_call_ids:Record<string,Entry> = {};
    for(const message of history["messages"]){
        
        switch (message["role"]){
            case "user":
                entries.push(new Entry("user", message["content"]))
                break
            case "assistant":
                if (message["content"]){
                    entries.push(new Entry("assistant", message["content"]))
                }
                if (message["metadata"]["tool_calls"]){
                    for (const tool_call of message["metadata"]["tool_calls"]){
                        const e = new Entry(
                            "tool_call",
                            new FunctionCall(tool_call["name"],tool_call["args"]).dom(),
                        )
                        tool_call_ids[tool_call["id"]] = e;
                        entries.push(e)
                    }
                }
                break
            case "tool":
                const e = tool_call_ids[message["tool_call_id"]] ?? new Entry("tool_call","UNKNOWN()");
                e.body.appendChild(h("div",{},["Result: "+message["content"]]));
                break
        }
    }
    for(const entry of entries){
        entry.append_to(main_layout.log)
    }
    add_suggested_questions(
        main_layout.log,
        async (value)=>{
            await flow_text_into_input(value, (text)=>main_layout.input.value=text)
            await delay(100);
            main_layout.send.click()
        },
        history["messages"].length==0
    )
    logview.scroll_bottom()
}
startup();
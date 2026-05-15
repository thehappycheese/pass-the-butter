import { LogView } from "./core/log_view.js";
import { endpoint_resume, endpoint_stream } from "./core/api.js";
import { add_suggested_questions } from "./core/add_suggested_questions";
import { flow_text_into_input } from "./util/flow_text_into_input";
import { delay } from "./util/delay";

const SESSION_ID = crypto.randomUUID();


const log:HTMLDivElement = document.getElementById("log")!;
const form:HTMLDivElement = document.getElementById("form")!;
const input:HTMLInputElement = document.getElementById("input")!;
const send:HTMLButtonElement = document.getElementById("send")!;


const logview = new LogView(
    log,
    (approvals) => {
        logview.train_of_thunk.enqueue(async () => 
            await  endpoint_resume(approvals, SESSION_ID)
        )
    }
);

add_suggested_questions(
    log,
    async (value)=>{
        await flow_text_into_input(value, (text)=>input.value=text)
        await delay(100);
        send.click()
    }
)


form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    send.disabled = true;
    logview.add_entry("user", "user", message);
    logview.train_of_thunk.enqueue(async () => await endpoint_stream(message, SESSION_ID));
    try {
        await logview.think();
    } finally {
        send.disabled = false;
        input.focus();
    }
});

input.focus();
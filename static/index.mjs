"use strict";
import { iter_sse } from "./core/sse.mjs";
import { LogView } from "./core/log_view.mjs";
import { endpoint_resume, endpoint_stream } from "./core/api.mjs";

const SESSION_ID = crypto.randomUUID();

/** @type {HTMLDivElement} */
const log = document.getElementById("log");
/** @type {HTMLFormElement} */
const form = document.getElementById("form");
/** @type {HTMLInputElement} */
const input = document.getElementById("input");
/** @type {HTMLButtonElement} */
const send = document.getElementById("send");




const logview = new LogView(
    log,
    (approvals) => {
        logview.train_of_thunk.enqueue(async () => 
            await  endpoint_resume(approvals, SESSION_ID)
        )
    }
);

/**
 * 
 * @param {HTMLElement} host 
 * @param {(value:string)=>void} set_value
 */
function add_suggested_questions(host, set_value){
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

/**
 * @param {number} ms milliseconds
 */
async function delay(ms){
    await new Promise(resolve=>setTimeout(resolve,ms));
}

/**
 * 
 * @param {string} text 
 * @param {(text:string)=>void} consumer
 */
async function flow_text_into_input(text, consumer){
    if(text.length===0) return;
    for (let pointer=1;pointer<=text.length;pointer++){
        consumer(text.slice(0,pointer))
        await delay(15);
    }
}

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
    // } catch (err) {
    //     logview.add_entry("error", "error", String(err));
    } finally {
        send.disabled = false;
        input.focus();
    }
});

input.focus();
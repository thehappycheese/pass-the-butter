import { Queue } from "./queue.mjs";

/**
 * 
 * @param {string} name name of the function
 * @param {Record<string,any>} args Named Arguments passed to the function
 * @returns A formatted multi line string that looks more like a python function call than json
 */
const function_format = (name, args)=>
    `${name}${Object.keys(args).length === 0 ? '()' : `(\n${Object.entries(args).map(([k, v]) => `  ${k} = ${JSON.stringify(v)},`).join("\n")}\n)`}`


class MessageDom {
    /** @type {HTMLDivElement} */
    host
    /** @type {HTMLDivElement} */
    label
    /** @type {HTMLDivElement} */
    body

    /**
     * @param {HTMLDivElement} host
     * @param {HTMLDivElement} label
     * @param {HTMLDivElement} body
     */
    constructor(host, label, body) {
        this.host = host;
        this.label = label;
        this.body = body;
    }
}

export class LogView {
    /**
     * @type {Queue<() => Promise<AsyncGenerator>>} Thunks that will be thought
     */
    train_of_thunk;

    /** @type {boolean} if the think() method is currently working this internal flag stops it from retriggering */
    thinking;
    /**
     * @type {MessageDom[]}
     */
    message_log;

    /** @type {Record<string, MessageDom>}*/
    tool_calls;

    /**
     * @type {HTMLElement} element where the log will be rendered
     */
    host

    /**
     * @param {HTMLElement} host Element where the log will be rendered
     */
    constructor(host) {
        this.train_of_thought = [];
        this.thinking = false;
        this.message_log = [];
        this.tool_calls = {};
        this.train_of_thunk = new Queue();
        this.host = host;
    }

    scroll_bottom(){
        this.host.scrollTop = this.host.scrollHeight;
    }

    /**
     * @param {string} id
     * @param {string} name
     * @param {Record<string,any>} args
     * @returns {MessageDom}
     */
    add_tool_call(id, name, args) {
        const dom = this.add_entry(
            "tool_call",
            "Tool Call",
            function_format(name, args)
        );
        this.tool_calls[id] = dom;
        return dom
    }

    /**
     * @param {string} id
     * @param {string} message
     * @returns {MessageDom}
     */
    add_tool_call_result(id, message) {
        const dom = this.tool_calls?.[id] ?? this.add_tool_call(
            id,
            "unknown",
            {}
        )
        dom.body.textContent += "\n\n"
        dom.body.textContent += "Result: "+message
        this.scroll_bottom();
        return dom
    }

    /**
     * 
     * @param {string} id tool call id
     * @param {string} message 
     * @param {(approved:boolean) => void } resume
     */
    add_request_for_approval(id, message, resume){
        const dom = this.tool_calls?.[id] ?? this.add_tool_call(
            id,
            `unknown (Requerst for Approval looked for tool call id ${id}`,
            {}
        )
        dom.body.textContent += "\n\n"
        
        const approval_form = document.createElement("div")
        approval_form.className = "approval_form";
        dom.body.appendChild(approval_form)

        approval_form.textContent += "Request For Approval:\n\n" + message+"\n";

        const approve_button = document.createElement("button");
        approve_button.textContent = "APPROVE"
        const deny_button = document.createElement("button");
        deny_button.textContent = "DENY"

        approval_form.appendChild(approve_button);
        approval_form.appendChild(deny_button);

        const on_approve = ()=>{
            approval_form.remove();
            resume(true);
            dom.body.textContent += "User Action: APPROVED TOOL CALL";
            this.think({resume})
        }
        const on_deny = ()=>{
            approval_form.remove();
            resume(false);
            dom.body.textContent += "User Action: DENIED TOOL CALL";
            this.think({resume})
        }
        approve_button.addEventListener("pointerdown",on_approve)
        deny_button.addEventListener("pointerdown",on_deny)
        this.scroll_bottom();
        return dom;
    }

    /**
     * @param {string} cls css class
     * @param {string} label heading
     * @param {string} text body content
     */
    add_entry(cls, label, text) {
        const div = document.createElement("div");
        div.className = "entry " + cls;
        const l = document.createElement("div");
        l.className = "label";
        l.textContent = label;
        const b = document.createElement("div");
        b.className = "body";
        b.textContent = text;
        div.appendChild(l);
        div.appendChild(b);

        this.host.appendChild(div);
        this.scroll_bottom();

        const msg_dom = new MessageDom(div, l, b);

        this.message_log.push(msg_dom);

        return msg_dom;
    }

    /**
     * @typedef {Object} StreamMessage
     * @property {string} event
     * @property {any} data
     */

    /**
     * @param {AsyncGenerator<StreamMessage>} events
     * @param {{ resume:(approved:boolean) => void }} options
     */
    async handle_stream(
        events,
        { resume },
    ) {

        /** @type {MessageDom|null} */
        let assistant_body = null;

        for await (const { event, data } of events) {
            if (event === "token") {
                if (!assistant_body) {
                    assistant_body = this.add_entry("assistant", "assistant", "");
                }
                assistant_body.body.textContent += data.text;
                this.scroll_bottom();
            } else {
                assistant_body = null;  // next token starts a new bubble
                if (event === "tool_call") {
                    this.add_tool_call(
                        data.id,
                        data.name,
                        data.args,
                    );
                } else if (event === "tool_result") {
                    this.add_tool_call_result(data.id, data.content);
                } else if (event === "update") {
                    this.add_entry("update", "update",
                        `${data.nodes.join(", ")}  ${data.namespace.length ? "[" + data.namespace.join("/") + "]" : ""}`);
                } else if (event === "custom") {
                    this.add_entry("update", "custom", JSON.stringify(data));
                } else if (event === "error") {
                    this.add_entry("error", "error", data.message);
                } else if (event === "done") {
                    this.add_entry("done", "done", "");
                } else if (event === "approval_required") {
                    const { tool, args, tool_call_id } = data;
                    this.add_request_for_approval(
                        tool_call_id,
                        function_format(tool, args),
                        resume,
                    )
                } else {
                    this.add_entry("unknown", "event", JSON.stringify(data));
                }
            }
        }
    }

    /**
     *  @param {{resume:(approved:boolean)=>void}} options
     */
    async think({ resume }) {
        if (this.thinking) {
            return
        }
        this.thinking = true;
        while (this.train_of_thunk.not_empty()) {
            const next = this.train_of_thunk.dequeue();
            if (!next) break;
            await this.handle_stream(
                await next(),
                { resume }
            );
        }
        this.thinking = false;
    }
}
import { Queue } from "../util/queue.js";
import { h } from "../util/hyperscript.js";

/**
 * 
 * @param {string} name name of the function
 * @param {Record<string,any>} args Named Arguments passed to the function
 * @returns A formatted multi line string that looks more like a python function call than json
 */
const function_format = (name, args) =>
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

/** @typedef {(approvals:Record<string, ApprovalStateResolved>) => void} ResumeFunc Pass in map of bools from tool_call_id to approved status to resume the stream */

/**
 * @typedef {Object} StreamMessage
 * @property {string} event
 * @property {any} data
 */

/**
 * @typedef {object} ApprovalState
 * @property {string} tool_call_id
 * @property {string} interrupt_id
 * @property {null|boolean} approved
 */
/**
 * @typedef ApprovalStateResolved
 * @property {string} tool_call_id
 * @property {string} interrupt_id
 * @property {boolean} approved
 */

/**
 * 
 * @param {ApprovalState} approval_state
 * @returns {approval_state is ApprovalStateResolved}
 */
export function approval_is_resolved(approval_state) {
    return approval_state.approved!==null;
}

/**
 * 
 * @param {Record<string, ApprovalState>} approvals 
 * @returns {approvals is Record<string, ApprovalStateResolved>}
 */
export function approvals_all_resolved(approvals){
    return Object.values(approvals).every(i=>i.approved!==null);
}


export class LogView {

    /** @type {ResumeFunc} */
    resume;

    /**
     * @type {Queue<() => Promise<import("../util/sse.js").AsyncIterSSE>>} Thunks that will be thought
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

    /** @type {null|Record<string, ApprovalState>} */
    approvals;

    /**
     * @type {HTMLElement} element where the log will be rendered
     */
    host

    /**
     * @param {HTMLElement} host Element where the log will be rendered
     * @param {(approvals:Record<string, ApprovalState>) => void} resume
     */
    constructor(host, resume) {
        this.resume = resume;
        this.host = host;
        this.approvals = null;
        this.thinking = false;
        this.message_log = [];
        this.tool_calls = {};
        this.train_of_thunk = new Queue();
    }

    scroll_bottom() {
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
     * @param {string} tool_call_id
     * @param {string} message
     * @returns {MessageDom}
     */
    add_tool_call_result(tool_call_id, message) {
        const dom = this.tool_calls?.[tool_call_id] ?? this.add_tool_call(
            tool_call_id,
            "unknown",
            {}
        )
        
        dom.body.appendChild(h("div",{class:"tool_call_result"},"Result: "+message))
        this.scroll_bottom();
        return dom
    }

    /**
     * 
     * @param {string} tool_call_id
     */
    add_request_for_approval(tool_call_id) {
        const dom = this.tool_calls?.[tool_call_id] ?? this.add_tool_call(
            tool_call_id,
            `unknown (Request for Approval looked for tool call id ${tool_call_id})`,
            {}
        )

        const on_approve = () => {
            approval_form.remove();
            this.set_approval_result(tool_call_id, true);
            dom.body.append(h("div",{class:"approval_form_user_approved"},
                "User Action: APPROVED TOOL CALL"));
        }
        const on_deny = () => {
            approval_form.remove();
            this.set_approval_result(tool_call_id, false);
            dom.body.append(h("div",{class:"approval_form_user_denied"},
                "User Action: DENIED TOOL CALL"));
        }

        const approval_form = h("div", {
            class:"approval_form",
        },[
            h("div",{},"Allow this tool to run:"),
            h("div",{
                style:{
                    display:"flex",
                    gap:"2em",
                }
            },[
                h("button",{on:{click:on_approve}},"YES"),
                h("button",{on:{click:on_deny}},"NO")
            ])
        ])

        dom.body.appendChild(approval_form);
        this.scroll_bottom();
        return dom;
    }

    /**
     * 
     * @param {string} tool_call_id 
     * @param {boolean} result 
     */
    set_approval_result(tool_call_id, result) {
        if (this.approvals === null || !(tool_call_id in this.approvals)) {
            throw new Error(`unexpected approval ${tool_call_id} ${result}`)
        }
        this.approvals[tool_call_id].approved = result;
        if (approvals_all_resolved(this.approvals)) {
            this.resume(this.approvals);
            this.clear_approvals()
            this.think()
        }
    }

    /**
     * 
     * @param {string} tool_call_id 
     * @param {string} interrupt_id
     */
    init_approval(tool_call_id, interrupt_id) {
        const a = this.approvals || {};
        this.approvals = a;
        a[tool_call_id] = {
            tool_call_id,
            interrupt_id,
            approved: null
        };
    }

    clear_approvals() {
        this.approvals = null;
    }

    /**
     * @param {string} cls css class
     * @param {string} label heading
     * @param {string} text body content
     */
    add_entry(cls, label, text) {

        const l = h("div", { class: "label" }, label);
        const b = h("div", { class: "body" }, text);
        const div = h("div", { class: ["entry", cls] }, [l,b]);

        this.host.appendChild(div);
        this.scroll_bottom();

        const msg_dom = new MessageDom(div, l, b);

        this.message_log.push(msg_dom);

        return msg_dom;
    }



    /**
     * @param {AsyncGenerator<StreamMessage>} events
     */
    async handle_stream(
        events,
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
                } else if (event === "error") {
                    this.add_entry("error", "error", data.message);
                } else if (event === "done") {
                    this.add_entry("done", "done", "");
                } else if (event === "approval_required") {
                    const { tool, args, tool_call_id, interrupt_id } = data;
                    this.init_approval(tool_call_id, interrupt_id);
                    this.add_request_for_approval(
                        tool_call_id,
                    )
                } else {
                    this.add_entry("unknown", "event", JSON.stringify(data));
                }
            }
        }
    }

    async think() {
        if (this.thinking) {
            return
        }
        this.thinking = true;
        while (this.train_of_thunk.not_empty()) {
            const next = this.train_of_thunk.dequeue();
            if (!next) break;
            await this.handle_stream(
                await next(),
            );
        }
        this.thinking = false;
    }
}
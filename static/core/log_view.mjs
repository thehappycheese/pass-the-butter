import { Queue } from "./queue.mjs";



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
        this.message_log = [];
        this.tool_calls = {};
        this.train_of_thunk = new Queue();
        this.host = host;
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
            `${name}${Object.keys(args).length === 0 ? '()' : `(\n${Object.entries(args).map(([k, v]) => `  ${k} = ${JSON.stringify(v)},`).join("\n")}\n)`}`
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
        this.host.scrollTop = this.host.scrollHeight;
        return dom
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
        this.host.scrollTop = this.host.scrollHeight;

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
                this.host.scrollTop = this.host.scrollHeight;
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

                    const { tool, args } = data;
                    this.add_entry(
                        "approval_request",
                        "approval request",
                        `${tool}(\n${Object.entries(args).map(([k, v]) => `  ${k} = ${v},`).join("\n")}${Object.keys(args).length > 0 ? '\n' : ''})`
                    );

                    const approved = confirm(`Approve ${tool}(${JSON.stringify(args)})?`);

                    this.add_entry(
                        approved ? "approval_response_positive" : "approval_response_negative",
                        "approval",
                        approved ? "APPROVED" : "NOT APPROVED"
                    );
                    resume( approved );
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
        while (this.train_of_thunk.not_empty()) {
            const next = this.train_of_thunk.dequeue();
            if (!next) break;
            await this.handle_stream(
                await next(),
                { resume }
            );
        }
    }
}